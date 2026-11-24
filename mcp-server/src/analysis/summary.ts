// Compact, model-friendly summary of one timeframe: the numbers Claude needs
// to reason about a chart without sending hundreds of raw candles.

import { keyLevels, smartMoney, volumeProfile } from "./advanced";
import { atr, ema, last, rsi } from "./indicators";
import type { Candle } from "./types";

const r = (x: number | null | undefined, digits: number) => (x === null || x === undefined || !Number.isFinite(x) ? null : Number(x.toFixed(digits)));

export function summarizeFrame(candles: Candle[], digits = 5) {
  if (candles.length < 30) return { error: "Prea puține lumânări pentru analiză.", bars: candles.length };
  const close = candles.map((c) => c.close);
  const lastBar = candles[candles.length - 1];
  const smc = smartMoney(candles);
  const vp = volumeProfile(candles);
  const levels = keyLevels(candles, vp);
  const e20 = last(ema(close, 20));
  const e50 = last(ema(close, 50));
  const e200 = candles.length >= 200 ? last(ema(close, 200)) : null;
  const price = lastBar.close;
  const emaStack =
    e20 !== null && e50 !== null
      ? price > e20 && e20 > e50 && (e200 === null || e50 > e200)
        ? "bullish (preț > EMA20 > EMA50" + (e200 !== null ? " > EMA200)" : ")")
        : price < e20 && e20 < e50 && (e200 === null || e50 < e200)
          ? "bearish (preț < EMA20 < EMA50" + (e200 !== null ? " < EMA200)" : ")")
          : "amestecat"
      : null;
  const zone = (z: { top: number; bottom: number; direction: string; index: number }) => ({
    direction: z.direction,
    top: r(z.top, digits),
    bottom: r(z.bottom, digits),
    time: new Date(candles[z.index].time * 1000).toISOString(),
  });
  return {
    bars: candles.length,
    lastTime: new Date(lastBar.time * 1000).toISOString(),
    lastClose: r(price, digits),
    smcTrend: smc.trend,
    lastStructure: smc.lastEvent ? { kind: smc.lastEvent.kind, direction: smc.lastEvent.direction, level: r(smc.lastEvent.level, digits) } : null,
    premiumDiscount: smc.zone,
    range: { high: r(smc.range.high, digits), low: r(smc.range.low, digits), equilibrium: r(smc.range.equilibrium, digits) },
    orderBlocks: smc.orderBlocks.slice(0, 3).map(zone),
    fairValueGaps: smc.fairValueGaps.slice(0, 3).map(zone),
    ema: { ema20: r(e20, digits), ema50: r(e50, digits), ema200: r(e200, digits), stack: emaStack },
    rsi14: r(last(rsi(close, 14)), 1),
    atr14: r(last(atr(candles.map((c) => c.high), candles.map((c) => c.low), close, 14)), digits),
    volumeProfile: vp ? { poc: r(vp.poc, digits), vah: r(vp.vah, digits), val: r(vp.val, digits) } : null,
    support: levels.support.map((l) => ({ price: r(l.price, digits), touches: l.touches, strength: l.strength })),
    resistance: levels.resistance.map((l) => ({ price: r(l.price, digits), touches: l.touches, strength: l.strength })),
  };
}
