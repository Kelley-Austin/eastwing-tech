/**
 * Firmographic enrichment + intent scoring.
 *
 * Stands in for Data 360 enrichment. The shape of what comes out is what
 * matters for the demo: by the time the Lead exists it is already enriched and
 * already scored, so nobody had to map a form field or qualify it by hand.
 *
 * Swapping in real enrichment means replacing `enrich()` — the callers and the
 * Lead shape stay identical.
 */

import type { Firmographics, IntentScore, Routing } from "./types";

export type { Firmographics, IntentScore, Routing };

/**
 * Known-account fixtures. Priya's company is seeded so the canonical demo path
 * produces a rich, specific record rather than a generic one.
 */
const ACCOUNTS: Record<string, Firmographics> = {
  northwind: {
    company: "Northwind Logistics",
    domain: "northwindlogistics.com",
    industry: "Third-party logistics (3PL)",
    employees: "1,200–1,500",
    revenue: "$410M",
    headquarters: "Columbus, OH",
    fleetSize: "740 power units",
    tmsInUse: "McLeod PowerBroker",
    source: "Data 360 · firmographic match on email domain",
  },
};

const GENERIC_INDUSTRY = "Transportation & logistics";

export function enrich(input: {
  email?: string | null;
  company?: string | null;
}): Firmographics {
  const domain = input.email?.split("@")[1]?.toLowerCase() ?? null;
  const haystack = `${input.company ?? ""} ${domain ?? ""}`.toLowerCase();

  for (const [key, record] of Object.entries(ACCOUNTS)) {
    if (haystack.includes(key)) return record;
  }

  // Unknown account: return an honestly thin record rather than inventing
  // specifics. A demo that fabricates precise revenue for a random domain is
  // the kind of thing an audience catches.
  return {
    company: input.company?.trim() || (domain ? titleCaseDomain(domain) : "Unknown"),
    domain,
    industry: GENERIC_INDUSTRY,
    employees: "Not matched",
    revenue: "Not matched",
    headquarters: "Not matched",
    fleetSize: "Not matched",
    tmsInUse: null,
    source: domain
      ? "Data 360 · no firmographic match for this domain"
      : "Data 360 · insufficient identifiers",
  };
}

function titleCaseDomain(domain: string): string {
  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Weighted signals, ordered most-to-least indicative of a real buying cycle.
 *
 * Calibrated so a strong four-topic conversation lands in the low 70s rather
 * than pinning at 100. Each knowledge topic contributes a primary and a
 * secondary signal, so primaries carry the weight and secondaries only nudge —
 * otherwise every engaged visitor saturates the scale and the score stops
 * discriminating between them.
 */
const SIGNAL_WEIGHTS: Record<string, { points: number; reason: string }> = {
  pain_confirmed: { points: 14, reason: "Named a specific operational pain" },
  integration_requirement: {
    points: 13,
    reason: "Asked about integration with existing systems",
  },
  pricing_interest: { points: 11, reason: "Asked about pricing" },
  timeline_interest: { points: 10, reason: "Asked about implementation timeline" },
  roi_interest: { points: 9, reason: "Asked about ROI / business case" },
  security_review: { points: 7, reason: "Raised security or compliance review" },
  competitive_evaluation: {
    points: 7,
    reason: "Comparing against alternatives",
  },
  manual_process: { points: 4, reason: "Currently running a manual process" },
  technical_evaluation: { points: 3, reason: "Technical evaluation questions" },
  budget_stage: { points: 3, reason: "Budget-stage language" },
  implementation_planning: {
    points: 3,
    reason: "Planning implementation specifics",
  },
  enterprise_evaluation: { points: 3, reason: "Enterprise evaluation criteria" },
  adoption_concern: { points: 2, reason: "Considering rollout and adoption" },
};

const SENIOR_TITLES = [
  "vp",
  "vice president",
  "chief",
  "cxo",
  "coo",
  "cto",
  "cio",
  "ceo",
  "director",
  "head of",
  "svp",
  "evp",
];

export function scoreIntent(input: {
  signals: string[];
  title?: string | null;
  turnCount: number;
  firmographics: Firmographics;
}): IntentScore {
  const reasons: string[] = [];
  let score = 0;

  // Dedupe — asking about TMS twice isn't twice the intent.
  for (const signal of new Set(input.signals)) {
    const weight = SIGNAL_WEIGHTS[signal];
    if (weight) {
      score += weight.points;
      reasons.push(weight.reason);
    }
  }

  const title = input.title?.toLowerCase() ?? "";
  if (SENIOR_TITLES.some((t) => title.includes(t))) {
    score += 8;
    reasons.push("Senior decision-maker title");
  }

  // Sustained conversation is itself a signal; capped so it can't dominate.
  if (input.turnCount >= 3) {
    const depth = Math.min(8, (input.turnCount - 2) * 3);
    score += depth;
    reasons.push(`Sustained conversation (${input.turnCount} questions)`);
  }

  if (input.firmographics.tmsInUse) {
    score += 4;
    reasons.push(`Known TMS in use (${input.firmographics.tmsInUse})`);
  }

  score = Math.max(0, Math.min(100, score));

  const band: IntentScore["band"] =
    score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cool";

  return { score, band, reasons };
}

/** Territory routing — mirrors what the Act 1 Triggered Agent would do. */
export function routeOwner(firmographics: Firmographics): Routing {
  const hq = firmographics.headquarters;
  const midwest = ["OH", "IL", "IN", "MI", "WI", "MN", "IA", "MO"];
  const state = hq.split(",").pop()?.trim() ?? "";

  if (midwest.includes(state)) {
    return {
      owner: "Marcus Webb",
      territory: "Midwest — Enterprise",
      rationale: `HQ in ${hq} falls in Midwest Enterprise; owner carries 3PL accounts above 500 units.`,
    };
  }

  return {
    owner: "Unassigned — routing queue",
    territory: "Unmatched",
    rationale: hq === "Not matched"
      ? "Insufficient firmographics to route by territory."
      : `No territory rule matched HQ ${hq}.`,
  };
}
