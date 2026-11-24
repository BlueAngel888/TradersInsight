// Environment configuration and per-account trading policy.
//
// Required:
//   METAAPI_TOKEN      MetaApi API token (read + trade access to the accounts).
//   MCP_PASSWORD       Password typed once when connecting Claude (min 12 chars).
// Optional:
//   AUTH_SECRET        Key that signs login and confirmation tokens. Derived from
//                      the two values above when not set.
//   TRADING_ENABLED    "false" turns off every trade on every account (kill switch).
//   TRADING_LOGINS     Comma-separated MT5 logins allowed to trade in addition to
//                      plain demo accounts, e.g. a cash or funded account.
//   READONLY_LOGINS    Comma-separated MT5 logins that may never trade.
//   MAX_LOT            Largest volume per order (default 1).
//   MAX_RISK_PERCENT   Largest loss at the stop, as % of balance (default 2).
//   REQUIRE_STOP_LOSS  "false" allows orders without a stop loss (default true).

import { createHash } from "node:crypto";

export class ConfigError extends Error {}

export type AccountKind = "demo" | "cash" | "funded" | "unknown";

export interface TradingPolicy {
  tradingAllowed: boolean;
  reason: string;
  maxLot: number;
  maxRiskPercent: number;
  requireStopLoss: boolean;
}

const list = (v: string | undefined) =>
  new Set(
    (v ?? "")
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean),
  );

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n > 0 ? n : fallback;
};

export function env(source: Record<string, string | undefined> = process.env) {
  return {
    metaApiToken: source.METAAPI_TOKEN?.trim() ?? "",
    password: source.MCP_PASSWORD ?? "",
    authSecret: source.AUTH_SECRET ?? "",
    tradingEnabled: (source.TRADING_ENABLED ?? "true").toLowerCase() !== "false",
    tradingLogins: list(source.TRADING_LOGINS),
    readonlyLogins: list(source.READONLY_LOGINS),
    maxLot: num(source.MAX_LOT, 1),
    maxRiskPercent: num(source.MAX_RISK_PERCENT, 2),
    requireStopLoss: (source.REQUIRE_STOP_LOSS ?? "true").toLowerCase() !== "false",
  };
}

export type Env = ReturnType<typeof env>;

export function requireMetaApiToken(e: Env = env()): string {
  if (!e.metaApiToken) throw new ConfigError("METAAPI_TOKEN nu este setat pe server (Vercel → Settings → Environment Variables).");
  return e.metaApiToken;
}

export function requirePassword(e: Env = env()): string {
  if (e.password.length < 12) throw new ConfigError("MCP_PASSWORD lipsește sau are sub 12 caractere.");
  return e.password;
}

/** Key used to sign OAuth codes, access tokens and trade confirmations. */
export function signingKey(e: Env = env()): Buffer {
  if (e.authSecret.length >= 32) return Buffer.from(e.authSecret);
  // Derived key: changing the password or the MetaApi token logs Claude out.
  return createHash("sha256").update(`traders-insight-mcp:${requireMetaApiToken(e)}:${requirePassword(e)}`).digest();
}

// Words that show up in prop-firm account names and servers. Such accounts
// are often reported by MT5 as "demo" even though real payouts are at stake.
const PROP_HINTS = /fundednext|funded|ftmo|prop|the5ers|5ers|e8|fundingpips|topstep|alpha ?capital|myforexfunds|fxify|blueberry ?funded|challenge|evaluation/i;

export function classifyAccount(a: { name?: string; server?: string; broker?: string; tradeMode?: string }): AccountKind {
  const text = `${a.name ?? ""} ${a.server ?? ""} ${a.broker ?? ""}`;
  if (PROP_HINTS.test(text)) return "funded";
  if (a.tradeMode === "ACCOUNT_TRADE_MODE_DEMO" || /\bdemo\b/i.test(text)) return "demo";
  if (a.tradeMode === "ACCOUNT_TRADE_MODE_REAL" || /\b(live|real|cash)\b/i.test(text)) return "cash";
  return "unknown";
}

/**
 * Who may trade: plain demo accounts by default. Cash, funded and unknown
 * accounts are read-only until their login is listed in TRADING_LOGINS.
 */
export function tradingPolicy(login: string | number | undefined, kind: AccountKind, e: Env = env()): TradingPolicy {
  const id = String(login ?? "");
  const limits = { maxLot: e.maxLot, maxRiskPercent: e.maxRiskPercent, requireStopLoss: e.requireStopLoss };
  if (!e.tradingEnabled) return { ...limits, tradingAllowed: false, reason: "Tranzacționarea e oprită pe server (TRADING_ENABLED=false)." };
  if (id && e.readonlyLogins.has(id)) return { ...limits, tradingAllowed: false, reason: "Cont marcat doar-citire (READONLY_LOGINS)." };
  if (id && e.tradingLogins.has(id)) return { ...limits, tradingAllowed: true, reason: "Permis explicit (TRADING_LOGINS)." };
  if (kind === "demo") return { ...limits, tradingAllowed: true, reason: "Cont demo." };
  const what = kind === "funded" ? "Cont funded" : kind === "cash" ? "Cont real (cash)" : "Tip de cont neconfirmat";
  return { ...limits, tradingAllowed: false, reason: `${what}: doar citire. Adaugă login-ul în TRADING_LOGINS ca să permiți tranzacții.` };
}
