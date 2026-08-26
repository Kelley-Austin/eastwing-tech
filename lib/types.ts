/**
 * Types shared across the server/client boundary.
 *
 * Kept free of `server-only` imports so the client widget can type its state
 * against the exact same Lead shape the route handler returns.
 */

export type Role = "agent" | "visitor";

export type Message = {
  role: Role;
  content: string;
};

export type Firmographics = {
  company: string;
  domain: string | null;
  industry: string;
  employees: string;
  revenue: string;
  headquarters: string;
  fleetSize: string;
  tmsInUse: string | null;
  source: string;
};

export type IntentScore = {
  score: number;
  band: "Hot" | "Warm" | "Cool";
  reasons: string[];
};

export type Routing = {
  owner: string;
  territory: string;
  rationale: string;
};

export type Lead = {
  id: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  company: string;
  firmographics: Firmographics;
  intent: IntentScore;
  routing: Routing;
  transcript: Message[];
  topicsDiscussed: string[];
  source: string;
};

export type ChatResponse = {
  reply: string;
  signals: string[];
  groundedIn: string[];
  readyToCapture: boolean;
  capturePrompt: string | null;
};

export type LeadResponse = {
  lead: Lead;
  delivery: { forwarded: boolean; status?: number; error?: string };
};
