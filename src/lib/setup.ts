// Florin's SMC setup, as a pure detector (no network, no orders):
//   1. HTF trend: Daily, 4H and 1H must all agree (SMC structure).
//   2. LTF (1–15 min): a doji that swept liquidity (took out a recent low for a
//      bullish setup / high for a bearish one) and closed back inside.
//   3. An impulse leaves the doji in the HTF direction.
//   4. Fibonacci from the doji extreme to the impulse extreme; entry is a limit
//      at the 0.786 retracement.
//   5. Confluence: unmitigated order blocks, unfilled FVGs, confirmed S/R and
//      volume-profile nodes near the entry.
//   6. Stop beyond the doji (fib 1.0), targets at 1:2 and 1:3.

import { keyLevels, smartMoney, volumeProfile } from "./advanced";
import type { Candle } from "./types";

export type Direction = "bullish" | "bearish";

export interface SetupOptions {
  /** Max body / range for a candle to count as a doji. */
  dojiBodyRatio: number;
  /** Bars before the doji whose extreme it must sweep. */
  liquidityLookback: number;
  /** How far back on the LTF to look for the doji. */
  searchBars: number;
  /** Impulse must travel at least this many average ranges from the doji. */
  minImpulseRanges: number;
  fibLevel: number;
  rewardRatios: number[];
}

export const DEFAULT_SETUP_OPTIONS: SetupOptions = {
  dojiBodyRatio: 0.1,
  liquidityLookback: 20,
  searchBars: 120,
  minImpulseRanges: 3,
  fibLevel: 0.786,
  rewardRatios: [2, 3],
};

export interface HtfTrend {
  d1: Direction | "neutral";
  h4: Direction | "neutral";
  h1: Direction | "neutral";
  aligned: Direction | null;
}

export interface Setup {
  direction: Direction;
  status: "waiting" | "triggered" | "invalidated";
  dojiIndex: number;
  dojiTime: number;
  swept: number; // liquidity level taken by the doji wick
  fibFrom: number; // doji extreme (fib 1.0)
  fibTo: number; // impulse extreme (fib 0)
  entry: number;
  stopLoss: number;
  targets: { ratio: number; price: number }[];
  confluence: string[];
}

export interface SetupResult {
  trend: HtfTrend;
  setup: Setup | null;
  reason: string;
}

export function htfTrend(d1: Candle[], h4: Candle[], h1: Candle[]): HtfTrend {
  const t = (c: Candle[]) => (c.length >= 30 ? smartMoney(c).trend : "neutral");
  const trend = { d1: t(d1), h4: t(h4), h1: t(h1) };
  const all = [trend.d1, trend.h4, trend.h1];
  const aligned = all.every((x) => x === "bullish") ? "bullish" : all.every((x) => x === "bearish") ? "bearish" : null;
  return { ...trend, aligned };
}

const avgRange = (c: Candle[]) => c.reduce((s, x) => s + (x.high - x.low), 0) / (c.length || 1);

export function isDoji(c: Candle, ratio: number): boolean {
  const range = c.high - c.low;
  return range > 0 && Math.abs(c.close - c.open) <= range * ratio;
}

/** Most recent doji on `ltf` that swept liquidity in favour of `direction`. */
export function findLiquidityDoji(ltf: Candle[], direction: Direction, o: SetupOptions) {
  const start = Math.max(o.liquidityLookback, ltf.length - o.searchBars);
  for (let i = ltf.length - 2; i >= start; i--) {
    const c = ltf[i];
    if (!isDoji(c, o.dojiBodyRatio)) continue;
    const prior = ltf.slice(i - o.liquidityLookback, i);
    if (direction === "bullish") {
      const level = Math.min(...prior.map((p) => p.low));
      if (c.low < level && Math.min(c.open, c.close) > level) return { index: i, swept: level };
    } else {
      const level = Math.max(...prior.map((p) => p.high));
      if (c.high > level && Math.max(c.open, c.close) < level) return { index: i, swept: level };
    }
  }
  return null;
}

