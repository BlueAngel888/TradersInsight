// Deterministic synthetic market data, used when live data is unavailable
// (no network, provider outage) or when DEMO_DATA=1 is set.
import { CATALOG, guessMarket } from "./catalog";
import type { AssetData, Candle, Fundamentals, Quote } from "./types";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE: Record<string, number> = {
  "BTC-USD": 68000,
  "ETH-USD": 3400,
  "SOL-USD": 160,
  "EURUSD=X": 1.08,
  "GBPUSD=X": 1.27,
  "USDJPY=X": 150,
  "EURRON=X": 4.97,
  "USDRON=X": 4.6,
};

export function demoCandles(symbol: string, days = 400): Candle[] {
  const market = guessMarket(symbol);
  const rand = rng(hash(symbol));
  const vol = market === "crypto" ? 0.035 : market === "forex" ? 0.004 : 0.018;
  const drift = (rand() - 0.45) * vol * 0.15;
  let price = BASE[symbol] ?? 20 + rand() * 300;
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 86400000) * 86400;
  for (let i = days; i > 0; i--) {
    const open = price;
    const ret = drift + vol * (rand() + rand() + rand() - 1.5) * 1.4;
    const close = open * (1 + ret);
    const high = Math.max(open, close) * (1 + rand() * vol * 0.6);
    const low = Math.min(open, close) * (1 - rand() * vol * 0.6);
    candles.push({ time: now - i * 86400, open, high, low, close, volume: Math.round(1e6 * (0.5 + rand())) });
    price = close;
  }
  return candles;
}

export function demoQuote(symbol: string): Quote {
  const candles = demoCandles(symbol);
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const entry = CATALOG.find((e) => e.symbol === symbol);
  const market = guessMarket(symbol);
  return {
    symbol,
    name: entry?.name ?? symbol,
    market,
    currency: market === "forex" ? symbol.slice(3, 6) : symbol.endsWith(".RO") ? "RON" : symbol.endsWith(".AS") ? "EUR" : "USD",
    price: c.close,
    change: c.close - p.close,
    changePercent: (c.close / p.close - 1) * 100,
  };
}

function demoFundamentals(symbol: string): Fundamentals {
  const rand = rng(hash(symbol + ":f"));
  return {
    sector: "Tehnologie (demo)",
    industry: "Date demonstrative",
    description: "Date generate automat pentru demonstrație. Nu reflectă compania reală.",
    marketCap: Math.round(5e9 + rand() * 2e12),
    trailingPE: 8 + rand() * 40,
    forwardPE: 8 + rand() * 30,
    priceToBook: 1 + rand() * 10,
    eps: 1 + rand() * 10,
    revenueGrowth: -0.05 + rand() * 0.3,
    earningsGrowth: -0.1 + rand() * 0.4,
    profitMargin: rand() * 0.35,
    operatingMargin: rand() * 0.4,
    returnOnEquity: rand() * 0.4,
    debtToEquity: rand() * 250,
    currentRatio: 0.6 + rand() * 2,
    dividendYield: rand() > 0.5 ? rand() * 0.04 : undefined,
    beta: 0.6 + rand(),
  };
}

export function demoAsset(symbol: string): AssetData {
  const quote = demoQuote(symbol);
  return {
    quote,
    candles: demoCandles(symbol),
    fundamentals: quote.market === "stocks" ? demoFundamentals(symbol) : null,
    demo: true,
  };
}
