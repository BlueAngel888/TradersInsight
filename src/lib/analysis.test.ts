import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, last, macd, rsi, sma } from "./indicators";
import { anchoredVwap, elliott, keyLevels, smartMoney, volumeProfile, zigzag } from "./advanced";
import { analyzeStructure } from "./structure";
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

describe("market structure", () => {
  const candles = demoCandles("AAPL");

  it("zigzag alternates highs and lows", () => {
    const p = zigzag(candles, 0.05);
    expect(p.length).toBeGreaterThan(3);
    for (let i = 1; i < p.length; i++) expect(p[i].type).not.toBe(p[i - 1].type);
  });

  it("detects a bullish fair value gap and BOS", () => {
    const mk = (o: number, h: number, l: number, c: number, i: number) => ({ time: i, open: o, high: h, low: l, close: c, volume: 100 });
    const bars = [
      mk(9.8, 10.5, 9.4, 10, -1), mk(10, 11, 9, 10, 0), mk(10, 12, 9.5, 11, 1), mk(11, 11.5, 9.8, 10, 2), mk(10, 10.5, 9, 9.5, 3),
      mk(9.5, 10, 8.5, 9, 4), mk(9, 9.8, 8.8, 9.5, 5), mk(9.5, 10.2, 9.2, 10, 6), mk(10, 10.4, 9.6, 10.2, 7),
      mk(10.2, 12.5, 10.1, 12.4, 8), mk(12.4, 14, 12.8, 13.8, 9), mk(13.8, 14.2, 13.5, 14, 10),
    ];
    const r = smartMoney(bars, 2);
    expect(r.events.some((e) => e.direction === "bullish")).toBe(true);
    expect(r.fairValueGaps.some((g) => g.direction === "bullish")).toBe(true);
  });

  it("volume profile value area contains the POC and ~70% of volume", () => {
    const vp = volumeProfile(candles)!;
    expect(vp.val).toBeLessThanOrEqual(vp.poc);
    expect(vp.vah).toBeGreaterThanOrEqual(vp.poc);
    const total = vp.bins.reduce((s, b) => s + b.volume, 0);
    const inside = vp.bins.filter((b) => b.low >= vp.val - 1e-9 && b.high <= vp.vah + 1e-9).reduce((s, b) => s + b.volume, 0);
    expect(inside / total).toBeGreaterThanOrEqual(0.7);
  });

  it("volume profile is null without volume", () => {
    expect(volumeProfile(candles.map((c) => ({ ...c, volume: 0 })))).toBeNull();
  });

  it("anchored VWAP of equal-volume flat bars equals the typical price", () => {
    const bars = Array.from({ length: 5 }, (_, i) => ({ time: i, open: 10, high: 12, low: 8, close: 10, volume: 50 }));
    expect(anchoredVwap(bars, 0)!.values[4]).toBeCloseTo(10);
  });

  it("enforces Elliott impulse rules", () => {
    const pts = (xs: number[]) =>
      xs.flatMap((p, i) => {
        const prev = xs[i - 1] ?? p;
        // Ten bars of linear move from the previous pivot to this one.
        return Array.from({ length: 10 }, (_, k) => {
          const v = prev + ((p - prev) * (k + 1)) / 10;
          return { time: i * 10 + k, open: v, high: v * 1.001, low: v * 0.999, close: v, volume: 1 };
        });
      });
    // 0 → 1 → 2 → 3 → 4 → 5 with wave 3 longest and no overlap, then a small pullback.
    const r = elliott(pts([100, 120, 108, 150, 135, 160, 152]));
    expect(["impulse-complete", "wave5"]).toContain(r.pattern);
    expect(r.direction).toBe("bullish");
  });

  it("key levels sit on the correct side of price", () => {
    const price = candles[candles.length - 1].close;
    const { support, resistance } = keyLevels(candles, volumeProfile(candles));
    support.forEach((l) => expect(l.price).toBeLessThan(price));
    resistance.forEach((l) => expect(l.price).toBeGreaterThan(price));
  });

  it("analyzeStructure returns observations for every system", () => {
    const s = analyzeStructure(candles);
    expect(s.signals.map((x) => x.id)).toEqual(["smc", "wyckoff", "elliott", "levels", "volumeProfile", "vwap"]);
    const fx = analyzeStructure(candles.map((c) => ({ ...c, volume: 0 })));
    expect(fx.signals.map((x) => x.id)).toEqual(["smc", "wyckoff", "elliott", "levels"]);
  });
});
