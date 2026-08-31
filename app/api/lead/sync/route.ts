import { extractIdentity, type Message } from "@/lib/agent";
import { connect, invokeApexAction } from "@/lib/salesforce";

/**
 * Guarantees the Lead is complete, scored, and announced — whatever the agent did.
 *
 * The Salesforce agent is non-deterministic about passing the visitor's email to
 * its own capture action. That is not just a missing field: the email is worth 20
 * points of intent score, so losing it can drop a genuinely qualified visitor
 * below the notification threshold and silently suppress the Act 1 Slack card.
 *
 * So rather than writing the record directly, this calls the same `CaptureSiteLead`
 * Apex action the agent uses, passing the email and transcript the site extracted.
 * The Apex then owns everything downstream, exactly once:
 *
 *   - fills in the email the agent dropped
 *   - RE-SCORES the Lead now that the email is present
 *   - re-evaluates the Act 1 threshold and fires the Slack card
 *
 * Deliberately omits `sessionId`. With a session key the Apex upserts on
 * `Agent_Session_Id__c`, which the agent never populates — so a keyed call would
 * not match the agent's record and would create a second Lead. Without it the
 * Apex falls back to matching on email, which updates the agent's Lead in place.
 */

type SyncRequest = { transcript?: Message[] };

type CaptureOutputs = {
  leadId?: string;
  intentScore?: number;
  intentRationale?: string;
  success?: boolean;
  message?: string;
};

export const maxDuration = 30;

export async function POST(request: Request) {
  let body: SyncRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const transcript = Array.isArray(body.transcript)
    ? body.transcript.filter(
        (m): m is Message =>
          !!m &&
          (m.role === "agent" || m.role === "visitor") &&
          typeof m.content === "string"
      )
    : [];

  const visitorText = transcript
    .filter((m) => m.role === "visitor")
    .map((m) => m.content)
    .join("\n");

  const identity = extractIdentity(visitorText);

  // Without an email there is nothing the agent could have dropped, and no key
  // to match its Lead on.
  if (!identity.email) {
    return Response.json({ synced: false, reason: "no email in transcript" });
  }

  const ctx = await connect();
  if (!ctx) {
    return Response.json({ synced: false, reason: "Salesforce not configured" });
  }

  try {
    const result = await invokeApexAction<CaptureOutputs>(ctx, "CaptureSiteLead", {
      fullName: identity.name ?? undefined,
      email: identity.email,
      company: identity.company ?? undefined,
      jobTitle: identity.title ?? undefined,
      statedNeed: firstVisitorTurn(transcript),
      transcript: renderTranscript(transcript),
      channel: "Website Agent - site sync",
    });

    if (!result.success) {
      const reason = result.errors?.join("; ") || "action reported failure";
      console.warn(`[lead-sync] CaptureSiteLead failed: ${reason}`);
      return Response.json({ synced: false, reason });
    }

    console.log(
      `[lead-sync] captured ${result.outputs?.leadId} score=${result.outputs?.intentScore}`
    );

    return Response.json({
      synced: true,
      leadId: result.outputs?.leadId,
      intentScore: result.outputs?.intentScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[lead-sync] failed: ${message}`);
    // Never surface this in the visitor's conversation.
    return Response.json({ synced: false, reason: message });
  }
}

/** The opening message is what she came for, and scores the buying signals. */
function firstVisitorTurn(transcript: Message[]): string | undefined {
  return transcript.find((m) => m.role === "visitor")?.content;
}

function renderTranscript(transcript: Message[]): string {
  return transcript
    .map((m) => `${m.role === "visitor" ? "Visitor" : "Agent"}: ${m.content}`)
    .join("\n\n");
}
