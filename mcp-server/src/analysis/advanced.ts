// Market-structure analysis: zigzag pivots, Smart Money Concepts, Wyckoff,
// Elliott waves, volume profile, VWAP and key support/resistance levels.
// These methods are partly discretionary; the functions below implement
// simple, explicit rules so the output is reproducible, and the UI presents
// them as estimates.
import { atr, last } from "./indicators";
import type { Candle } from "./types";

export interface Pivot {
  index: number;
  price: number;
  type: "H" | "L";
}

/**
 * Zigzag pivots: a new pivot is confirmed once price reverses by at least
 * `threshold` (fraction, e.g. 0.05) from the running extreme.
 */
export function zigzag(candles: Candle[], threshold: number): Pivot[] {
  const pivots: Pivot[] = [];
  if (candles.length < 2) return pivots;
  let dir: "up" | "down" | null = null;
  let extIdx = 0;
  let extHigh = candles[0].high;
  let extLow = candles[0].low;
  let lowIdx = 0;
  let highIdx = 0;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (dir === null) {
      if (c.high > extHigh) {
        extHigh = c.high;
        highIdx = i;
      }
      if (c.low < extLow) {
        extLow = c.low;
        lowIdx = i;
      }
      if (extHigh / extLow - 1 >= threshold) {
        // Whichever extreme came first is the first pivot.
        if (lowIdx < highIdx) {
          pivots.push({ index: lowIdx, price: extLow, type: "L" });
          dir = "up";
          extIdx = highIdx;
        } else {
          pivots.push({ index: highIdx, price: extHigh, type: "H" });
          dir = "down";
          extIdx = lowIdx;
        }
      }
      continue;
    }
    if (dir === "up") {
      if (c.high >= candles[extIdx].high) extIdx = i;
      else if (c.low <= candles[extIdx].high * (1 - threshold)) {
        pivots.push({ index: extIdx, price: candles[extIdx].high, type: "H" });
        dir = "down";
        extIdx = i;
      }
    } else {
      if (c.low <= candles[extIdx].low) extIdx = i;
      else if (c.high >= candles[extIdx].low * (1 + threshold)) {
        pivots.push({ index: extIdx, price: candles[extIdx].low, type: "L" });
        dir = "up";
        extIdx = i;
      }
    }
  }
  return pivots;
}

/** Zigzag threshold scaled to the asset's volatility (3x daily ATR, min 2%). */
export function adaptiveThreshold(candles: Candle[]): number {
  const a = last(atr(candles.map((c) => c.high), candles.map((c) => c.low), candles.map((c) => c.close)));
  const price = candles[candles.length - 1].close;
  return Math.max(a !== null ? (3 * a) / price : 0.05, 0.02);
}

function atrValue(candles: Candle[]): number {
  return (
    last(atr(candles.map((c) => c.high), candles.map((c) => c.low), candles.map((c) => c.close))) ??
    candles[candles.length - 1].close * 0.02
  );
}

// ---------------------------------------------------------------------------
// Smart Money Concepts

export interface StructureEvent {
  index: number;
  kind: "BOS" | "CHoCH";
  direction: "bullish" | "bearish";
  level: number;
}

export interface Zone {
  index: number;
  top: number;
  bottom: number;
  direction: "bullish" | "bearish";
}

export interface SmcResult {
  trend: "bullish" | "bearish" | "neutral";
  events: StructureEvent[];
  lastEvent: StructureEvent | null;
  orderBlocks: Zone[]; // unmitigated, most recent first
  fairValueGaps: Zone[]; // unfilled, most recent first
  range: { high: number; low: number; equilibrium: number };
  zone: "premium" | "discount" | "equilibrium";
}

/** Swing points: highest high / lowest low within `w` bars on each side. */
export function swingPoints(candles: Candle[], w = 3): Pivot[] {
  const out: Pivot[] = [];
  for (let i = w; i < candles.length - w; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) out.push({ index: i, price: candles[i].high, type: "H" });
    if (isLow) out.push({ index: i, price: candles[i].low, type: "L" });
  }
  return out;
}

