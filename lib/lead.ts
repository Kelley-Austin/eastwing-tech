import "server-only";

import { enrich, routeOwner, scoreIntent } from "./enrichment";
import type { Lead, Message } from "./types";

/**
 * The Lead is shaped like a Salesforce Lead so that pointing `LEAD_WEBHOOK_URL`
 * at a Flow, MuleSoft endpoint, or Apex REST resource is a configuration change
 * rather than a rewrite.
 */
export type { Lead };

export type ComposeLeadInput = {
  identity: {
    name: string | null;
    email: string | null;
    title: string | null;
    company: string | null;
  };
  signals: string[];
  topics: string[];
  transcript: Message[];
};

export function composeLead(input: ComposeLeadInput): Lead {
  const { identity } = input;

  const firmographics = enrich({
    email: identity.email,
    company: identity.company,
  });

  const visitorTurns = input.transcript.filter((m) => m.role === "visitor").length;

  const intent = scoreIntent({
    signals: input.signals,
    title: identity.title,
    turnCount: visitorTurns,
    firmographics,
  });

  const [firstName, ...rest] = (identity.name ?? "").trim().split(/\s+/);

  return {
    id: `L-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    firstName: firstName || null,
    lastName: rest.length ? rest.join(" ") : null,
    title: identity.title,
    email: identity.email,
    company: firmographics.company,
    firmographics,
    intent,
    routing: routeOwner(firmographics),
    transcript: input.transcript,
    topicsDiscussed: [...new Set(input.topics)],
    source: "Website conversation — Agent API (headless)",
  };
}

/**
 * Forward the Lead downstream if a target is configured.
 *
 * Absent `LEAD_WEBHOOK_URL` this is a no-op, which is the intended default:
 * the demo is fully functional with nothing wired up, and pointing it at a real
 * Salesforce endpoint later requires no code change.
 */
export async function forwardLead(
  lead: Lead
): Promise<{ forwarded: boolean; status?: number; error?: string }> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return { forwarded: false };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LEAD_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.LEAD_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(lead),
      // Don't let a slow downstream hold the visitor's browser open.
      signal: AbortSignal.timeout(8000),
    });
    return { forwarded: res.ok, status: res.status };
  } catch (error) {
    // A downstream failure must never break the on-stage experience.
    return {
      forwarded: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