export function detectSetup(
  frames: { d1: Candle[]; h4: Candle[]; h1: Candle[]; ltf: Candle[] },
  options: Partial<SetupOptions> = {},
): SetupResult {
  const o = { ...DEFAULT_SETUP_OPTIONS, ...options };
  const trend = htfTrend(frames.d1, frames.h4, frames.h1);
  if (!trend.aligned) return { trend, setup: null, reason: "Trendul nu e aliniat pe Daily, 4H și 1H." };
  const dir = trend.aligned;
  const ltf = frames.ltf;
  if (ltf.length < o.liquidityLookback + 10) return { trend, setup: null, reason: "Prea puține lumânări pe timeframe-ul mic." };

  const doji = findLiquidityDoji(ltf, dir, o);
  if (!doji) return { trend, setup: null, reason: "Niciun doji care să fi luat lichiditatea." };

  const d = ltf[doji.index];
  const after = ltf.slice(doji.index + 1);
  const bull = dir === "bullish";
  const fibFrom = bull ? d.low : d.high;
  // Impulse extreme and where it happened.
  let extIdx = 0;
  after.forEach((c, k) => {
    if (bull ? c.high > after[extIdx].high : c.low < after[extIdx].low) extIdx = k;
  });
  const fibTo = bull ? after[extIdx].high : after[extIdx].low;
  const move = Math.abs(fibTo - fibFrom);
  if (move < avgRange(ltf.slice(-50)) * o.minImpulseRanges)
    return { trend, setup: null, reason: "Prețul nu a plecat încă suficient din doji." };

  const entry = bull ? fibTo - move * o.fibLevel : fibTo + move * o.fibLevel;
  const stopLoss = fibFrom;
  const risk = Math.abs(entry - stopLoss);
  const targets = o.rewardRatios.map((ratio) => ({ ratio, price: bull ? entry + risk * ratio : entry - risk * ratio }));

  // Status after the impulse extreme.
  const pullback = after.slice(extIdx + 1);
  let status: Setup["status"] = "waiting";
  for (const c of pullback) {
    if (bull ? c.low <= stopLoss : c.high >= stopLoss) { status = "invalidated"; break; }
    if (bull ? c.low <= entry : c.high >= entry) status = "triggered";
  }

  const confluence: string[] = [];
  const tol = avgRange(ltf.slice(-50)) * 1.5;
  const near = (p: number) => Math.abs(p - entry) <= tol;
  const overlaps = (z: { top: number; bottom: number }) => entry <= z.top + tol && entry >= z.bottom - tol;
  const smc = smartMoney(ltf);
  if (smc.orderBlocks.some((z) => z.direction === dir && overlaps(z))) confluence.push("Order block în zona de intrare");
  if (smc.fairValueGaps.some((z) => z.direction === dir && overlaps(z))) confluence.push("FVG în zona de intrare");
  const vp = volumeProfile(ltf);
  if (vp && near(vp.poc)) confluence.push("POC (volume profile) lângă intrare");
  else if (vp && (near(vp.val) || near(vp.vah) || vp.hvn.some(near))) confluence.push("Nod de volum lângă intrare");
  const lv = keyLevels(ltf, vp);
  const sideLevels = bull ? lv.support : lv.resistance;
  const confirmed = sideLevels.find((l) => l.strength >= 2 && near(l.price));
  if (confirmed) confluence.push(`${bull ? "Suport" : "Rezistență"} confirmat(ă) (${confirmed.touches} atingeri)`);

  return {
    trend,
    reason: status === "invalidated" ? "Setup invalidat: prețul a trecut de doji." : status === "triggered" ? "Prețul a atins 0.786." : "Aștept retragerea la 0.786.",
    setup: {
      direction: dir,
      status,
      dojiIndex: doji.index,
      dojiTime: d.time,
      swept: doji.swept,
      fibFrom,
      fibTo,
      entry,
      stopLoss,
      targets,
      confluence,
    },
  };
}

/**
 * Position size so that hitting the stop loses `riskPercent` of the balance.
 * `valuePerUnitMove` is the account-currency P/L of 1 lot for a 1.0 price move
 * (e.g. 100000 for EURUSD on a USD account). Rounded down to the lot step.
 */
export function positionSize(balance: number, riskPercent: number, entry: number, stopLoss: number, valuePerUnitMove: number, lotStep = 0.01) {
  const riskMoney = (balance * riskPercent) / 100;
  const perLot = Math.abs(entry - stopLoss) * valuePerUnitMove;
  if (perLot <= 0) return 0;
  const lots = Math.floor(riskMoney / perLot / lotStep + 1e-9) * lotStep;
  return Math.round(lots * 100) / 100;
}
