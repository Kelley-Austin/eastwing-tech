import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Slack surface for Act 1.
 *
 * The rep's first contact with the deal is a Slack card, so this owns composing
 * that card, posting it, and verifying that inbound button taps genuinely came
 * from Slack.
 */

const SLACK_API = "https://slack.com/api";

/** Slack rejects anything older than five minutes; so do we, to stop replays. */
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

export type SlackConfig = {
  botToken: string;
  signingSecret: string;
  /** Channel or user id the card is delivered to. */
  target: string;
};

export function readSlackConfig(): SlackConfig | null {
  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  const target = process.env.SLACK_TARGET?.trim();
  if (!botToken || !signingSecret || !target) return null;
  return { botToken, signingSecret, target };
}

export function missingSlackKeys(): string[] {
  return (["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_TARGET"] as const).filter(
    (k) => !process.env[k]?.trim()
  );
}

/**
 * Verifies Slack's request signature.
 *
 * Without this the interactions endpoint is a public URL that will act on any
 * POST — anyone could forge a "Send it" tap. Uses a constant-time compare so the
 * check itself doesn't leak the expected signature.
 */
export function verifySlackSignature(
  config: SlackConfig,
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): { ok: true } | { ok: false; reason: string } {
  if (!timestamp || !signature) {
    return { ok: false, reason: "missing signature headers" };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "stale timestamp" };
  }

  const expected =
    "v0=" +
    createHmac("sha256", config.signingSecret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }

  return { ok: true };
}

export type LeadCard = {
  leadId: string;
  name: string;
  company: string;
  title: string | null;
  email: string | null;
  intentScore: number | null;
  intentRationale: string | null;
  statedNeed: string | null;
  ownerName: string | null;
  territory: string | null;
  /** Human-readable slot already held on the rep's calendar, if any. */
  slot: string | null;
  draft: string;
};

/**
 * Block Kit card. Mirrors the storyboard beat: who it is, why it's hot, a
 * drafted first touch, and a slot — with the send action one tap away.
 */
export function buildLeadCard(card: LeadCard) {
  const heat =
    card.intentScore != null && card.intentScore >= 70
      ? "🔥 Hot inbound"
      : card.intentScore != null && card.intentScore >= 40
        ? "Warm inbound"
        : "New inbound";

  const facts: string[] = [];
  if (card.title) facts.push(`*Role*\n${card.title}`);
  facts.push(`*Company*\n${card.company}`);
  if (card.email) facts.push(`*Email*\n${card.email}`);
  if (card.intentScore != null) facts.push(`*Intent*\n${card.intentScore}/100`);
  if (card.territory) facts.push(`*Territory*\n${card.territory}`);
  if (card.slot) facts.push(`*Open slot*\n${card.slot}`);

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${heat} — ${card.name}`, emoji: true },
    },
    {
      type: "section",
      fields: facts.slice(0, 10).map((text) => ({ type: "mrkdwn", text })),
    },
  ];

  if (card.statedNeed) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*What she asked for*\n>${card.statedNeed}` },
    });
  }

  if (card.intentRationale) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Why it scored: ${card.intentRationale.replace(/\n/g, " · ")}`,
        },
      ],
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Drafted first touch*\n${card.draft}` },
    },
    {
      type: "actions",
      block_id: `lead_actions:${card.leadId}`,
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Send it", emoji: true },
          action_id: "send_outreach",
          value: card.leadId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit draft", emoji: true },
          action_id: "edit_draft",
          value: card.leadId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Not now", emoji: true },
          action_id: "dismiss",
          value: card.leadId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          // No rep name here on purpose. In the demo org the Lead owner is the
          // presenter's own user, and seeing their name on stage reads as a
          // misconfiguration rather than as routing.
          type: "mrkdwn",
          text: card.territory
            ? `Routed by territory: ${card.territory} · nobody opened Salesforce`
            : "Nobody opened Salesforce",
        },
      ],
    }
  );

  return blocks;
}

export async function postMessage(
  config: SlackConfig,
  blocks: unknown[],
  fallbackText: string
): Promise<{ ok: boolean; ts?: string; channel?: string; error?: string }> {
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: config.target,
      text: fallbackText,
      blocks,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    ts?: string;
    channel?: string;
    error?: string;
  };

  return {
    ok: Boolean(data.ok),
    ts: data.ts,
    channel: data.channel,
    error: data.error,
  };
}

/** Replaces the card in place, so a tap visibly resolves rather than piling up. */
export async function respondToInteraction(
  responseUrl: string,
  blocks: unknown[],
  fallbackText: string
): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      replace_original: true,
      text: fallbackText,
      blocks,
    }),
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * The drafted first touch.
 *
 * Deterministic on purpose: it must read the same every rehearsal, and it is
 * built only from what the visitor actually said, so it can never invent a
 * detail the rep would then have to walk back on a call.
 */
export function draftOutreach(card: Omit<LeadCard, "draft">): string {
  const first = card.name.split(/\s+/)[0] || "there";
  const lines = [`Hi ${first},`, ""];

  if (card.statedNeed) {
    lines.push(
      `Thanks for asking about ${summarise(card.statedNeed)} on our site — that's the exact problem Eastwing was built for.`
    );
  } else {
    lines.push(
      `Thanks for getting in touch through our site — happy to help with whatever you're weighing up.`
    );
  }

  lines.push(
    "",
    "Rather than send you a deck, the fastest thing is usually a short call where we run a week of your own dispatch through Eastwing and show you what it would have done differently."
  );

  if (card.slot) {
    lines.push("", `I've held ${card.slot} — does that still work?`);
  } else {
    lines.push("", "Would a 30-minute call this week suit?");
  }

  // Generic sign-off rather than the Lead owner's name, for the same reason as
  // the card footer.
  lines.push("", "The Eastwing team");

  return lines.join("\n");
}

/** Trims a stated need down to something that reads inside a sentence. */
function summarise(need: string): string {
  const cleaned = need.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const words = cleaned.split(" ");
  const short = words.length > 16 ? `${words.slice(0, 16).join(" ")}…` : cleaned;
  return short.charAt(0).toLowerCase() + short.slice(1);
}
