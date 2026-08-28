import "server-only";

import { getToken, readConfig, type AgentConfig } from "./agentApi";

/**
 * Thin Salesforce REST client, reusing the External Client App credentials the
 * Agent API already uses. The ECA carries the `api` scope, so no additional
 * setup is needed beyond the Run As user having access to the object.
 */

const API_VERSION = process.env.SF_API_VERSION?.trim() || "64.0";

export type SalesforceContext = { config: AgentConfig; token: string };

export async function connect(): Promise<SalesforceContext | null> {
  const config = readConfig();
  if (!config) return null;
  return { config, token: await getToken(config) };
}

export async function soql<T>(
  ctx: SalesforceContext,
  query: string
): Promise<T[]> {
  const url = `${ctx.config.domain}/services/data/v${API_VERSION}/query/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    signal: AbortSignal.timeout(ctx.config.timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`SOQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { records?: T[] };
  return data.records ?? [];
}

export async function patch(
  ctx: SalesforceContext,
  sobject: string,
  id: string,
  fields: Record<string, string>
): Promise<void> {
  const url = `${ctx.config.domain}/services/data/v${API_VERSION}/sobjects/${sobject}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fields),
    signal: AbortSignal.timeout(ctx.config.timeoutMs),
  });
  // A successful PATCH returns 204 No Content.
  if (!res.ok && res.status !== 204) {
    throw new Error(`PATCH ${sobject} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function create(
  ctx: SalesforceContext,
  sobject: string,
  fields: Record<string, string>
): Promise<string> {
  const url = `${ctx.config.domain}/services/data/v${API_VERSION}/sobjects/${sobject}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fields),
    signal: AbortSignal.timeout(ctx.config.timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CREATE ${sobject} ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { id?: string };
  if (!data.id) throw new Error(`CREATE ${sobject} returned no id`);
  return data.id;
}

/** SOQL string literal escaping — quotes and backslashes only. */
export function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
