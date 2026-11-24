// Pure trade checks: no network here, so every rule can be unit-tested.
// The MCP layer feeds in the live spec/price/balance and turns a checked
// trade into a MetaApi request.

import type { TradingPolicy } from "./config";

export type Side = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";

export type TradeIntent =
  | { action: "open"; symbol: string; side: Side; orderType: OrderType; volume: number; entryPrice?: number; stopLoss?: number; takeProfit?: number; comment?: string }
  | { action: "modify_position"; positionId: string; stopLoss?: number; takeProfit?: number }
  | { action: "modify_order"; orderId: string; entryPrice?: number; stopLoss?: number; takeProfit?: number }
  | { action: "close_position"; positionId: string; volume?: number }
  | { action: "cancel_order"; orderId: string };

export interface MarketContext {
  balance: number;
  currency: string;
  bid: number;
  ask: number;
  tickSize: number;
  /** Account-currency loss of 1 lot for one tick against the position. */
  lossTickValue?: number;
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  digits: number;
}

export interface Check {
  errors: string[];
  warnings: string[];
  entry?: number;
  riskMoney?: number;
  riskPercent?: number;
  rewardMoney?: number;
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Money lost if price moves from `from` to `to` against a position of `volume` lots. */
export function moneyAtDistance(from: number, to: number, volume: number, m: Pick<MarketContext, "tickSize" | "lossTickValue">): number | undefined {
  if (!m.lossTickValue || !m.tickSize) return undefined;
  return (Math.abs(from - to) / m.tickSize) * m.lossTickValue * volume;
}

export function floorToStep(volume: number, step: number): number {
  if (step <= 0) return volume;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  return round(Math.floor(volume / step + 1e-9) * step, decimals);
}

/** Lots so that a stop-out loses `riskPercent` of the balance (rounded down to the lot step). */
export function lotsForRisk(riskPercent: number, entry: number, stopLoss: number, m: MarketContext): number | undefined {
  const perLot = moneyAtDistance(entry, stopLoss, 1, m);
  if (!perLot) return undefined;
  return floorToStep((m.balance * riskPercent) / 100 / perLot, m.volumeStep);
}

function checkVolume(volume: number, m: MarketContext, policy: TradingPolicy, errors: string[]) {
  if (!(volume > 0)) errors.push("Volumul trebuie să fie mai mare ca 0.");
  if (volume < m.minVolume) errors.push(`Volum sub minimul simbolului (${m.minVolume}).`);
  if (volume > m.maxVolume) errors.push(`Volum peste maximul simbolului (${m.maxVolume}).`);
  if (Math.abs(floorToStep(volume, m.volumeStep) - volume) > 1e-9) errors.push(`Volumul trebuie să fie multiplu de ${m.volumeStep}.`);
  if (volume > policy.maxLot) errors.push(`Volum peste limita ta de ${policy.maxLot} loturi (MAX_LOT).`);
}

function checkRisk(c: Check, riskMoney: number | undefined, m: MarketContext, policy: TradingPolicy, label = "Risc la stop") {
  if (riskMoney === undefined) {
    c.warnings.push("Nu pot calcula riscul în bani pentru acest simbol (brokerul nu trimite valoarea tick-ului).");
    return;
  }
  c.riskMoney = round(riskMoney);
  c.riskPercent = m.balance > 0 ? round((riskMoney / m.balance) * 100) : undefined;
  if (c.riskPercent !== undefined && c.riskPercent > policy.maxRiskPercent)
    c.errors.push(`${label}: ${c.riskMoney} ${m.currency} (${c.riskPercent}% din sold), peste limita de ${policy.maxRiskPercent}% (MAX_RISK_PERCENT).`);
}

export function checkOpen(t: Extract<TradeIntent, { action: "open" }>, m: MarketContext, policy: TradingPolicy): Check {
  const c: Check = { errors: [], warnings: [] };
  const buy = t.side === "buy";
  const market = buy ? m.ask : m.bid;
  if (t.orderType === "market") {
    if (t.entryPrice !== undefined) c.warnings.push("La ordin market prețul de intrare e ignorat; se execută la prețul curent.");
    c.entry = market;
  } else {
    if (t.entryPrice === undefined || !(t.entryPrice > 0)) c.errors.push("Ordinele limit/stop au nevoie de entryPrice.");
    else {
      c.entry = t.entryPrice;
      const below = t.entryPrice < market;
      // Buy limit / sell stop sit below the market; buy stop / sell limit above.
      const mustBeBelow = (buy && t.orderType === "limit") || (!buy && t.orderType === "stop");
      if (mustBeBelow !== below)
        c.errors.push(`${buy ? "Buy" : "Sell"} ${t.orderType} trebuie să fie ${mustBeBelow ? "sub" : "peste"} prețul curent (${market}).`);
    }
  }
  checkVolume(t.volume, m, policy, c.errors);

  const e = c.entry;
  if (t.stopLoss === undefined) {
    if (policy.requireStopLoss) c.errors.push("Stop loss obligatoriu (REQUIRE_STOP_LOSS).");
    else c.warnings.push("Fără stop loss: pierderea nu e limitată.");
  } else if (e !== undefined) {
    if (buy ? t.stopLoss >= e : t.stopLoss <= e) c.errors.push(`Stop loss-ul trebuie să fie ${buy ? "sub" : "peste"} intrare (${e}).`);
    else checkRisk(c, moneyAtDistance(e, t.stopLoss, t.volume, m), m, policy);
  }
  if (t.takeProfit !== undefined && e !== undefined) {
    if (buy ? t.takeProfit <= e : t.takeProfit >= e) c.errors.push(`Take profit-ul trebuie să fie ${buy ? "peste" : "sub"} intrare (${e}).`);
    else {
      const reward = moneyAtDistance(e, t.takeProfit, t.volume, m); // approx.: uses the loss tick value
      if (reward !== undefined) c.rewardMoney = round(reward);
    }
  }
  if (t.stopLoss !== undefined && t.takeProfit !== undefined && e !== undefined) {
    const rr = Math.abs(t.takeProfit - e) / Math.abs(e - t.stopLoss);
    if (Number.isFinite(rr) && rr < 1) c.warnings.push(`Raport risc/câștig sub 1 (1:${round(rr)}).`);
  }
  return c;
}

export interface PositionSnapshot {
  id: string;
  symbol: string;
  side: Side;
  volume: number;
  openPrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function checkModifyPosition(
  t: Extract<TradeIntent, { action: "modify_position" }>,
  p: PositionSnapshot,
  m: MarketContext,
  policy: TradingPolicy,
): Check {
  const c: Check = { errors: [], warnings: [] };
  const buy = p.side === "buy";
  const current = buy ? m.bid : m.ask; // price the position would close at
  const sl = t.stopLoss ?? p.stopLoss;
  if (t.stopLoss === undefined && t.takeProfit === undefined) c.errors.push("Spune ce modific: stopLoss și/sau takeProfit.");
  if (sl === undefined && policy.requireStopLoss) c.errors.push("Stop loss obligatoriu (REQUIRE_STOP_LOSS).");
  if (t.stopLoss !== undefined && (buy ? t.stopLoss >= current : t.stopLoss <= current))
    c.errors.push(`Stop loss-ul trebuie să fie ${buy ? "sub" : "peste"} prețul curent (${current}).`);
  if (t.takeProfit !== undefined && (buy ? t.takeProfit <= current : t.takeProfit >= current))
    c.errors.push(`Take profit-ul trebuie să fie ${buy ? "peste" : "sub"} prețul curent (${current}).`);
  if (t.stopLoss !== undefined) {
    const lossSide = buy ? t.stopLoss < p.openPrice : t.stopLoss > p.openPrice;
    if (!lossSide) c.warnings.push("Stop loss-ul nou e pe profit (break-even sau mai bine).");
    else {
      const before = p.stopLoss !== undefined ? moneyAtDistance(p.openPrice, p.stopLoss, p.volume, m) : Infinity;
      const after = moneyAtDistance(p.openPrice, t.stopLoss, p.volume, m);
      // Only block widening the stop past the limit; tightening is always fine.
      if (after !== undefined && before !== undefined && after > before) checkRisk(c, after, m, policy, "Risc după mutarea stopului");
      else if (after !== undefined) {
        c.riskMoney = round(after);
        c.riskPercent = m.balance > 0 ? round((after / m.balance) * 100) : undefined;
      }
    }
  }
  return c;
}

export function checkClose(t: Extract<TradeIntent, { action: "close_position" }>, p: PositionSnapshot, m: MarketContext): Check {
  const c: Check = { errors: [], warnings: [] };
  if (t.volume !== undefined) {
    if (!(t.volume > 0) || t.volume > p.volume) c.errors.push(`Volumul de închis trebuie să fie între 0 și ${p.volume}.`);
    else if (Math.abs(floorToStep(t.volume, m.volumeStep) - t.volume) > 1e-9) c.errors.push(`Volumul trebuie să fie multiplu de ${m.volumeStep}.`);
    else if (t.volume < p.volume && p.volume - t.volume < m.minVolume - 1e-9) c.errors.push(`Ar rămâne sub volumul minim (${m.minVolume}); închide toată poziția.`);
  }
  return c;
}

/** MetaApi trade request body for a checked intent. */
export function tradeBody(t: TradeIntent, clientId: string): Record<string, unknown> {
  switch (t.action) {
    case "open": {
      const base = t.side === "buy" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";
      const actionType = t.orderType === "market" ? base : `${base}_${t.orderType.toUpperCase()}`;
      return clean({
        actionType,
        symbol: t.symbol,
        volume: t.volume,
        openPrice: t.orderType === "market" ? undefined : t.entryPrice,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        // MT5 comments are short; MetaApi shares the field with clientId.
        comment: t.comment?.slice(0, 12),
        clientId,
      });
    }
    case "modify_position":
      return clean({ actionType: "POSITION_MODIFY", positionId: t.positionId, stopLoss: t.stopLoss, takeProfit: t.takeProfit });
    case "modify_order":
      return clean({ actionType: "ORDER_MODIFY", orderId: t.orderId, openPrice: t.entryPrice, stopLoss: t.stopLoss, takeProfit: t.takeProfit });
    case "close_position":
      return t.volume !== undefined
        ? { actionType: "POSITION_PARTIAL", positionId: t.positionId, volume: t.volume }
        : { actionType: "POSITION_CLOSE_ID", positionId: t.positionId };
    case "cancel_order":
      return { actionType: "ORDER_CANCEL", orderId: t.orderId };
  }
}

function clean(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

export function describeIntent(t: TradeIntent): string {
  switch (t.action) {
    case "open": {
      const kind = t.orderType === "market" ? "MARKET" : `${t.orderType.toUpperCase()} la ${t.entryPrice}`;
      return `${t.side.toUpperCase()} ${t.volume} ${t.symbol} ${kind}, SL ${t.stopLoss ?? "—"}, TP ${t.takeProfit ?? "—"}`;
    }
    case "modify_position":
      return `Modific poziția ${t.positionId}: SL ${t.stopLoss ?? "neschimbat"}, TP ${t.takeProfit ?? "neschimbat"}`;
    case "modify_order":
      return `Modific ordinul ${t.orderId}: preț ${t.entryPrice ?? "neschimbat"}, SL ${t.stopLoss ?? "neschimbat"}, TP ${t.takeProfit ?? "neschimbat"}`;
    case "close_position":
      return t.volume !== undefined ? `Închid parțial ${t.volume} loturi din poziția ${t.positionId}` : `Închid poziția ${t.positionId}`;
    case "cancel_order":
      return `Anulez ordinul ${t.orderId}`;
  }
}