export function smartMoney(candles: Candle[], w = 3): SmcResult {
  const swings = swingPoints(candles, w);
  const events: StructureEvent[] = [];
  const blocks: Zone[] = [];
  let trend: SmcResult["trend"] = "neutral";
  let lastHigh: Pivot | null = null;
  let lastLow: Pivot | null = null;
  let si = 0;

  for (let i = 0; i < candles.length; i++) {
    // A swing at index k is only known w bars later.
    while (si < swings.length && swings[si].index + w <= i) {
      const s = swings[si++];
      if (s.type === "H") lastHigh = s;
      else lastLow = s;
    }
    const c = candles[i];
    if (lastHigh && c.close > lastHigh.price) {
      events.push({ index: i, kind: trend === "bearish" ? "CHoCH" : "BOS", direction: "bullish", level: lastHigh.price });
      // Order block: last bearish candle of the leg that broke structure.
      for (let j = i - 1; j >= Math.max(0, (lastLow?.index ?? i - 20) - 1); j--) {
        if (candles[j].close < candles[j].open) {
          blocks.push({ index: j, top: candles[j].high, bottom: candles[j].low, direction: "bullish" });
          break;
        }
      }
      trend = "bullish";
      lastHigh = null;
    } else if (lastLow && c.close < lastLow.price) {
      events.push({ index: i, kind: trend === "bullish" ? "CHoCH" : "BOS", direction: "bearish", level: lastLow.price });
      for (let j = i - 1; j >= Math.max(0, (lastHigh?.index ?? i - 20) - 1); j--) {
        if (candles[j].close > candles[j].open) {
          blocks.push({ index: j, top: candles[j].high, bottom: candles[j].low, direction: "bearish" });
          break;
        }
      }
      trend = "bearish";
      lastLow = null;
    }
  }

  // A zone is mitigated once price closes through its far side.
  const mitigated = (z: Zone, from: number) => {
    for (let k = from; k < candles.length; k++) {
      if (z.direction === "bullish" && candles[k].close < z.bottom) return true;
      if (z.direction === "bearish" && candles[k].close > z.top) return true;
    }
    return false;
  };
  const orderBlocks = blocks
    .filter((b) => !mitigated(b, b.index + 1))
    .sort((a, b) => b.index - a.index)
    .slice(0, 4);

  const gaps: Zone[] = [];
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    let gap: Zone | null = null;
    if (c.low > a.high) gap = { index: i - 1, top: c.low, bottom: a.high, direction: "bullish" };
    if (c.high < a.low) gap = { index: i - 1, top: a.low, bottom: c.high, direction: "bearish" };
    if (!gap) continue;
    // Filled once price trades back through the whole gap.
    let filled = false;
    for (let k = i + 1; k < candles.length && !filled; k++) {
      if (gap.direction === "bullish" && candles[k].low <= gap.bottom) filled = true;
      if (gap.direction === "bearish" && candles[k].high >= gap.top) filled = true;
    }
    if (!filled) gaps.push(gap);
  }
  const fairValueGaps = gaps.sort((a, b) => b.index - a.index).slice(0, 4);

  // Dealing range: extremes of the last 60 bars.
  const recent = candles.slice(-60);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const equilibrium = (high + low) / 2;
  const price = candles[candles.length - 1].close;
  const pos = (price - low) / (high - low || 1);
  const zone = pos > 0.55 ? "premium" : pos < 0.45 ? "discount" : "equilibrium";

  return {
    trend,
    events,
    lastEvent: events[events.length - 1] ?? null,
    orderBlocks,
    fairValueGaps,
    range: { high, low, equilibrium },
    zone,
  };
}

// ---------------------------------------------------------------------------
// Wyckoff

export type WyckoffPhase =
  | "accumulation"
  | "distribution"
  | "markup"
  | "markdown"
  | "reaccumulation"
  | "redistribution";

export interface WyckoffResult {
  phase: WyckoffPhase;
  event: "spring" | "upthrust" | "sos" | "sow" | null;
  rangeHigh: number;
  rangeLow: number;
  inRange: boolean;
  priorTrend: "up" | "down";
  /** Average volume on up days vs. down days inside the range (>1 = demand dominates). */
  demandRatio: number | null;
}

