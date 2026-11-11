import "server-only";
import { assertDemo, buildSnapshot, type Mt5AccountInfo, type Mt5Position, type Mt5Snapshot } from "./mt5";
import { detectSetup, type SetupResult } from "./setup";
import type { Candle } from "./types";

// Read-only MetaApi client. It never places, modifies or closes orders.
// Docs: https://metaapi.cloud/docs/client/restApi/

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const clientBase = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
const marketDataBase = (region: string) => `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai`;

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

interface RawCandle { time: string; open: number; high: number; low: number; close: number; tickVolume?: number; volume?: number }

async function getCandles(token: string, region: string, accountId: string, symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
  const url = `${marketDataBase(region)}/users/current/accounts/${accountId}/historical-market-data/symbols/${encodeURIComponent(symbol)}/timeframes/${timeframe}/candles?limit=${limit}`;
  const raw = await getJson<RawCandle[]>(url, token);
  return raw
    .map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      // Forex has no real volume; tick volume is the usual proxy for volume profile.
      volume: c.volume || c.tickVolume || 0,
    }))
    .sort((a, b) => a.time - b.time);
}

export interface ScanRow { symbol: string; ltf: string; result: SetupResult | null; error?: string }

export const DEFAULT_LTFS = ["15m", "5m", "1m"];

/** Runs the SMC setup detector on each symbol. Read-only: never sends orders. */
export async function scanSetups(symbols: string[], ltfs = DEFAULT_LTFS): Promise<ScanRow[]> {
  const { token, accountId, region: override } = config();
  const region = await resolveRegion(token, accountId, override);
  const account = await getJson<Mt5AccountInfo>(`${clientBase(region)}/users/current/accounts/${accountId}/account-information`, token);
  assertDemo(account);
  const rows: ScanRow[] = [];
  for (const symbol of symbols) {
    try {
      const [d1, h4, h1] = await Promise.all(
        (["1d", "4h", "1h"] as const).map((tf) => getCandles(token, region, accountId, symbol, tf, 300)),
      );
      for (const ltf of ltfs) {
        const candles = await getCandles(token, region, accountId, symbol, ltf, 300);
        const result = detectSetup({ d1, h4, h1, ltf: candles });
        rows.push({ symbol, ltf, result });
        if (!result.setup && !result.trend.aligned) break; // no point checking other LTFs
      }
    } catch (e) {
      rows.push({ symbol, ltf: "-", result: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return rows;
}
