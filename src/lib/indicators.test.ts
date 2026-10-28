import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, last, macd, rsi, sma, supportResistance } from "./indicators";
import { analyzeFundamentals, analyzeTechnical, summarize } from "./analysis";
import { demoCandles } from "./demo";

describe("sma", () => {
  it("averages the trailing window and pads the start with null", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("seeds with the SMA and then smooths", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("rsi", () => {
  it("is 100 for a strictly rising series", () => {
    const up = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(last(rsi(up))).toBe(100);
  });
  it("is 0 for a strictly falling series", () => {
    const down = Array.from({ length: 30 }, (_, i) => 30 - i);
    expect(last(rsi(down))).toBe(0);
  });
  it("matches a known reference value", () => {
    // StockCharts' Wilder RSI example; their 70.53 rounds the averages
    // before dividing, so allow a small tolerance.
    const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(Math.abs((rsi(closes)[14] as number) - 70.53)).toBeLessThan(0.1);
  });
});

describe("macd", () => {
  it("histogram equals macd minus signal", () => {
    const values = demoCandles("TEST").map((c) => c.close);
    const m = macd(values);
    const i = values.length - 1;
    expect(m.histogram[i]).toBeCloseTo((m.macd[i] as number) - (m.signal[i] as number));
    expect(m.signal[33]).not.toBeNull();
    expect(m.signal[32]).toBeNull();
  });
});

describe("bollinger", () => {
  it("collapses to the price for a flat series", () => {
    const flat = new Array(25).fill(10);
    const bb = bollinger(flat);
    expect(last(bb.upper)).toBe(10);
    expect(last(bb.lower)).toBe(10);
  });
});

describe("atr", () => {
  it("equals the constant range when bars do not gap", () => {
    const n = 20;
    const close = new Array(n).fill(10);
    const out = atr(new Array(n).fill(11), new Array(n).fill(9), close);
    expect(last(out)).toBeCloseTo(2);
  });
});

describe("supportResistance", () => {
  it("splits levels around the current price", () => {
    const candles = demoCandles("AAPL");
    const price = candles[candles.length - 1].close;
    const { support, resistance } = supportResistance(candles.map((c) => c.high), candles.map((c) => c.low), price);
    support.forEach((s) => expect(s).toBeLessThan(price));
    resistance.forEach((r) => expect(r).toBeGreaterThan(price));
  });
});

describe("analysis", () => {
  it("produces a technical summary for every market", () => {
    for (const s of ["AAPL", "BTC-USD", "EURUSD=X"]) {
      const t = analyzeTechnical(demoCandles(s));
      expect(t.signals.map((x) => x.id)).toEqual(["trend", "rsi", "macd", "bollinger", "momentum"]);
      expect(t.summary.score).toBeGreaterThanOrEqual(-100);
      expect(t.summary.score).toBeLessThanOrEqual(100);
    }
  });

  it("rates strong fundamentals as positive", () => {
    const f = analyzeFundamentals({
      trailingPE: 12,
      revenueGrowth: 0.2,
      profitMargin: 0.25,
      returnOnEquity: 0.3,
      debtToEquity: 40,
      dividendYield: 0.03,
    });
    expect(f.summary.verdict).toBe("positive");
    expect(f.summary.positives).toBe(6);
  });

  it("summarizes an empty list as neutral", () => {
    expect(summarize([]).verdict).toBe("neutral");
  });
});
