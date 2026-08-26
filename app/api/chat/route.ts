import { CAPTURE_PROMPT, respond, type Message } from "@/lib/agent";

/**
 * The site agent's turn endpoint.
 *
 * Headless by definition: no logged-in user, no session, no CRM UI involved.
 * The knowledge corpus stays server-side.
 */

type ChatRequest = {
  history?: Message[];
  message?: string;
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 40;

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

  const reply = respond(history, message);

  return Response.json({
    reply: reply.content,
    signals: reply.signals,
    groundedIn: reply.groundedIn,
    readyToCapture: reply.readyToCapture,
    capturePrompt: reply.readyToCapture ? CAPTURE_PROMPT : null,
  });
}
