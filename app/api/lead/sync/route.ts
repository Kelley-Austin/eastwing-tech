import { extractIdentity, type Message } from "@/lib/agent";
import { connect, create, esc, patch, soql } from "@/lib/salesforce";

/**
 * Guarantees the Lead exists and is complete, whatever the agent did.
 *
 * The Salesforce agent is non-deterministic on both counts. It populated `Email`
 * on only about half the Leads it made — including one it demonstrably updated
 * afterwards — and on some conversations it books the meeting without creating a
 * Lead at all (every observed miss coincided with one particular assigned rep).
 * That's tolerable for a chatbot and fatal for a demo whose whole claim is that
 * the record builds itself.
 *
 * So: prefer the agent's record, fill only the fields it left empty, and create
 * one only when none exists. It can never overwrite what the agent got right,
 * and never produces a duplicate, because it always looks first.
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

    // No Lead exists. Only create one once the agent has clearly finished —
    // otherwise we'd race it: creating at the turn the email arrives, then the
    // agent creating its own two turns later, leaves two records. A booking
    // confirmation is the reliable "it's done" signal.
    if (!looksSettled(transcript)) {
      return Response.json({
        synced: false,
        reason: "no Lead yet; waiting for the agent to finish before creating one",
      });
    }

    const created = await createLead(ctx, identity);
    if (created) {
      console.log(`[lead-sync] created ${created} (agent did not)`);
      return Response.json({ created: true, leadId: created });
    }

    return Response.json({
      synced: false,
      reason: "no Lead found and too little identity to create one",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[lead-sync] failed: ${message}`);
    // Never surface this to the visitor's conversation.
    return Response.json({ synced: false, reason: message });
  }
}

/**
 * True once the agent has confirmed a booking — the point after which it is not
 * going to create a Lead if it hasn't already.
 */
function looksSettled(transcript: Message[]): boolean {
  const lastAgent = [...transcript].reverse().find((m) => m.role === "agent");
  if (!lastAgent) return false;
  return /\b(confirm(ed|ation)?|booked|is scheduled|has been scheduled|all set)\b/i.test(
    lastAgent.content
  );
}

/**
 * Creates the Lead the agent skipped.
 *
 * Salesforce requires LastName and Company. Company falls back to the email
 * domain, which is a fair inference and better than discarding a real enquiry
 * over a missing field.
 */
async function createLead(
  ctx: NonNullable<Awaited<ReturnType<typeof connect>>>,
  identity: ReturnType<typeof extractIdentity>
): Promise<string | null> {
  const parts = identity.name?.trim().split(/\s+/) ?? [];
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  if (!lastName) return null;

  const domain = identity.email?.split("@")[1]?.split(".")[0];
  const company =
    identity.company ??
    (domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : null);
  if (!company) return null;

  const fields: Record<string, string> = {
    LastName: lastName,
    Company: company,
    LeadSource: "Web",
  };
  if (parts.length > 1) fields.FirstName = parts[0];
  if (identity.email) fields.Email = identity.email;
  if (identity.title) fields.Title = identity.title;

  return create(ctx, "Lead", fields);
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
