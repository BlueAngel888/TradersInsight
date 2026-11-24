import { describe, expect, it } from "vitest";
import { classifyAccount, env, tradingPolicy } from "./config";
import { checkClose, checkModifyPosition, checkOpen, floorToStep, lotsForRisk, tradeBody, type MarketContext } from "./trade";
import { sign, verify, pkceOk } from "./tokens";
import { createHash } from "node:crypto";

const E = (over: Record<string, string> = {}) => env({ METAAPI_TOKEN: "t", MCP_PASSWORD: "a-long-password", ...over });

describe("account classification and policy", () => {
  it("treats prop-firm accounts as funded even when MT5 says demo", () => {
    expect(classifyAccount({ name: "FundedNext 50k", tradeMode: "ACCOUNT_TRADE_MODE_DEMO" })).toBe("funded");
    expect(classifyAccount({ server: "FTMO-Server3", tradeMode: "ACCOUNT_TRADE_MODE_DEMO" })).toBe("funded");
    expect(classifyAccount({ server: "ICMarketsSC-Demo", tradeMode: "ACCOUNT_TRADE_MODE_DEMO" })).toBe("demo");
    expect(classifyAccount({ server: "ICMarketsSC-Live07", tradeMode: "ACCOUNT_TRADE_MODE_REAL" })).toBe("cash");
  });

  it("only demo trades by default; cash/funded need TRADING_LOGINS", () => {
    expect(tradingPolicy("1", "demo", E()).tradingAllowed).toBe(true);
    expect(tradingPolicy("2", "cash", E()).tradingAllowed).toBe(false);
    expect(tradingPolicy("3", "funded", E()).tradingAllowed).toBe(false);
    expect(tradingPolicy("3", "funded", E({ TRADING_LOGINS: "3, 4" })).tradingAllowed).toBe(true);
    expect(tradingPolicy("1", "demo", E({ READONLY_LOGINS: "1" })).tradingAllowed).toBe(false);
    expect(tradingPolicy("3", "funded", E({ TRADING_LOGINS: "3", TRADING_ENABLED: "false" })).tradingAllowed).toBe(false);
  });
});

const policy = tradingPolicy("1", "demo", E());
// EURUSD on a USD account: tick 0.00001 = $1 per lot.
const m: MarketContext = { balance: 10_000, currency: "USD", bid: 1.1, ask: 1.10002, tickSize: 0.00001, lossTickValue: 1, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, digits: 5 };

describe("open checks", () => {
  it("accepts a sane market buy and computes risk", () => {
    const c = checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "market", volume: 0.5, stopLoss: 1.098, takeProfit: 1.106 }, m, policy);
    expect(c.errors).toEqual([]);
    expect(c.riskMoney).toBeCloseTo(101, 0); // 202 ticks * $1 * 0.5
    expect(c.riskPercent).toBeCloseTo(1.01, 2);
  });
  it("requires a stop loss, the right side and the risk limit", () => {
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "market", volume: 0.1 }, m, policy).errors.join()).toMatch(/Stop loss obligatoriu/);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "sell", orderType: "market", volume: 0.1, stopLoss: 1.09 }, m, policy).errors.join()).toMatch(/peste intrare/);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "market", volume: 1, stopLoss: 1.09 }, m, policy).errors.join()).toMatch(/MAX_RISK_PERCENT/);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "market", volume: 2, stopLoss: 1.0999 }, m, policy).errors.join()).toMatch(/MAX_LOT/);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "market", volume: 0.015, stopLoss: 1.0999 }, m, policy).errors.join()).toMatch(/multiplu/);
  });
  it("checks limit/stop placement", () => {
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "limit", volume: 0.1, entryPrice: 1.105, stopLoss: 1.1 }, m, policy).errors.join()).toMatch(/sub prețul curent/);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "buy", orderType: "limit", volume: 0.1, entryPrice: 1.095, stopLoss: 1.094 }, m, policy).errors).toEqual([]);
    expect(checkOpen({ action: "open", symbol: "EURUSD", side: "sell", orderType: "stop", volume: 0.1, entryPrice: 1.095, stopLoss: 1.096 }, m, policy).errors).toEqual([]);
  });
});

describe("modify / close", () => {
  const pos = { id: "p1", symbol: "EURUSD", side: "buy" as const, volume: 1, openPrice: 1.099, stopLoss: 1.098 };
  it("allows tightening but blocks widening past the limit", () => {
    expect(checkModifyPosition({ action: "modify_position", positionId: "p1", stopLoss: 1.0985 }, pos, m, policy).errors).toEqual([]);
    expect(checkModifyPosition({ action: "modify_position", positionId: "p1", stopLoss: 1.09 }, pos, m, policy).errors.join()).toMatch(/MAX_RISK_PERCENT/);
    expect(checkModifyPosition({ action: "modify_position", positionId: "p1", stopLoss: 1.2 }, pos, m, policy).errors.join()).toMatch(/sub prețul curent/);
  });
  it("validates partial close volume", () => {
    expect(checkClose({ action: "close_position", positionId: "p1", volume: 2 }, pos, m).errors.length).toBe(1);
    expect(checkClose({ action: "close_position", positionId: "p1", volume: 0.5 }, pos, m).errors).toEqual([]);
  });
});

describe("sizing and request bodies", () => {
  it("sizes lots from risk", () => {
    expect(lotsForRisk(1, 1.10002, 1.09802, m)).toBe(0.5); // $100 / (200 ticks * $1)
    expect(floorToStep(0.129, 0.01)).toBe(0.12);
  });
  it("maps intents to MetaApi actions", () => {
    expect(tradeBody({ action: "open", symbol: "XAUUSD", side: "sell", orderType: "limit", volume: 0.1, entryPrice: 2400, stopLoss: 2410 }, "TIabc").actionType).toBe("ORDER_TYPE_SELL_LIMIT");
    expect(tradeBody({ action: "open", symbol: "XAUUSD", side: "buy", orderType: "market", volume: 0.1, entryPrice: 1 }, "TIabc")).not.toHaveProperty("openPrice");
    expect(tradeBody({ action: "close_position", positionId: "9", volume: 0.1 }, "x").actionType).toBe("POSITION_PARTIAL");
  });
});

describe("tokens", () => {
  const key = Buffer.from("k".repeat(32));
  it("rejects tampered, expired and wrong-type tokens", () => {
    const t = sign({ typ: "trade", exp: Date.now() + 1000, v: 1 }, key);
    expect(verify(t, key, "trade")).toMatchObject({ v: 1 });
    expect(verify(t, key, "access")).toBeNull();
    expect(verify(t, Buffer.from("x".repeat(32)), "trade")).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ typ: "trade", exp: Date.now() + 1e9, v: 2 })).toString("base64url");
    expect(verify(`${forged}.${sig}`, key, "trade")).toBeNull();
    expect(verify(`${body}.${sig}`, key, "trade", Date.now() + 5000)).toBeNull();
  });
  it("checks PKCE S256", () => {
    const v = "verifier-123";
    const c = createHash("sha256").update(v).digest("base64url");
    expect(pkceOk(v, c)).toBe(true);
    expect(pkceOk("other", c)).toBe(false);
  });
});
