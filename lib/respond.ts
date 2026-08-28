import "server-only";

import {
  CAPTURE_PROMPT,
  respond as scriptedRespond,
  type Message,
} from "./agent";
import {
  readConfig,
  sendMessage,
  startSession,
  type AgentConfig,
} from "./agentApi";

/**
 * Real Agent API first, scripted second.
 *
 * Signals and grounding are ALWAYS computed locally from the visitor's own
 * message, whichever path produces the answer text. Intent is a property of
 * what she asked, not of who answered — so scoring, routing, and the Lead stay
 * identical across both paths. That's what makes the fallback invisible.
 */

export type AnswerSource = "agent-api" | "scripted";

export type Answer = {
  content: string;
  signals: string[];
  groundedIn: string[];
  readyToCapture: boolean;
  capturePrompt: string | null;
  source: AnswerSource;
  /** Why the scripted path was used. Surfaced for operators, not visitors. */
  fallbackReason: string | null;
  /** Agent API session to carry into the next turn. */
  sessionId: string | null;
};

export async function answer(
  history: Message[],
  message: string,
  sessionId: string | null
): Promise<Answer> {
  // Local analysis runs regardless — it drives scoring, not the reply text.
  const scripted = scriptedRespond(history, message);

  const base = {
    signals: scripted.signals,
    groundedIn: scripted.groundedIn,
    readyToCapture: scripted.readyToCapture,
    capturePrompt: scripted.readyToCapture ? CAPTURE_PROMPT : null,
  };

  const config = readConfig();
  if (!config) {
    return {
      ...base,
      content: scripted.content,
      source: "scripted",
      fallbackReason: "Agent API not configured",
      sessionId: null,
    };
  }

  try {
    const live = await callAgent(config, history, message, sessionId);
    return {
      ...base,
      // A sales-shaped Salesforce agent asks for name and email on its own.
      // Appending our prompt too would ask the visitor three times, so when the
      // live agent is driving, let it own the capture moment. The Lead is
      // created as soon as an email appears in her message either way.
      capturePrompt: null,
      content: live.reply,
      source: "agent-api",
      fallbackReason: null,
      sessionId: live.sessionId,
    };
  } catch (error) {
    // Any failure — timeout, 401, policy misconfiguration, empty reply — drops
    // to the scripted answer. The visitor sees a normal conversation.
    return {
      ...base,
      content: scripted.content,
      source: "scripted",
      fallbackReason: error instanceof Error ? error.message : "unknown error",
      // Drop a possibly-broken session so the next turn starts clean.
      sessionId: null,
    };
  }
}

async function callAgent(
  config: AgentConfig,
  history: Message[],
  message: string,
  sessionId: string | null
): Promise<{ reply: string; sessionId: string }> {
  // sequenceId must increase within a session; derive it from the turn count
  // so it stays correct without the client having to track it.
  const sequenceId = history.filter((m) => m.role === "visitor").length + 1;

  if (sessionId) {
    try {
      const reply = await sendMessage(config, sessionId, message, sequenceId);
      return { reply, sessionId };
    } catch {
      // The session is gone — most likely restored from a page refresh after
      // Salesforce expired it. Starting a fresh one and retrying keeps the
      // visitor on the real agent instead of silently dropping to scripted.
    }
  }

  const fresh = await startSession(config);
  // New session, so the sequence restarts.
  const reply = await sendMessage(config, fresh, message, 1);
  return { reply, sessionId: fresh };
}
