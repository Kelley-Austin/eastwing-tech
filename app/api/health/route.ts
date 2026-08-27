import {
  getToken,
  missingConfigKeys,
  readConfig,
  startSession,
  endSession,
} from "@/lib/agentApi";

/**
 * Pre-flight check: is the real Agent API path live right now?
 *
 * Run this before walking on stage. It reports which stage of the handshake
 * works — config, token, session — so a failure points at the actual cause
 * instead of just "fell back to scripted".
 *
 * Never returns secret values, only which keys are absent.
 */
export async function GET() {
  const missing = missingConfigKeys();
  const config = readConfig();

  if (!config) {
    return Response.json(
      {
        path: "scripted",
        reason: "Agent API not configured",
        missingEnvVars: missing,
        checks: { config: false, token: null, session: null },
      },
      { status: 200 }
    );
  }

  const checks: Record<string, unknown> = { config: true };

  let token: string;
  try {
    token = await getToken(config, { force: true });
    checks.token = { ok: true, length: token.length };
  } catch (error) {
    return Response.json(
      {
        path: "scripted",
        reason: "token exchange failed",
        detail: error instanceof Error ? error.message : "unknown error",
        hint: "Check the ECA Policies tab: Client Credentials Flow enabled and a Run As user set. Also Session Settings -> Force relogin after = None.",
        checks: { ...checks, token: { ok: false }, session: null },
      },
      { status: 200 }
    );
  }

  try {
    const sessionId = await startSession(config);
    checks.session = { ok: true };
    await endSession(config, sessionId);
  } catch (error) {
    return Response.json(
      {
        path: "scripted",
        reason: "session start failed",
        detail: error instanceof Error ? error.message : "unknown error",
        hint: "Check SF_AGENT_ID is the 18-char agent id, that the agent is Activated, and that it is not the unsupported 'Agentforce (Default)' type.",
        checks: { ...checks, session: { ok: false } },
      },
      { status: 200 }
    );
  }

  return Response.json({
    path: "agent-api",
    reason: null,
    agentId: `${config.agentId.slice(0, 6)}…`,
    timeoutMs: config.timeoutMs,
    checks,
  });
}
