import "server-only";

import {
  FALLBACK_ANSWER,
  KNOWLEDGE,
  type KnowledgeEntry,
} from "./knowledge";

/**
 * The site agent.
 *
 * Deterministic on purpose. It runs server-side, so the swap to the real
 * Salesforce Agent API is confined to `respond()` — the route handler, the
 * client widget, and the Lead shape all stay as they are. Credentials would
 * live here too, never in the browser.
 */

import type { Message, Role } from "./types";

export type { Message, Role };

export type AgentReply = {
  content: string;
  /** Buying signals inferred from this turn. Accumulated across the session. */
  signals: string[];
  /** True once the agent has answered enough to justify asking who she is. */
  readyToCapture: boolean;
  /** Which knowledge entries grounded the answer — shown as provenance. */
  groundedIn: string[];
};

/** Words too common to carry intent; they'd match everything. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "do", "does", "did", "we", "our", "us", "i", "you", "your", "it", "to",
  "of", "in", "on", "for", "with", "at", "by", "from", "up", "about", "into",
  "how", "what", "when", "where", "who", "which", "can", "could", "would",
  "have", "has", "had", "get", "got", "any", "all", "so", "if", "that", "this",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

/**
 * Score each knowledge entry against the visitor's message.
 *
 * Multi-word keywords are matched as phrases (so "how long" only fires on the
 * phrase, not on a stray "long"), single words on token equality so "api"
 * doesn't match inside "rapid".
 */
function matchEntries(message: string): { entry: KnowledgeEntry; score: number }[] {
  const normalized = normalize(message);
  const tokens = new Set(
    normalized.split(/\s+/).filter((t) => t && !STOPWORDS.has(t))
  );

  const scored: { entry: KnowledgeEntry; score: number }[] = [];

  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (keyword.includes(" ")) {
        if (normalized.includes(keyword)) score += 2;
      } else if (tokens.has(keyword)) {
        score += 1;
      }
    }
    if (score > 0) scored.push({ entry, score });
  }

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Visitors routinely ask two things at once — Priya's opening line states a pain
 * *and* asks about TMS integration. Answering only the higher-scoring half
 * leaves her actual question on the floor, so keep a strong runner-up.
 */
const MAX_TOPICS_PER_TURN = 2;

function selectTopics(
  scored: { entry: KnowledgeEntry; score: number }[]
): KnowledgeEntry[] {
  if (scored.length === 0) return [];
  const top = scored[0].score;
  return scored
    .filter((s) => s.score >= Math.max(2, top * 0.6))
    .slice(0, MAX_TOPICS_PER_TURN)
    .map((s) => s.entry);
}

export function respond(history: Message[], message: string): AgentReply {
  const topics = selectTopics(matchEntries(message));
  const visitorTurns = history.filter((m) => m.role === "visitor").length + 1;

  // Enough grounding to justify asking who she is. Two substantive exchanges
  // is the point where asking feels earned rather than gated.
  const readyToCapture = visitorTurns >= 2;

  if (topics.length === 0) {
    return {
      content: FALLBACK_ANSWER,
      signals: ["unanswered_question"],
      readyToCapture,
      groundedIn: [],
    };
  }

  const parts = topics.map((t) => t.answer);

  // Only ever ask one question per turn, and never while we're about to ask
  // for contact details — stacking questions reads as pushy.
  if (topics.length === 1 && topics[0].followUp && !readyToCapture) {
    parts.push(topics[0].followUp);
  }

  return {
    content: parts.join(" "),
    signals: topics.flatMap((t) => t.signals ?? []),
    readyToCapture,
    groundedIn: topics.map((t) => t.id),
  };
}

export const CAPTURE_PROMPT =
  "I can have a specialist send over the integration detail and a volume-based estimate. What's your name, work email, and role?";

/**
 * Pull identity out of free text. The visitor types naturally — the point of
 * Act 0 is that nobody fills in labelled fields — so this has to cope with
 * "Priya Chen, VP of Operations at Northwind, priya@..." in any order.
 */
export function extractIdentity(text: string): {
  name: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
} {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;

  const titleMatch = text.match(
    /\b(VP|Vice President|SVP|EVP|Director|Head|Chief[\w\s]*Officer|C[EOTFI]O|Manager|Lead)\b[^,.\n]*/i
  );
  // "VP of Operations at Northwind Logistics" — the company belongs in its own
  // field, so cut the title at the " at " that introduces the employer.
  const title = titleMatch?.[0]?.split(/\s+at\s+/i)[0]?.trim() ?? null;

  const companyMatch = text.match(/\bat\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)/);
  let company = companyMatch?.[1]?.trim() ?? null;

  // Strip a trailing sentence fragment the greedy capital-run may have grabbed.
  if (company && company.split(/\s+/).length > 4) {
    company = company.split(/\s+/).slice(0, 4).join(" ");
  }

  // Name: leading "Firstname Lastname" before any comma or "at".
  const nameMatch = text.match(/^\s*([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})\b/);
  let name = nameMatch?.[1]?.trim() ?? null;

  // Guard against catching the title as the name ("VP of Operations ...").
  if (name && title && title.toLowerCase().startsWith(name.toLowerCase())) {
    name = null;
  }

  return { name, email, title, company };
}