export function wyckoff(candles: Candle[]): WyckoffResult | null {
  if (candles.length < 130) return null;
  const n = candles.length;
  const rangeBars = candles.slice(n - 60, n - 5);
  const rangeHigh = Math.max(...rangeBars.map((c) => c.high));
  const rangeLow = Math.min(...rangeBars.map((c) => c.low));
  const price = candles[n - 1].close;
  const a = atrValue(candles);
  // A trading range is narrow relative to volatility; otherwise price is trending.
  const inRange = (rangeHigh - rangeLow) / a < 14;

  const before = candles[n - 120].close;
  const rangeStart = candles[n - 60].close;
  const priorTrend = rangeStart >= before ? "up" : "down";

  const ups = rangeBars.filter((c) => c.close > c.open);
  const downs = rangeBars.filter((c) => c.close < c.open);
  const avg = (xs: Candle[]) => xs.reduce((s, c) => s + c.volume, 0) / (xs.length || 1);
  const demandRatio = avg(downs) > 0 ? avg(ups) / avg(downs) : null;

  const lastBars = candles.slice(n - 5);
  const dippedBelow = lastBars.some((c) => c.low < rangeLow);
  const pokedAbove = lastBars.some((c) => c.high > rangeHigh);

  let phase: WyckoffPhase;
  let event: WyckoffResult["event"] = null;

  if (price > rangeHigh) {
    event = "sos";
    phase = "markup";
  } else if (price < rangeLow) {
    event = "sow";
    phase = "markdown";
  } else if (!inRange) {
    phase = price > rangeStart ? "markup" : "markdown";
  } else if (priorTrend === "down") {
    phase = "accumulation";
    if (dippedBelow) event = "spring";
  } else {
    // A range after an uptrend is distribution unless demand still dominates.
    phase = demandRatio !== null && demandRatio > 1.15 ? "reaccumulation" : "distribution";
    if (pokedAbove) event = "upthrust";
  }
  if (phase === "accumulation" && demandRatio !== null && demandRatio < 0.85) phase = "redistribution";

  return { phase, event, rangeHigh, rangeLow, inRange, priorTrend, demandRatio };
}

// ---------------------------------------------------------------------------
// Elliott waves

export interface WaveLabel {
  index: number;
  price: number;
  label: string;
}

export interface ElliottResult {
  pattern: "impulse-complete" | "wave5" | "wave3" | "correction" | "none";
  direction: "bullish" | "bearish";
  labels: WaveLabel[];
  target: number | null;
  invalidation: number | null;
}

/** Checks Elliott impulse rules on pivots p[0..k] for direction sign s (+1 up, -1 down). */
function impulseValid(p: number[], s: number): boolean {
  const w = (a: number, b: number) => s * (p[b] - p[a]);
  if (p.length >= 3 && !(w(0, 1) > 0 && s * (p[2] - p[0]) > 0)) return false; // wave 2 stays above wave 1 start
  if (p.length >= 4 && !(s * (p[3] - p[1]) > 0)) return false; // wave 3 exceeds wave 1 end
  if (p.length >= 5 && !(s * (p[4] - p[1]) > 0)) return false; // wave 4 does not overlap wave 1
  if (p.length >= 6) {
    const w1 = w(0, 1);
    const w3 = w(2, 3);
    const w5 = w(4, 5);
    if (w3 < w1 && w3 < w5) return false; // wave 3 is never the shortest
    if (w5 <= 0) return false;
  }
  return true;
}

