// Pure technical-indicator functions. Every output array is aligned with the
// input: index i corresponds to input[i], with null where there is not yet
// enough history to compute a value.

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = toRsi();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi();
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line: Series = values.map((_, i) =>
    fastE[i] !== null && slowE[i] !== null ? (fastE[i] as number) - (slowE[i] as number) : null,
  );
  const start = line.findIndex((v) => v !== null);
  const signal: Series = new Array(values.length).fill(null);
  if (start >= 0) {
    const compact = line.slice(start) as number[];
    const sig = ema(compact, signalPeriod);
    sig.forEach((v, j) => (signal[start + j] = v));
  }
  const histogram: Series = line.map((v, i) =>
    v !== null && signal[i] !== null ? v - (signal[i] as number) : null,
  );
  return { macd: line, signal, histogram };
}

export interface BollingerResult {
  middle: Series;
  upper: Series;
  lower: Series;
}

export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = middle[i] as number;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - m) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { middle, upper, lower };
}

/** Wilder's Average True Range. */
export function atr(high: number[], low: number[], close: number[], period = 14): Series {
  const n = close.length;
  const out: Series = new Array(n).fill(null);
  if (n <= period) return out;
  const tr = close.map((_, i) =>
    i === 0
      ? high[0] - low[0]
      : Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])),
  );
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Support/resistance from swing points: a bar whose high (low) is the highest
 * (lowest) within `window` bars on each side. Nearby levels are merged.
 */
export function supportResistance(
  high: number[],
  low: number[],
  lastPrice: number,
  window = 5,
  maxLevels = 3,
): { support: number[]; resistance: number[] } {
  const pivots: number[] = [];
  for (let i = window; i < high.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (high[j] > high[i]) isHigh = false;
      if (low[j] < low[i]) isLow = false;
    }
    if (isHigh) pivots.push(high[i]);
    if (isLow) pivots.push(low[i]);
  }
  // Merge pivots within 1.5% of each other.
  pivots.sort((a, b) => a - b);
  const levels: number[] = [];
  let group: number[] = [];
  for (const p of pivots) {
    if (group.length && Math.abs(p - group[0]) / group[0] > 0.015) {
      levels.push(group.reduce((a, b) => a + b, 0) / group.length);
      group = [];
    }
    group.push(p);
  }
  if (group.length) levels.push(group.reduce((a, b) => a + b, 0) / group.length);

  const support = levels.filter((l) => l < lastPrice).sort((a, b) => b - a).slice(0, maxLevels);
  const resistance = levels.filter((l) => l > lastPrice).sort((a, b) => a - b).slice(0, maxLevels);
  return { support, resistance };
}

export function last(series: Series, offset = 0): number | null {
  for (let i = series.length - 1 - offset; i >= 0; i--) {
    if (series[i] !== null) return series[i];
  }
  return null;
}
