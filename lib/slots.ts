/**
 * Turns the time slots the agent offers in prose into structured options the
 * chat can render as buttons.
 *
 * The agent replies with runs like "Friday, August 28 at 9:00 AM Friday,
 * August 28 at 9:30 AM Friday, August 28 at 10:00 AM" — readable, but a wall of
 * text to pick from. Parsing it lets the chat show one tap per slot while the
 * agent keeps full control of what's offered.
 *
 * Client-safe: no server-only imports, since the widget needs it at render time.
 */

/**
 * "Friday, August 28 at 9:00 AM" and its real-world variants. The live agent
 * writes "Friday, August 28, at 9:30 AM" — with a comma before "at" — so both
 * that comma and the word "at" itself have to be optional, as does the year.
 */
const SLOT_RE =
  /(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+)?[A-Z][a-z]{2,8}\s+\d{1,2}(?:,\s*\d{4})?,?\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM)/gi;

/** Fallback for bare times: "9:00 AM". */
const BARE_TIME_RE = /\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi;

/**
 * Messages that state a booking rather than offer one. Rendering buttons on
 * these would invite the visitor to re-pick a slot she has already confirmed.
 */
const CONFIRMATION_RE =
  /\b(confirm(ed|ation)?|booked|is scheduled|has been scheduled|all set)\b/i;

export type Slot = {
  /** Exact text sent back to the agent when tapped. */
  label: string;
};

export type ParsedOffer = {
  /** Message text with the slot list removed, for the bubble. */
  text: string;
  slots: Slot[];
};

/**
 * Extracts offered slots and strips them from the prose.
 *
 * Requires two or more slots: a single time is far more likely part of a
 * sentence about one appointment than a menu to choose from.
 */
export function parseOffer(message: string): ParsedOffer {
  if (CONFIRMATION_RE.test(message)) return { text: message, slots: [] };

  let matches = Array.from(message.matchAll(SLOT_RE)).map((m) => m[0]);

  // Full date-time slots arrive as a contiguous list, so they can be lifted out
  // of the prose cleanly. Bare times are usually mid-sentence ("I have 9:00 AM,
  // 9:30 AM and 10:00 AM open") where removing them leaves wreckage — so those
  // become buttons *alongside* the untouched text.
  let stripFromText = true;

  if (matches.length < 2) {
    matches = Array.from(message.matchAll(BARE_TIME_RE)).map((m) => m[0]);
    stripFromText = false;
  }

  // Normalise whitespace so "August  28" and "August 28" dedupe together.
  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const raw of matches) {
    const label = raw.replace(/\s+/g, " ").trim().replace(/,$/, "");
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      slots.push({ label });
    }
  }

  if (slots.length < 2) return { text: message, slots: [] };
  if (!stripFromText) return { text: message, slots };

  // Remove the slot run from the prose, then tidy the punctuation left behind
  // so the bubble reads as a clean lead-in to the buttons.
  let text = message;
  for (const raw of matches) text = text.replace(raw, "");
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([,:])\s*(?=[,.])/g, "$1")
    .replace(/(?:\s*,)+/g, ",")
    .replace(/,\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // If stripping left nothing meaningful, give the buttons a heading.
  if (text.replace(/[^a-z]/gi, "").length < 12) {
    text = "Here are the next available times:";
  }

  return { text, slots };
}