export function elliott(candles: Candle[]): ElliottResult {
  const pivots = zigzag(candles, adaptiveThreshold(candles));
  const price = candles[candles.length - 1].close;
  const none: ElliottResult = { pattern: "none", direction: "bullish", labels: [], target: null, invalidation: null };
  if (pivots.length < 3) return none;

  const label = (ps: Pivot[], names: string[]): WaveLabel[] =>
    ps.map((p, i) => ({ index: p.index, price: p.price, label: names[i] }));

  for (const s of [1, -1]) {
    const startType = s === 1 ? "L" : "H";
    const direction = s === 1 ? "bullish" : "bearish";

    // Completed five-wave impulse ending at the last pivot.
    if (pivots.length >= 6) {
      const ps = pivots.slice(-6);
      if (ps[0].type === startType && impulseValid(ps.map((p) => p.price), s)) {
        const len = Math.abs(ps[5].price - ps[0].price);
        return {
          pattern: "impulse-complete",
          direction,
          labels: label(ps, ["0", "1", "2", "3", "4", "5"]),
          // Typical ABC retracement: 38.2% of the whole impulse.
          target: ps[5].price - s * 0.382 * len,
          invalidation: ps[5].price,
        };
      }
    }
    // Waves 1-4 complete, wave 5 in progress from the last pivot.
    if (pivots.length >= 5) {
      const ps = pivots.slice(-5);
      const p = ps.map((x) => x.price);
      if (ps[0].type === startType && impulseValid(p, s) && s * (price - p[4]) > 0) {
        return {
          pattern: "wave5",
          direction,
          labels: label(ps, ["0", "1", "2", "3", "4"]),
          // Wave 5 often equals wave 1 in length.
          target: p[4] + (p[1] - p[0]),
          invalidation: p[4],
        };
      }
    }
    // Waves 1-2 complete, wave 3 in progress and already beyond wave 1.
    if (pivots.length >= 3) {
      const ps = pivots.slice(-3);
      const p = ps.map((x) => x.price);
      if (ps[0].type === startType && impulseValid(p, s) && s * (price - p[1]) > 0) {
        return {
          pattern: "wave3",
          direction,
          labels: label(ps, ["0", "1", "2"]),
          // Wave 3 commonly extends to 1.618 x wave 1.
          target: p[2] + 1.618 * (p[1] - p[0]),
          invalidation: p[2],
        };
      }
    }
  }

  // Otherwise look for a corrective A-B-C: B does not exceed the start,
  // C extends beyond A (complete) or is still forming.
  const abc = (ps: Pivot[]): ElliottResult | null => {
    const s = ps[0].type === "H" ? -1 : 1; // +1: upward correction, -1: downward
    const p = ps.map((x) => x.price);
    if (!(s * (p[1] - p[0]) > 0 && s * (p[2] - p[1]) < 0 && s * (p[2] - p[0]) > 0)) return null;
    if (p.length === 4 && !(s * (p[3] - p[1]) > 0)) return null;
    return {
      pattern: "correction",
      direction: s === 1 ? "bullish" : "bearish",
      labels: label(ps, ["", "A", "B", "C"].slice(0, ps.length)),
      target: p.length === 3 ? p[2] + (p[1] - p[0]) : null, // C = A
      invalidation: p.length === 3 ? p[0] : null,
    };
  };
  return (pivots.length >= 4 ? abc(pivots.slice(-4)) : null) ?? abc(pivots.slice(-3)) ?? none;
}

// ---------------------------------------------------------------------------
// Volume profile

export interface VolumeBin {
  low: number;
  high: number;
  volume: number;
}

export interface VolumeProfile {
  bins: VolumeBin[];
  poc: number;
  vah: number;
  val: number;
  hvn: number[]; // high-volume nodes other than the POC
}

export function volumeProfile(candles: Candle[], lookback = 120, binCount = 24): VolumeProfile | null {
  const data = candles.slice(-lookback);
  const total = data.reduce((s, c) => s + c.volume, 0);
  if (total <= 0) return null;
  const lo = Math.min(...data.map((c) => c.low));
  const hi = Math.max(...data.map((c) => c.high));
  const step = (hi - lo) / binCount || 1;
  const bins: VolumeBin[] = Array.from({ length: binCount }, (_, i) => ({
    low: lo + i * step,
    high: lo + (i + 1) * step,
    volume: 0,
  }));
  // Spread each bar's volume evenly over the price range it traded.
  for (const c of data) {
    const range = c.high - c.low;
    for (const b of bins) {
      const overlap = Math.min(c.high, b.high) - Math.max(c.low, b.low);
      if (range <= 0) {
        if (c.close >= b.low && c.close <= b.high) b.volume += c.volume;
      } else if (overlap > 0) b.volume += (c.volume * overlap) / range;
    }
  }
  let pocIdx = 0;
  bins.forEach((b, i) => {
    if (b.volume > bins[pocIdx].volume) pocIdx = i;
  });
  // Value area: grow from the POC towards the heavier side until 70% of volume.
  let lowIdx = pocIdx;
  let highIdx = pocIdx;
  let acc = bins[pocIdx].volume;
  const binTotal = bins.reduce((s, b) => s + b.volume, 0);
  while (acc < binTotal * 0.7 && (lowIdx > 0 || highIdx < binCount - 1)) {
    const below = lowIdx > 0 ? bins[lowIdx - 1].volume : -1;
    const above = highIdx < binCount - 1 ? bins[highIdx + 1].volume : -1;
    if (above >= below) acc += bins[++highIdx].volume;
    else acc += bins[--lowIdx].volume;
  }
  const mid = (b: VolumeBin) => (b.low + b.high) / 2;
  const hvn = bins
    .map((b, i) => ({ b, i }))
    .filter(
      ({ b, i }) =>
        i !== pocIdx &&
        i > 0 &&
        i < binCount - 1 &&
        b.volume > bins[i - 1].volume &&
        b.volume > bins[i + 1].volume &&
        b.volume > (binTotal / binCount) * 1.2,
    )
    .map(({ b }) => mid(b));
  return { bins, poc: mid(bins[pocIdx]), vah: bins[highIdx].high, val: bins[lowIdx].low, hvn };
}

