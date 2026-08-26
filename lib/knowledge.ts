import "server-only";

/**
 * Eastwing Tech product knowledge.
 *
 * This is the grounding corpus the site agent answers from. The `server-only`
 * import above enforces that it never reaches the browser — a visitor can't
 * scrape the answer set out of the JS bundle. Client-facing strings live in
 * `copy.ts` instead.
 *
 * When this is swapped for the real Salesforce Agent API, this file becomes the
 * knowledge source you point the agent at rather than the answer set itself.
 */

export type KnowledgeEntry = {
  id: string;
  /** Lowercase keywords used for intent matching. */
  keywords: string[];
  answer: string;
  /** Optional nudge appended when this entry is the best match. */
  followUp?: string;
  /** Buying signals implied by asking about this topic. */
  signals?: string[];
};

export const TMS_PLATFORMS = [
  "McLeod PowerBroker",
  "Trimble TMW",
  "MercuryGate",
  "Oracle OTM",
  "SAP TM",
  "Descartes",
] as const;

export const TELEMATICS_PLATFORMS = ["Samsara", "Motive", "Geotab"] as const;

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "tms-integration",
    keywords: [
      "tms",
      "integrate",
      "integration",
      "integrations",
      "connect",
      "mcleod",
      "trimble",
      "tmw",
      "mercurygate",
      "oracle otm",
      "sap",
      "descartes",
      "api",
    ],
    answer: `Yes. We have certified two-way connectors for ${TMS_PLATFORMS.slice(
      0,
      -1
    ).join(", ")}, and ${
      TMS_PLATFORMS[TMS_PLATFORMS.length - 1]
    } — plus a REST API for anything homegrown. Loads, stops, and status flow both directions, so Eastwing plans the dispatch and your TMS stays the book of record. Typical connector stand-up is under two weeks.`,
    followUp: "Which TMS are you on today?",
    signals: ["integration_requirement", "technical_evaluation"],
  },
  {
    id: "manual-dispatch",
    keywords: [
      "manual",
      "dispatch",
      "dispatcher",
      "drowning",
      "spreadsheet",
      "whiteboard",
      "phone",
      "assign",
      "assignment",
      "planning",
      "chaos",
      "firefighting",
    ],
    answer:
      "That's the pattern we see most: dispatchers holding the plan in spreadsheets and their heads, re-planning by phone every time something slips. Eastwing builds the assignment automatically from your loads, hours-of-service, equipment, and live ETAs — then re-plans continuously as conditions change. Dispatchers approve exceptions instead of building the board from scratch.",
    followUp: "How many loads a day is your team moving right now?",
    signals: ["pain_confirmed", "manual_process"],
  },
  {
    id: "roi-savings",
    keywords: [
      "roi",
      "save",
      "savings",
      "cost",
      "value",
      "benefit",
      "results",
      "outcome",
      "empty miles",
      "deadhead",
      "utilization",
    ],
    answer:
      "Across deployments we typically see 12–18% fewer empty miles, roughly 30% less time spent building and re-building the daily plan, and on-time delivery up 6–9 points in the first quarter. We baseline your current numbers during onboarding so the improvement is measured against your data, not our averages.",
    followUp: "Want me to put together an estimate against your load volume?",
    signals: ["roi_interest", "evaluating_business_case"],
  },
  {
    id: "pricing",
    keywords: [
      "price",
      "pricing",
      "cost",
      "how much",
      "license",
      "subscription",
      "quote",
      "budget",
      "per truck",
    ],
    answer:
      "Pricing is per active truck per month, tiered by fleet size, with the TMS connector included rather than billed as a separate integration project. Most mid-market fleets land between $40 and $70 per truck per month. I can get you an exact number, but that needs a couple of specifics about your fleet.",
    followUp: "How many power units are you running?",
    signals: ["pricing_interest", "budget_stage"],
  },
  {
    id: "implementation-time",
    keywords: [
      "how long",
      "implementation",
      "onboard",
      "onboarding",
      "deploy",
      "timeline",
      "go live",
      "live",
      "setup",
      "rollout",
    ],
    answer:
      "Six to eight weeks to production for a typical mid-market fleet. Week one is the TMS connector, weeks two and three shadow-run Eastwing's plan alongside your dispatchers so they can see it's sound before trusting it, and the rest is rollout by terminal. No big-bang cutover.",
    followUp: "Is there a date you're trying to be live by?",
    signals: ["timeline_interest", "implementation_planning"],
  },
  {
    id: "telematics",
    keywords: [
      "eld",
      "telematics",
      "samsara",
      "motive",
      "geotab",
      "gps",
      "tracking",
      "hours of service",
      "hos",
    ],
    answer: `We pull live position and hours-of-service from ${TELEMATICS_PLATFORMS.join(
      ", "
    )}. That's what makes the re-planning trustworthy — the plan respects the hours a driver actually has left, not what was available this morning.`,
    signals: ["integration_requirement"],
  },
  {
    id: "security-compliance",
    keywords: [
      "security",
      "soc2",
      "soc 2",
      "compliance",
      "gdpr",
      "data",
      "privacy",
      "hosted",
      "on prem",
      "encryption",
    ],
    answer:
      "SOC 2 Type II, encryption in transit and at rest, SSO via SAML or OIDC, and regional data residency in the US and EU. We're happy to go through the security package with your team — most reviews take one call plus the questionnaire.",
    signals: ["security_review", "enterprise_evaluation"],
  },
  {
    id: "drivers",
    keywords: [
      "driver",
      "drivers",
      "app",
      "mobile",
      "retention",
      "turnover",
      "adoption",
    ],
    answer:
      "Drivers get their assignments in the app they already use — we push to your existing driver app through the TMS rather than asking drivers to adopt something new. Fleets tell us the bigger retention win is fewer surprise re-routes and more predictable home time, which the planner optimizes for explicitly.",
    signals: ["adoption_concern"],
  },
  {
    id: "competitors",
    keywords: [
      "competitor",
      "versus",
      "vs",
      "compare",
      "alternative",
      "different",
      "why you",
      "better",
    ],
    answer:
      "Most tools in this space give you visibility — a better picture of the mess. Eastwing actually makes the assignment decision and re-makes it as conditions change. The practical difference is whether your dispatchers spend the day reading dashboards or approving exceptions.",
    signals: ["competitive_evaluation"],
  },
];

/** Matched when nothing else scores. Keeps the agent honest instead of bluffing. */
export const FALLBACK_ANSWER =
  "I don't want to guess at that one. I'll flag it for a specialist who can answer it properly — they'll have the detail I don't.";
