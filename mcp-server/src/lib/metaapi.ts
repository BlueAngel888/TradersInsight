// MetaApi REST client for every MT5 account on one MetaApi token.
// Docs: https://metaapi.cloud/docs/client/restApi/ and /docs/provisioning/
// Reads go straight through. Trades only go through `sendTrade`, which the
// MCP layer calls after a preview the user has confirmed.

import { classifyAccount, requireMetaApiToken, tradingPolicy, type AccountKind, type TradingPolicy } from "./config";
import type { Candle } from "../analysis/types";

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const clientBase = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
const marketDataBase = (region: string) => `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai`;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "auth-token": requireMetaApiToken(), accept: "application/json", "content-type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = j.message ?? msg;
    } catch {}
    if (res.status === 401) msg = "Token MetaApi invalid sau expirat. " + msg;
    throw new MetaApiError(`MetaApi ${res.status}: ${msg}`, res.status);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- Accounts ----------

interface RawAccount {
  _id?: string;
  id?: string;
  name?: string;
  login?: string | number;
  server?: string;
  platform?: string;
  region?: string;
  state?: string;
  connectionStatus?: string;
  type?: string;
}

export interface AccountRef {
  id: string; // MetaApi account id
  name: string;
  login: string;
  server: string;
  platform: string;
  region: string;
  state: string; // DEPLOYED, UNDEPLOYED, DEPLOYING...
  connectionStatus: string;
}

export interface AccountInformation {
  platform: string;
  broker: string;
  currency: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  marginLevel?: number;
  name: string;
  login: number;
  type: string; // ACCOUNT_TRADE_MODE_DEMO | _CONTEST | _REAL
}

let accountCache: { at: number; list: AccountRef[] } | undefined;

export async function listAccounts(fresh = false): Promise<AccountRef[]> {
  if (!fresh && accountCache && Date.now() - accountCache.at < 60_000) return accountCache.list;
  const raw = await call<RawAccount[] | { items?: RawAccount[] }>(`${PROVISIONING}/users/current/accounts?limit=1000`);
  const items = Array.isArray(raw) ? raw : (raw.items ?? []);
  const list = items.map((a) => ({
    id: String(a._id ?? a.id),
    name: a.name ?? "",
    login: String(a.login ?? ""),
    server: a.server ?? "",
    platform: a.platform ?? "mt5",
    region: a.region ?? "new-york",
    state: a.state ?? "UNKNOWN",
    connectionStatus: a.connectionStatus ?? "UNKNOWN",
  }));
  accountCache = { at: Date.now(), list };
  return list;
}

/** Finds an account by MetaApi id, MT5 login or (part of) its name. */
export async function resolveAccount(query: string): Promise<AccountRef> {
  const q = query.trim().toLowerCase();
  const all = await listAccounts();
  const exact = all.find((a) => a.id.toLowerCase() === q || a.login === q);
  if (exact) return exact;
  const byName = all.filter((a) => a.name.toLowerCase().includes(q));
  if (byName.length === 1) return byName[0];
  const names = all.map((a) => `${a.name || "fără nume"} (login ${a.login})`).join(", ");
  if (byName.length > 1) throw new MetaApiError(`Mai multe conturi se potrivesc cu „${query}”: ${byName.map((a) => a.login).join(", ")}. Folosește login-ul.`);
  throw new MetaApiError(`Nu găsesc contul „${query}”. Conturi disponibile: ${names || "niciunul — adaugă conturile în MetaApi"}.`);
}

function assertDeployed(a: AccountRef) {
  if (a.state !== "DEPLOYED")
    throw new MetaApiError(`Contul ${a.name || a.login} nu este pornit în MetaApi (stare: ${a.state}). Folosește unealta deploy_account sau apasă „Deploy” în MetaApi.`);
}

const accountUrl = (a: AccountRef) => `${clientBase(a.region)}/users/current/accounts/${a.id}`;

export async function deployAccount(a: AccountRef): Promise<void> {
  await call(`${PROVISIONING}/users/current/accounts/${a.id}/deploy`, { method: "POST" });
  accountCache = undefined;
}

export async function getAccountInformation(a: AccountRef): Promise<AccountInformation> {
  assertDeployed(a);
  return call<AccountInformation>(`${accountUrl(a)}/account-information`);
}

