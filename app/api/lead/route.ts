import { extractIdentity, type Message } from "@/lib/agent";
import { composeLead, forwardLead } from "@/lib/lead";

/**
 * Creates the Lead the instant the conversation ends.
 *
 * Takes the raw identity text the visitor typed in her own words — no mapped
 * form fields — enriches, scores, routes, and optionally forwards downstream.
 */

type LeadRequest = {
  identityText?: string;
  signals?: string[];
  topics?: string[];
  transcript?: Message[];
};

export async function POST(request: Request) {
  let body: LeadRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const identityText =
    typeof body.identityText === "string" ? body.identityText.trim() : "";
  if (!identityText) {
    return Response.json({ error: "`identityText` is required." }, { status: 400 });
  }

  const identity = extractIdentity(identityText);

  const transcript = Array.isArray(body.transcript)
    ? body.transcript.filter(
        (m): m is Message =>
          !!m &&
          (m.role === "agent" || m.role === "visitor") &&
          typeof m.content === "string"
      )
    : [];

  const lead = composeLead({
    identity,
    signals: Array.isArray(body.signals) ? body.signals.filter((s) => typeof s === "string") : [],
    topics: Array.isArray(body.topics) ? body.topics.filter((t) => typeof t === "string") : [],
    transcript,
  });

  const delivery = await forwardLead(lead);

  // The chat no longer displays the record, so this log is the only way to
  // confirm a Lead was created and see where it went. Visible in Vercel logs.
  console.log(
    `[lead] ${lead.id} ${lead.firstName ?? "?"} ${lead.lastName ?? ""} | ` +
      `title=${lead.title ?? "-"} | company=${lead.company} | ` +
      `score=${lead.intent.score}/${lead.intent.band} | owner=${lead.routing.owner} | ` +
      `downstream=${
        delivery.forwarded
          ? `sent(${delivery.status})`
          : delivery.error
            ? `failed(${delivery.error})`
            : "none configured — NOT written to Salesforce"
      }`
  );

  return Response.json({ lead, delivery });
}
