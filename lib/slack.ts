import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Slack surface for Act 1 — inbound only.
 *
 * Salesforce composes and posts the card itself (`Act1SlackCard.cls`), so nothing
 * here builds or sends messages. What remains is what Salesforce cannot host: the
 * endpoint Slack calls when a button is tapped, which needs a public URL that
 * answers within three seconds.
 */

/** Slack rejects anything older than five minutes; so do we, to stop replays. */
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

export type SlackConfig = {
  signingSecret: string;
  /** Retained so the health endpoint can report a complete configuration. */
  botToken: string;
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
 * POST — anyone could forge a "Send it" tap and write to Salesforce. Uses a
 * constant-time compare so the check itself doesn't leak the expected value.
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
