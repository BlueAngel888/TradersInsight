import { atr, bollinger, last, macd, rsi, sma, supportResistance } from "./indicators";
import type { Candle, Fundamentals } from "./types";

export type Verdict = "positive" | "negative" | "neutral";

export interface Signal {
  id: string;
  name: string;
  value: string;
  verdict: Verdict;
  /** Plain-language explanation for beginners. */
  simple: string;
  /** Technical explanation for intermediate/advanced users. */
  detail: string;
}

export interface Summary {
  verdict: Verdict;
  score: number; // -100..100
  positives: number;
  negatives: number;
  neutrals: number;
}

export interface TechnicalAnalysis {
  signals: Signal[];
  summary: Summary;
  levels: { support: number[]; resistance: number[] };
  atrPercent: number | null;
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("ro-RO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${fmt(n * 100, digits)}%`;

export function summarize(signals: Signal[]): Summary {
  const positives = signals.filter((s) => s.verdict === "positive").length;
  const negatives = signals.filter((s) => s.verdict === "negative").length;
  const neutrals = signals.length - positives - negatives;
  const score = signals.length ? Math.round(((positives - negatives) / signals.length) * 100) : 0;
  const verdict: Verdict = score >= 25 ? "positive" : score <= -25 ? "negative" : "neutral";
  return { verdict, score, positives, negatives, neutrals };
}

export function analyzeTechnical(candles: Candle[]): TechnicalAnalysis {
  const close = candles.map((c) => c.close);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const price = close[close.length - 1];
  const signals: Signal[] = [];

  // Trend: price vs. 50/200-day moving averages.
  const sma50 = last(sma(close, 50));
  const sma200 = last(sma(close, 200));
  if (sma50 !== null && sma200 !== null) {
    const above50 = price > sma50;
    const golden = sma50 > sma200;
    const verdict: Verdict = above50 && golden ? "positive" : !above50 && !golden ? "negative" : "neutral";
    signals.push({
      id: "trend",
      name: "Trend (medii mobile 50/200)",
      value: `Preț ${above50 ? "peste" : "sub"} SMA50 · SMA50 ${golden ? "peste" : "sub"} SMA200`,
      verdict,
      simple:
        verdict === "positive"
          ? "Prețul a crescut constant în ultimele luni: tendința pe termen lung este ascendentă."
          : verdict === "negative"
            ? "Prețul a scăzut în ultimele luni: tendința pe termen lung este descendentă."
            : "Tendința nu este clară: semnalele pe termen scurt și lung se contrazic.",
      detail: `SMA50 = ${fmt(sma50)}, SMA200 = ${fmt(sma200)}. ${
        golden ? "Configurație de tip „golden cross” (SMA50 > SMA200)." : "Configurație de tip „death cross” (SMA50 < SMA200)."
      }`,
    });
  } else if (sma50 !== null) {
    const above = price > sma50;
    signals.push({
      id: "trend",
      name: "Trend (media mobilă 50)",
      value: `Preț ${above ? "peste" : "sub"} SMA50`,
      verdict: above ? "positive" : "negative",
      simple: above
        ? "Prețul este peste media ultimelor 50 de zile: tendință ascendentă pe termen mediu."
        : "Prețul este sub media ultimelor 50 de zile: tendință descendentă pe termen mediu.",
      detail: `SMA50 = ${fmt(sma50)}. Istoric insuficient pentru SMA200.`,
    });
  }

  // RSI(14)
  const rsiNow = last(rsi(close, 14));
  if (rsiNow !== null) {
    const verdict: Verdict = rsiNow < 30 ? "positive" : rsiNow > 70 ? "negative" : "neutral";
    signals.push({
      id: "rsi",
      name: "RSI (14)",
      value: fmt(rsiNow, 1),
      verdict,
      simple:
        rsiNow < 30
          ? "Activul a scăzut mult și repede („supravândut”). Istoric, astfel de scăderi sunt adesea urmate de o revenire, dar nu întotdeauna."
          : rsiNow > 70
            ? "Activul a crescut mult și repede („supracumpărat”). Poate urma o pauză sau o corecție."
            : "Ritmul creșterilor și scăderilor este echilibrat, fără exces într-o direcție.",
      detail: `RSI sub 30 indică zonă de supravânzare, peste 70 de supracumpărare. Valoare curentă: ${fmt(rsiNow, 1)}.`,
    });
  }

  // MACD(12,26,9)
  const m = macd(close);
  const macdNow = last(m.macd);
  const sigNow = last(m.signal);
  const histNow = last(m.histogram);
  const histPrev = last(m.histogram, 1);
  if (macdNow !== null && sigNow !== null && histNow !== null) {
    const crossedUp = histPrev !== null && histPrev <= 0 && histNow > 0;
    const crossedDown = histPrev !== null && histPrev >= 0 && histNow < 0;
    const verdict: Verdict = histNow > 0 ? "positive" : histNow < 0 ? "negative" : "neutral";
    signals.push({
      id: "macd",
      name: "MACD (12, 26, 9)",
      value: `${fmt(macdNow, 3)} / semnal ${fmt(sigNow, 3)}${crossedUp ? " · încrucișare în sus" : crossedDown ? " · încrucișare în jos" : ""}`,
      verdict,
      simple:
        verdict === "positive"
          ? "Impulsul recent este pozitiv: cumpărătorii au fost mai activi decât vânzătorii."
          : "Impulsul recent este negativ: vânzătorii au fost mai activi decât cumpărătorii.",
      detail: `Histograma MACD = ${fmt(histNow, 3)}. ${
        crossedUp ? "Linia MACD tocmai a trecut peste linia de semnal." : crossedDown ? "Linia MACD tocmai a trecut sub linia de semnal." : ""
      }`.trim(),
    });
  }

  // Bollinger(20, 2)
  const bb = bollinger(close);
  const up = last(bb.upper);
  const lo = last(bb.lower);
  if (up !== null && lo !== null) {
    const position = (price - lo) / (up - lo); // 0 = lower band, 1 = upper band
    const verdict: Verdict = position < 0.1 ? "positive" : position > 0.9 ? "negative" : "neutral";
    signals.push({
      id: "bollinger",
      name: "Benzi Bollinger (20, 2)",
      value: `Poziție în bandă: ${fmt(position * 100, 0)}%`,
      verdict,
      simple:
        position > 0.9
          ? "Prețul este aproape de limita de sus a intervalului obișnuit din ultima lună."
          : position < 0.1
            ? "Prețul este aproape de limita de jos a intervalului obișnuit din ultima lună."
            : "Prețul se află în intervalul obișnuit din ultima lună.",
      detail: `Banda superioară ${fmt(up)}, inferioară ${fmt(lo)}. Lățime bandă: ${fmt(((up - lo) / ((up + lo) / 2)) * 100, 1)}%.`,
    });
  }

  // 1-month momentum (~21 trading days)
  if (close.length > 21) {
    const change = price / close[close.length - 22] - 1;
    const verdict: Verdict = change > 0.03 ? "positive" : change < -0.03 ? "negative" : "neutral";
    signals.push({
      id: "momentum",
      name: "Evoluție 1 lună",
      value: pct(change),
      verdict,
      simple: `În ultima lună prețul a ${change >= 0 ? "crescut" : "scăzut"} cu ${fmt(Math.abs(change) * 100, 1)}%.`,
      detail: `Rata de schimbare pe 21 de sesiuni: ${pct(change, 2)}.`,
    });
  }

  const atrNow = last(atr(high, low, close, 14));
  return {
    signals,
    summary: summarize(signals),
    levels: supportResistance(high.slice(-180), low.slice(-180), price),
    atrPercent: atrNow !== null ? atrNow / price : null,
  };
}

export interface FundamentalAnalysis {
  signals: Signal[];
  summary: Summary;
}

export function analyzeFundamentals(f: Fundamentals): FundamentalAnalysis {
  const signals: Signal[] = [];

  if (f.trailingPE !== undefined && f.trailingPE > 0) {
    const pe = f.trailingPE;
    signals.push({
      id: "pe",
      name: "P/E (preț / profit)",
      value: fmt(pe, 1),
      verdict: pe < 15 ? "positive" : pe > 35 ? "negative" : "neutral",
      simple: `La profitul actual, compania ar avea nevoie de circa ${fmt(pe, 0)} ani ca să câștige cât valorează pe bursă. ${
        pe < 15 ? "Este o evaluare modestă." : pe > 35 ? "Piața se așteaptă la creștere mare, deci evaluarea este ridicată." : "Evaluare moderată."
      }`,
      detail: `P/E trailing ${fmt(pe, 1)}${f.forwardPE ? `, P/E forward ${fmt(f.forwardPE, 1)}` : ""}. Comparați cu media sectorului${f.sector ? ` (${f.sector})` : ""}.`,
    });
  }

  if (f.revenueGrowth !== undefined) {
    const g = f.revenueGrowth;
    signals.push({
      id: "revenueGrowth",
      name: "Creșterea veniturilor",
      value: pct(g),
      verdict: g > 0.1 ? "positive" : g < 0 ? "negative" : "neutral",
      simple: g >= 0 ? `Vânzările companiei au crescut cu ${fmt(g * 100, 1)}% față de anul trecut.` : `Vânzările companiei au scăzut cu ${fmt(-g * 100, 1)}% față de anul trecut.`,
      detail: `Creștere anuală a veniturilor (trimestrul curent vs. același trimestru anul trecut): ${pct(g, 2)}.`,
    });
  }

  if (f.profitMargin !== undefined) {
    const pm = f.profitMargin;
    signals.push({
      id: "profitMargin",
      name: "Marja de profit",
      value: pct(pm),
      verdict: pm > 0.2 ? "positive" : pm < 0.05 ? "negative" : "neutral",
      simple: `Din fiecare 100 de unități încasate, compania păstrează ${fmt(pm * 100, 0)} ca profit.`,
      detail: `Marjă netă ${pct(pm, 2)}${f.operatingMargin !== undefined ? `, marjă operațională ${pct(f.operatingMargin, 2)}` : ""}.`,
    });
  }

  if (f.returnOnEquity !== undefined) {
    const roe = f.returnOnEquity;
    signals.push({
      id: "roe",
      name: "Randamentul capitalului (ROE)",
      value: pct(roe),
      verdict: roe > 0.15 ? "positive" : roe < 0.05 ? "negative" : "neutral",
      simple: `Compania generează anual un profit de ${fmt(roe * 100, 0)} pentru fiecare 100 investiți de acționari.`,
      detail: `ROE ${pct(roe, 2)}. Peste 15% este considerat solid; un ROE foarte mare poate reflecta și îndatorare ridicată.`,
    });
  }

  if (f.debtToEquity !== undefined) {
    // Yahoo reports debt/equity as a percentage (150 = 1.5x).
    const de = f.debtToEquity / 100;
    signals.push({
      id: "debt",
      name: "Datorii / capital propriu",
      value: `${fmt(de, 2)}x`,
      verdict: de < 1 ? "positive" : de > 2 ? "negative" : "neutral",
      simple:
        de < 1
          ? "Compania are datorii mai mici decât capitalul propriu: finanțare prudentă."
          : de > 2
            ? "Compania are datorii de peste două ori mai mari decât capitalul propriu: risc financiar mai ridicat."
            : "Nivelul datoriilor este moderat.",
      detail: `Debt/Equity ${fmt(de, 2)}x${f.currentRatio !== undefined ? `, current ratio ${fmt(f.currentRatio, 2)}` : ""}.`,
    });
  }

  if (f.dividendYield !== undefined && f.dividendYield > 0) {
    const dy = f.dividendYield;
    signals.push({
      id: "dividend",
      name: "Randament dividend",
      value: pct(dy).replace("+", ""),
      verdict: dy > 0.02 ? "positive" : "neutral",
      simple: `Compania plătește anual dividende de aproximativ ${fmt(dy * 100, 1)}% din prețul acțiunii.`,
      detail: `Dividend yield ${fmt(dy * 100, 2)}%.`,
    });
  }

  return { signals, summary: summarize(signals) };
}
