import type { Message } from "@/lib/agent";
import { answer } from "@/lib/respond";

/**
 * The site agent's turn endpoint.
 *
 * Headless by definition: no logged-in user, no session cookie, no CRM UI.
 * Tries the real Salesforce Agent API and silently falls back to the scripted
 * agent on any failure.
 */

type ChatRequest = {
  history?: Message[];
  message?: string;
  sessionId?: string | null;
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 40;

// Must exceed SF_AGENT_TIMEOUT_MS, or the platform kills the function before
// the fallback can run and the visitor gets a hard error instead of an answer.
export const maxDuration = 45;

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "`message` is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `\`message\` exceeds ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 413 }
    );
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m): m is Message =>
            !!m &&
            (m.role === "agent" || m.role === "visitor") &&
            typeof m.content === "string"
        )
        .slice(-MAX_HISTORY)
    : [];

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null;

  const result = await answer(history, message, sessionId);

  // A fallback is an operational event worth seeing in the Vercel logs — it's
  // the difference between "the demo worked" and "the demo worked for a reason".
  if (result.fallbackReason && result.fallbackReason !== "Agent API not configured") {
    console.warn(`[agent-api] fell back to scripted: ${result.fallbackReason}`);
  }

  return Response.json({
    reply: result.content,
    signals: result.signals,
    groundedIn: result.groundedIn,
    readyToCapture: result.readyToCapture,
    capturePrompt: result.capturePrompt,
    source: result.source,
    sessionId: result.sessionId,
    // Operator diagnostics. The widget never renders this; it exists so a
    // fallback on stage can be explained rather than guessed at.
    fallbackReason: result.fallbackReason,
  });
}