// ---------------------------------------------------------------------------
// VWAP

export interface VwapResult {
  values: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

/** VWAP anchored at `anchor`, with ±1 standard deviation bands. */
export function anchoredVwap(candles: Candle[], anchor: number): VwapResult | null {
  const values: (number | null)[] = new Array(candles.length).fill(null);
  const upper = [...values];
  const lower = [...values];
  let pv = 0;
  let vol = 0;
  let pv2 = 0;
  for (let i = Math.max(0, anchor); i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    pv2 += tp * tp * c.volume;
    vol += c.volume;
    if (vol > 0) {
      const v = pv / vol;
      const sd = Math.sqrt(Math.max(pv2 / vol - v * v, 0));
      values[i] = v;
      upper[i] = v + sd;
      lower[i] = v - sd;
    }
  }
  return vol > 0 ? { values, upper, lower } : null;
}

/** Rolling VWAP over the last `period` bars. */
export function rollingVwap(candles: Candle[], period = 20): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    let pv = 0;
    let vol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      pv += ((c.high + c.low + c.close) / 3) * c.volume;
      vol += c.volume;
    }
    return vol > 0 ? pv / vol : null;
  });
}

// ---------------------------------------------------------------------------
// Key support / resistance

export interface KeyLevel {
  price: number;
  touches: number;
  strength: 1 | 2 | 3;
  kind: "support" | "resistance";
}

/**
 * Clusters swing highs/lows (and volume-profile nodes, if given) into levels.
 * Strength grows with the number of touches and volume confirmation.
 */
export function keyLevels(candles: Candle[], profile: VolumeProfile | null, maxPerSide = 3): {
  support: KeyLevel[];
  resistance: KeyLevel[];
} {
  const data = candles.slice(-250);
  const price = data[data.length - 1].close;
  const tolerance = Math.max(atrValue(data) * 0.5, price * 0.005);
  const points = swingPoints(data, 4).map((p) => p.price);

  points.sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const p of points) {
    const lastCluster = clusters[clusters.length - 1];
    if (lastCluster && p - lastCluster[lastCluster.length - 1] <= tolerance) lastCluster.push(p);
    else clusters.push([p]);
  }
  const volumeNodes = profile ? [profile.poc, ...profile.hvn] : [];
  const levels = clusters.map((cl) => {
    const lvl = cl.reduce((a, b) => a + b, 0) / cl.length;
    const volumeConfirmed = volumeNodes.some((v) => Math.abs(v - lvl) <= tolerance * 1.5);
    const score = cl.length + (volumeConfirmed ? 1 : 0);
    return { price: lvl, touches: cl.length, strength: (score >= 4 ? 3 : score >= 2 ? 2 : 1) as 1 | 2 | 3 };
  });

  const pick = (kind: KeyLevel["kind"]) =>
    levels
      .filter((l) => (kind === "support" ? l.price < price : l.price > price))
      .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
      .slice(0, maxPerSide)
      .map((l) => ({ ...l, kind }));

  return { support: pick("support"), resistance: pick("resistance") };
}