export interface AccountContext {
  ref: AccountRef;
  info: AccountInformation;
  kind: AccountKind;
  policy: TradingPolicy;
}

export async function accountContext(query: string): Promise<AccountContext> {
  const ref = await resolveAccount(query);
  const info = await getAccountInformation(ref);
  const kind = classifyAccount({ name: ref.name, server: info.server || ref.server, broker: info.broker, tradeMode: info.type });
  return { ref, info, kind, policy: tradingPolicy(ref.login || info.login, kind) };
}

// ---------- Positions, orders, history ----------

export interface Position {
  id: string;
  symbol: string;
  type: string; // POSITION_TYPE_BUY | POSITION_TYPE_SELL
  volume: number;
  openPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  swap?: number;
  commission?: number;
  time?: string;
  comment?: string;
  clientId?: string;
}

export interface Order {
  id: string;
  symbol: string;
  type: string; // ORDER_TYPE_BUY_LIMIT ...
  state?: string;
  volume?: number;
  currentVolume?: number;
  openPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  time?: string;
  comment?: string;
  clientId?: string;
}

export interface Deal {
  id: string;
  type: string;
  entryType?: string; // DEAL_ENTRY_IN | DEAL_ENTRY_OUT ...
  symbol?: string;
  volume?: number;
  price?: number;
  profit?: number;
  swap?: number;
  commission?: number;
  time: string;
  positionId?: string;
  comment?: string;
}

export const getPositions = (a: AccountRef) => call<Position[]>(`${accountUrl(a)}/positions`);
export const getOrders = (a: AccountRef) => call<Order[]>(`${accountUrl(a)}/orders`);

export async function getDeals(a: AccountRef, from: Date, to: Date): Promise<Deal[]> {
  const raw = await call<Deal[] | { deals?: Deal[] }>(`${accountUrl(a)}/history-deals/time/${from.toISOString()}/${to.toISOString()}`);
  return Array.isArray(raw) ? raw : (raw.deals ?? []);
}

// ---------- Market data ----------

export interface SymbolSpec {
  symbol: string;
  tickSize: number;
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  contractSize?: number;
  digits: number;
  stopsLevel?: number;
  description?: string;
}

export interface SymbolPrice {
  symbol: string;
  bid: number;
  ask: number;
  profitTickValue?: number;
  lossTickValue?: number;
  time?: string;
}

export const getSymbols = (a: AccountRef) => call<string[]>(`${accountUrl(a)}/symbols`);
export const getSpecification = (a: AccountRef, symbol: string) =>
  call<SymbolSpec>(`${accountUrl(a)}/symbols/${encodeURIComponent(symbol)}/specification`);
export const getPrice = (a: AccountRef, symbol: string) =>
  call<SymbolPrice>(`${accountUrl(a)}/symbols/${encodeURIComponent(symbol)}/current-price`);

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mn"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

interface RawCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume?: number;
  volume?: number;
}

export async function getCandles(a: AccountRef, symbol: string, timeframe: Timeframe, limit = 300): Promise<Candle[]> {
  assertDeployed(a);
  const url = `${marketDataBase(a.region)}/users/current/accounts/${a.id}/historical-market-data/symbols/${encodeURIComponent(symbol)}/timeframes/${timeframe}/candles?limit=${Math.min(Math.max(limit, 1), 1000)}`;
  const raw = await call<RawCandle[]>(url);
  return raw
    .map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      // Forex has no real volume; tick volume is the usual proxy.
      volume: c.volume || c.tickVolume || 0,
    }))
    .sort((x, y) => x.time - y.time);
}

// ---------- Trading ----------

export interface TradeResult {
  numericCode: number;
  stringCode: string;
  message: string;
  orderId?: string;
  positionId?: string;
}

const TRADE_OK = new Set([10008, 10009, 10010]); // placed, done, done partially

export async function sendTrade(a: AccountRef, body: Record<string, unknown>): Promise<TradeResult> {
  assertDeployed(a);
  const r = await call<TradeResult>(`${accountUrl(a)}/trade`, { method: "POST", body: JSON.stringify(body) });
  if (!TRADE_OK.has(r.numericCode)) throw new MetaApiError(`Brokerul a refuzat: ${r.stringCode} (${r.numericCode}) ${r.message ?? ""}`.trim());
  return r;
}
