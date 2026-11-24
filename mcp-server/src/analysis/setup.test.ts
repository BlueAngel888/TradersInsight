import { describe, expect, it } from "vitest";
import { detectSetup, findLiquidityDoji, htfTrend, isDoji, positionSize, DEFAULT_SETUP_OPTIONS } from "./setup";
import type { Candle } from "./types";

const bar = (i: number, open: number, high: number, low: number, close: number): Candle => ({ time: i * 60, open, high, low, close, volume: 100 });

/** Zig-zag trend: higher highs and higher lows (or the mirror). */
function trending(dir: 1 | -1, n = 150): Candle[] {
  const close = (i: number) => 100 + dir * i * 0.3 + 3 * Math.sin(i / 2);
  return Array.from({ length: n }, (_, i) => {
    const o = close(i - 0.5);
    const c = close(i);
    return bar(i, o, Math.max(o, c) + 0.1, Math.min(o, c) - 0.1, c);
  });
}

/** LTF: drift down to 100, a doji sweeping the low, then a strong rally to 110. */
function bullishLtf(pullbackTo?: number): Candle[] {
  const c: Candle[] = [];
  let p = 104;
  for (let i = 0; i < 30; i++) {
    const o = p;
    p -= 0.12;
    c.push(bar(i, o, o + 0.1, p - 0.1, p));
  }
  const lowBefore = Math.min(...c.slice(-20).map((x) => x.low));
  c.push(bar(30, p, p + 0.3, lowBefore - 0.5, p + 0.01)); // doji sweeping liquidity
  const dojiLow = lowBefore - 0.5;
  for (let i = 31; i < 45; i++) {
    const o = p;
    p += 0.6;
    c.push(bar(i, o, p + 0.05, o - 0.05, p));
  }
  if (pullbackTo !== undefined) {
    const o = p;
    c.push(bar(45, o, o + 0.05, pullbackTo, pullbackTo + 0.1));
  }
  return Object.assign(c, { dojiLow });
}

describe("isDoji", () => {
  it("accepts a tiny body and rejects a full candle", () => {
    expect(isDoji(bar(0, 1, 1.5, 0.5, 1.01), 0.1)).toBe(true);
    expect(isDoji(bar(0, 1, 1.5, 0.5, 1.4), 0.1)).toBe(false);
  });
});

describe("htfTrend", () => {
  it("aligns only when all three timeframes agree", () => {
    const up = trending(1);
    expect(htfTrend(up, up, up).aligned).toBe("bullish");
    expect(htfTrend(up, up, trending(-1)).aligned).toBeNull();
  });
});

describe("findLiquidityDoji", () => {
  it("finds the doji that swept the recent low", () => {
    const ltf = bullishLtf();
    expect(findLiquidityDoji(ltf, "bullish", DEFAULT_SETUP_OPTIONS)?.index).toBe(30);
  });
});

describe("detectSetup", () => {
  const up = trending(1);
  it("places the entry at the 0.786 retracement with 1:2 and 1:3 targets", () => {
    const ltf = bullishLtf();
    const r = detectSetup({ d1: up, h4: up, h1: up, ltf });
    expect(r.setup?.direction).toBe("bullish");
    const s = r.setup!;
    expect(s.status).toBe("waiting");
    expect(s.entry).toBeCloseTo(s.fibTo - (s.fibTo - s.fibFrom) * 0.786);
    expect(s.stopLoss).toBe(s.fibFrom);
    const risk = s.entry - s.stopLoss;
    expect(s.targets.map((t) => t.price)).toEqual([s.entry + 2 * risk, s.entry + 3 * risk]);
  });
  it("marks the setup triggered when price reaches the entry", () => {
    const first = detectSetup({ d1: up, h4: up, h1: up, ltf: bullishLtf() }).setup!;
    const r = detectSetup({ d1: up, h4: up, h1: up, ltf: bullishLtf(first.entry - 0.05) });
    expect(r.setup?.status).toBe("triggered");
  });
  it("marks it invalidated when price trades through the doji", () => {
    const first = detectSetup({ d1: up, h4: up, h1: up, ltf: bullishLtf() }).setup!;
    const r = detectSetup({ d1: up, h4: up, h1: up, ltf: bullishLtf(first.stopLoss - 0.1) });
    expect(r.setup?.status).toBe("invalidated");
  });
  it("does nothing when the HTF trend is not aligned", () => {
    const r = detectSetup({ d1: up, h4: trending(-1), h1: up, ltf: bullishLtf() });
    expect(r.setup).toBeNull();
  });
});

describe("positionSize", () => {
  it("sizes so the stop loses the chosen percent", () => {
    // 10k balance, 1% = 100 USD; 50 pips on EURUSD = 500 USD/lot -> 0.2 lots
    expect(positionSize(10000, 1, 1.1, 1.095, 100000)).toBe(0.2);
  });
});
