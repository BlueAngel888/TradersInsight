import "server-only";
import { buildSnapshot, type Mt5AccountInfo, type Mt5Position, type Mt5Snapshot } from "./mt5";

// Read-only MetaApi client. It never places, modifies or closes orders.
// Docs: https://metaapi.cloud/docs/client/restApi/

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const clientBase = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

export class MetaApiConfigError extends Error {}

function config() {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  if (!token || !accountId) throw new MetaApiConfigError("METAAPI_TOKEN și METAAPI_ACCOUNT_ID nu sunt setate.");
  return { token, accountId, region: process.env.METAAPI_REGION };
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { "auth-token": token, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MetaApi ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

let cachedRegion: string | undefined;

async function resolveRegion(token: string, accountId: string, override?: string) {
  if (override) return override;
  if (cachedRegion) return cachedRegion;
  const acc = await getJson<{ region?: string; state?: string }>(`${PROVISIONING}/users/current/accounts/${accountId}`, token);
  if (acc.state && acc.state !== "DEPLOYED") throw new Error(`Contul MetaApi nu este pornit (stare: ${acc.state}). Apasă „Deploy” în panoul MetaApi.`);
  cachedRegion = acc.region ?? "new-york";
  return cachedRegion;
}

export async function getMt5Snapshot(): Promise<Mt5Snapshot> {
  const { token, accountId, region: override } = config();
  const region = await resolveRegion(token, accountId, override);
  const base = `${clientBase(region)}/users/current/accounts/${accountId}`;
  const account = await getJson<Mt5AccountInfo>(`${base}/account-information`, token);
  // Check demo before reading anything else from the account.
  buildSnapshot(account, []);
  const positions = await getJson<Mt5Position[]>(`${base}/positions`, token);
  return buildSnapshot(account, positions);
}
