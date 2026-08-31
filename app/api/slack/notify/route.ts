import { connect, esc, soql } from "@/lib/salesforce";
import {
  buildLeadCard,
  draftOutreach,
  missingSlackKeys,
  postMessage,
  readSlackConfig,
  type LeadCard,
} from "@/lib/slack";

/**
 * Act 1 entry point: a qualified Lead becomes a Slack card.
 *
 * Salesforce calls this when the intent score crosses the threshold. It reads
 * the Lead back from Salesforce rather than trusting the request body, so the
 * card always reflects the record — the demo's whole claim is that the record is
 * ground truth, and a card built from a stale payload would quietly break that.
 */

type NotifyRequest = { leadId?: string };

type LeadRow = {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Title: string | null;
  Company: string | null;
  Email: string | null;
  Intent_Score__c: number | null;
  Intent_Rationale__c: string | null;
  Stated_Need__c: string | null;
  Owner: { Name: string | null } | null;
};

type EventRow = { StartDateTime: string; Owner: { Name: string | null } | null };

export const maxDuration = 30;

export async function POST(request: Request) {
  // Shared secret, because this endpoint causes an outbound Slack message.
  const expected = process.env.ACT1_WEBHOOK_TOKEN?.trim();
  if (expected) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expected) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let body: NotifyRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  if (!leadId) {
    return Response.json({ error: "`leadId` is required." }, { status: 400 });
  }

  const slack = readSlackConfig();
  if (!slack) {
    return Response.json(
      { posted: false, reason: "Slack not configured", missing: missingSlackKeys() },
      { status: 200 }
    );
  }

  const ctx = await connect();
  if (!ctx) {
    return Response.json(
      { posted: false, reason: "Salesforce not configured" },
      { status: 200 }
    );
  }

  try {
    const leads = await soql<LeadRow>(
      ctx,
      `SELECT Id, FirstName, LastName, Title, Company, Email,
              Intent_Score__c, Intent_Rationale__c, Stated_Need__c, Owner.Name
       FROM Lead WHERE Id = '${esc(leadId)}' LIMIT 1`
    );
    if (!leads.length) {
      return Response.json({ posted: false, reason: "Lead not found" }, { status: 404 });
    }
    const lead = leads[0];

    // A meeting may already be held from the Act 0 chat; surface it rather than
    // offering a time that would double-book the rep.
    const events = await soql<EventRow>(
      ctx,
      `SELECT StartDateTime, Owner.Name FROM Event
       WHERE WhoId = '${esc(leadId)}' AND StartDateTime >= TODAY
       ORDER BY StartDateTime ASC LIMIT 1`
    );

    const base: Omit<LeadCard, "draft"> = {
      leadId: lead.Id,
      name: [lead.FirstName, lead.LastName].filter(Boolean).join(" ") || "Unknown",
      company: lead.Company ?? "Unknown",
      title: lead.Title,
      email: lead.Email,
      intentScore: lead.Intent_Score__c,
      intentRationale: lead.Intent_Rationale__c,
      statedNeed: lead.Stated_Need__c,
      ownerName: events[0]?.Owner?.Name ?? lead.Owner?.Name ?? null,
      territory: null,
      slot: events.length ? formatSlot(events[0].StartDateTime) : null,
    };

    const card: LeadCard = { ...base, draft: draftOutreach(base) };
    const blocks = buildLeadCard(card);
    const fallback = `Hot inbound — ${card.name}, ${card.company}`;

    const result = await postMessage(slack, blocks, fallback);
    if (!result.ok) {
      console.warn(`[act1] slack post failed: ${result.error}`);
      return Response.json({ posted: false, reason: result.error }, { status: 200 });
    }

    console.log(`[act1] card posted for ${lead.Id} (${card.name}) ts=${result.ts}`);
    return Response.json({ posted: true, ts: result.ts, channel: result.channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[act1] notify failed: ${message}`);
    return Response.json({ posted: false, reason: message }, { status: 200 });
  }
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
