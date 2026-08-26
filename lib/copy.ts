/**
 * Client-safe copy.
 *
 * Separate from `knowledge.ts` on purpose: the greeting and the suggested
 * prompts have to render in the browser, but the answer corpus must not ship
 * there. Keeping them apart lets `knowledge.ts` stay `server-only`.
 */

export const GREETING =
  "Hi — I'm Eastwing's assistant. Ask me anything about how we handle dispatch, what we integrate with, or what this costs. Plain language is fine; I'd rather answer your actual question than hand you a contact form.";

export const SUGGESTED_PROMPTS = [
  "We're drowning in manual dispatch — do you integrate with our TMS?",
  "How long does implementation take?",
  "What does this cost per truck?",
] as const;
