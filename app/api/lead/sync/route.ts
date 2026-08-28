import { extractIdentity, type Message } from "@/lib/agent";
import { connect, esc, patch, soql } from "@/lib/salesforce";

/**
 * Backfills fields the Salesforce agent left blank on the Lead it created.
 *
 * The agent decides per-conversation whether to pass the email to its
 * create/update action, so the field lands roughly half the time — including on
 * records it demonstrably updated afterwards. That non-determinism is fine for
 * a chatbot and unacceptable for a demo whose whole claim is that the record is
 * complete. This closes the gap deterministically.
 *
 * Deliberately additive: it only ever fills fields that are currently empty, so
 * it can never overwrite something the agent got right.
 */

type SyncRequest = { transcript?: Message[] };

type LeadRow = {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  Title: string | null;
  Company: string | null;
};

/** How long after creation a Lead is still considered part of this chat. */
const RECENT_MINUTES = 30;

/** The agent may still be writing the Lead as we ask for it. */
const RETRY_DELAYS_MS = [0, 2500];

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

  const identityText = transcript
    .filter((m) => m.role === "visitor")
    .map((m) => m.content)
    .join("\n");

  const identity = extractIdentity(identityText);

  if (!identity.email) {
    return Response.json({ synced: false, reason: "no email in transcript" });
  }

  const ctx = await connect();
  if (!ctx) {
    return Response.json({ synced: false, reason: "Salesforce not configured" });
  }

  const since = new Date(Date.now() - RECENT_MINUTES * 60_000).toISOString();

  try {
    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));

      const lead = await findLead(ctx, identity, since);
      if (!lead) continue;

      const fields: Record<string, string> = {};
      if (!lead.Email && identity.email) fields.Email = identity.email;
      if (!lead.Title && identity.title) fields.Title = identity.title;

      if (Object.keys(fields).length === 0) {
        return Response.json({
          synced: false,
          leadId: lead.Id,
          reason: "agent already populated these fields",
        });
      }

      await patch(ctx, "Lead", lead.Id, fields);
      console.log(
        `[lead-sync] patched ${lead.Id} with ${Object.keys(fields).join(", ")}`
      );
      return Response.json({ synced: true, leadId: lead.Id, fields });
    }

    return Response.json({
      synced: false,
      reason: "no matching Lead found — the agent may not have created one",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[lead-sync] failed: ${message}`);
    // Never surface this to the visitor's conversation.
    return Response.json({ synced: false, reason: message });
  }
}

/**
 * Finds the Lead this conversation produced.
 *
 * Matching on surname plus a recency window is deliberately conservative: it
 * avoids touching historical records that happen to share a name, and the
 * email-equality check catches the case where the agent already got it right.
 */
async function findLead(
  ctx: NonNullable<Awaited<ReturnType<typeof connect>>>,
  identity: ReturnType<typeof extractIdentity>,
  since: string
): Promise<LeadRow | null> {
  const clauses: string[] = [`CreatedDate >= ${since}`];

  if (identity.email) {
    // Prefer an exact email match — that Lead needs no email backfill, but may
    // still be missing a title.
    const byEmail = await soql<LeadRow>(
      ctx,
      `SELECT Id, FirstName, LastName, Email, Title, Company FROM Lead
       WHERE Email = '${esc(identity.email)}' AND CreatedDate >= ${since}
       ORDER BY CreatedDate DESC LIMIT 1`
    );
    if (byEmail.length) return byEmail[0];
  }

  const surname = identity.name?.trim().split(/\s+/).pop();
  if (surname && surname.length > 1) {
    clauses.push(`LastName = '${esc(surname)}'`);
  } else if (identity.company) {
    clauses.push(`Company = '${esc(identity.company)}'`);
  } else {
    return null;
  }

  const rows = await soql<LeadRow>(
    ctx,
    `SELECT Id, FirstName, LastName, Email, Title, Company FROM Lead
     WHERE ${clauses.join(" AND ")}
     ORDER BY CreatedDate DESC LIMIT 1`
  );

  return rows[0] ?? null;
}
