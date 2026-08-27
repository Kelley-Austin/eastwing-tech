import "server-only";

/**
 * Salesforce Agent API client — the genuinely headless path.
 *
 * No logged-in user, no CRM UI: authentication is OAuth 2.0 client credentials
 * against an External Client App, and sessions are started with
 * `bypassUser: true` so an anonymous website visitor works.
 *
 * Every function here either returns a value or throws. Deciding whether to
 * fall back to the scripted agent is the caller's job (see `lib/respond.ts`),
 * which keeps the failure policy in one place.
 */

const TOKEN_SKEW_MS = 60_000;

export type AgentConfig = {
  domain: string;
  clientId: string;
  clientSecret: string;
  agentId: string;
  apiBase: string;
  timeoutMs: number;
  /**
   * `true` = run as the user assigned to the agent (documented default for the
   * client credentials flow). `false` = run as the token's user, i.e. the ECA's
   * Run As user.
   *
   * If the agent has no assigned user, `true` resolves to an empty id and start
   * session fails with "Invalid user ID provided on start session:". Flipping
   * this to `false` is the workaround that needs no Salesforce change.
   */
  bypassUser: boolean;
};

/**
 * Values are trimmed because env vars set through a shell pipe routinely pick
 * up a trailing newline, which produces a 401 that looks like a bad secret.
 */
export function readConfig(): AgentConfig | null {
  const domain = process.env.SF_MY_DOMAIN_URL?.trim().replace(/\/+$/, "");
  const clientId = process.env.SF_CLIENT_ID?.trim();
  const clientSecret = process.env.SF_CLIENT_SECRET?.trim();
  const agentId = process.env.SF_AGENT_ID?.trim();

  if (!domain || !clientId || !clientSecret || !agentId) return null;

  return {
    domain,
    clientId,
    clientSecret,
    agentId,
    apiBase:
      process.env.SF_API_BASE?.trim().replace(/\/+$/, "") ||
      "https://api.salesforce.com/einstein/ai-agent/v1",
    timeoutMs: Number(process.env.SF_AGENT_TIMEOUT_MS ?? 6000),
    bypassUser: (process.env.SF_BYPASS_USER?.trim() ?? "true") !== "false",
  };
}

/** Which config keys are missing — for the health endpoint, never the values. */
export function missingConfigKeys(): string[] {
  return (
    ["SF_MY_DOMAIN_URL", "SF_CLIENT_ID", "SF_CLIENT_SECRET", "SF_AGENT_ID"] as const
  ).filter((k) => !process.env[k]?.trim());
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getToken(
  config: AgentConfig,
  { force = false }: { force?: boolean } = {}
): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(`${config.domain}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    // Salesforce returns {"error":"invalid_client","error_description":"..."}.
    // Surface the description — it distinguishes a bad secret from a policy
    // problem like Client Credentials Flow not enabled on the Policies tab.
    throw new Error(`token ${res.status}: ${truncate(text, 300)}`);
  }

  const data = JSON.parse(text) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error(`token response had no access_token: ${truncate(text, 200)}`);
  }

  // Salesforce omits expires_in for JWT-based tokens; 20 minutes is a safe floor.
  const ttlMs = (data.expires_in ? data.expires_in * 1000 : 20 * 60_000) - TOKEN_SKEW_MS;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(ttlMs, 30_000),
  };

  return cachedToken.token;
}

export async function startSession(config: AgentConfig): Promise<string> {
  const token = await getToken(config);

  const res = await authedFetch(
    config,
    token,
    `${config.apiBase}/agents/${config.agentId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        externalSessionKey: crypto.randomUUID(),
        instanceConfig: { endpoint: config.domain },
        tz: "America/Los_Angeles",
        featureSupport: "Sync",
        bypassUser: config.bypassUser,
      }),
    }
  );

  const data = (await res.json()) as { sessionId?: string };
  if (!data.sessionId) throw new Error("start session returned no sessionId");
  return data.sessionId;
}

export async function sendMessage(
  config: AgentConfig,
  sessionId: string,
  text: string,
  sequenceId: number
): Promise<string> {
  const token = await getToken(config);

  const res = await authedFetch(
    config,
    token,
    `${config.apiBase}/sessions/${sessionId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        message: { sequenceId, type: "Text", text },
        variables: [],
      }),
    }
  );

  const data = (await res.json()) as {
    messages?: { message?: string; type?: string }[];
  };

  // Join any text parts; agents can reply in multiple chunks.
  const reply = (data.messages ?? [])
    .map((m) => m.message)
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .join(" ")
    .trim();

  if (!reply) throw new Error("agent returned no text content");
  return reply;
}

/** Best-effort teardown. A failure here must never surface to the visitor. */
export async function endSession(
  config: AgentConfig,
  sessionId: string
): Promise<void> {
  try {
    const token = await getToken(config);
    await fetch(`${config.apiBase}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-session-end-reason": "UserRequest",
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    // Sessions expire on their own; leaking one is not worth a visible error.
  }
}

/**
 * Fetch with bearer auth that retries once on 401 with a fresh token — tokens
 * can expire mid-conversation, and a silent retry beats a stage failure.
 */
async function authedFetch(
  config: AgentConfig,
  token: string,
  url: string,
  init: RequestInit
): Promise<Response> {
  const attempt = (bearer: string) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });

  let res = await attempt(token);

  if (res.status === 401) {
    const fresh = await getToken(config, { force: true });
    res = await attempt(fresh);
  }

  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${new URL(url).pathname} ${res.status}: ${truncate(
        await res.text(),
        300
      )}`
    );
  }

  return res;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
