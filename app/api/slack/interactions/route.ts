import { connect, create, esc, patch, soql } from "@/lib/salesforce";
import {
  readSlackConfig,
  respondToInteraction,
  verifySlackSignature,
} from "@/lib/slack";

/**
 * Handles Marcus tapping a button on the Act 1 card.
 *
 * This is the beat the whole act rests on: his first action on the deal is a
 * Slack button, and the activity lands on the Lead server-side. Nobody opens
 * Salesforce.
 *
 * Slack expects a 200 within three seconds, so the tap is acknowledged
 * immediately and the Salesforce write plus card update happen after the
 * response has gone back.
 */

export const maxDuration = 30;

type SlackInteraction = {
  type?: string;
  response_url?: string;
  user?: { id?: string; name?: string; username?: string };
  actions?: { action_id?: string; value?: string }[];
};

export async function POST(request: Request) {
  const slack = readSlackConfig();
  if (!slack) {
    return new Response("Slack not configured", { status: 503 });
  }

  const rawBody = await request.text();

  const verdict = verifySlackSignature(
    slack,
    rawBody,
    request.headers.get("x-slack-request-timestamp"),
    request.headers.get("x-slack-signature")
  );
  if (!verdict.ok) {
    console.warn(`[act1] rejected interaction: ${verdict.reason}`);
    return new Response("Invalid signature", { status: 401 });
  }

  // Slack sends interactions as form-encoded with a JSON `payload` field.
  let interaction: SlackInteraction;
  try {
    const encoded = new URLSearchParams(rawBody).get("payload");
    if (!encoded) return new Response("Missing payload", { status: 400 });
    interaction = JSON.parse(encoded) as SlackInteraction;
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  const action = interaction.actions?.[0];
  const actionId = action?.action_id;
  const leadId = action?.value;
  const responseUrl = interaction.response_url;
  const who = interaction.user?.name ?? interaction.user?.username ?? "a rep";

  if (!actionId || !leadId || !responseUrl) {
    return new Response("Nothing to act on", { status: 200 });
  }

  // Fire-and-forget so Slack gets its 200 inside three seconds.
  void handle(actionId, leadId, who, responseUrl).catch((error) => {
    console.warn(
      `[act1] handling ${actionId} failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  });

  return new Response("", { status: 200 });
}

async function handle(
  actionId: string,
  leadId: string,
  who: string,
  responseUrl: string
): Promise<void> {
  if (actionId === "dismiss") {
    await respondToInteraction(
      responseUrl,
      [context(`Dismissed by ${who}. The Lead stays in the queue.`)],
      "Dismissed"
    );
    return;
  }

  if (actionId === "edit_draft") {
    await respondToInteraction(
      responseUrl,
      [
        context(
          `${who} is editing the draft. Reply in this thread with the wording you want and it will be sent from the Lead.`
        ),
      ],
      "Editing draft"
    );
    return;
  }

  if (actionId !== "send_outreach") return;

  const ctx = await connect();
  if (!ctx) {
    await respondToInteraction(
      responseUrl,
      [context("Could not reach Salesforce to log this. Nothing was sent.")],
      "Failed"
    );
    return;
  }

  const leads = await soql<{
    Id: string;
    FirstName: string | null;
    LastName: string | null;
    Status: string | null;
  }>(
    ctx,
    `SELECT Id, FirstName, LastName, Status FROM Lead WHERE Id = '${esc(leadId)}' LIMIT 1`
  );
  if (!leads.length) {
    await respondToInteraction(
      responseUrl,
      [context("That Lead no longer exists.")],
      "Failed"
    );
    return;
  }

  const name = [leads[0].FirstName, leads[0].LastName].filter(Boolean).join(" ");

  // Log the touch as a completed Task against the Lead, and move the Lead on.
  await create(ctx, "Task", {
    WhoId: leadId,
    Subject: "First touch sent from Slack",
    Status: "Completed",
    Description: `Outreach approved and sent by ${who} from the Act 1 Slack card. No CRM UI was opened.`,
  });

  // 'Working' is the value in this org's picklist — 'Working - Contacted' is the
  // Salesforce default in some orgs and would be rejected here.
  if (leads[0].Status === "New") {
    await patch(ctx, "Lead", leadId, { Status: "Working" });
  }

  console.log(`[act1] outreach sent for ${leadId} by ${who}`);

  await respondToInteraction(
    responseUrl,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *Sent to ${name}.*\nActivity logged on the Lead and the status moved to Working.`,
        },
      },
      context(`Sent by ${who} · nobody opened Salesforce`),
    ],
    `Sent to ${name}`
  );
}

function context(text: string) {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}
