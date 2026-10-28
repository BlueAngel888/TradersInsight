import "server-only";
import yahooFinance from "yahoo-finance2";
import { CATALOG, guessMarket, type CatalogEntry } from "./catalog";
import { demoAsset, demoQuote } from "./demo";
import type { AssetData, Candle, Fundamentals, Quote } from "./types";

// Market data comes from Yahoo Finance (unofficial API, no key needed) and
// covers stocks, crypto and forex. If it fails we fall back to demo data so
// the app stays usable; pages show a banner when that happens.
// Swap this module to use a licensed provider (FMP, Polygon, Twelve Data)
// before going to production.

yahooFinance.suppressNotices(["yahooSurvey", "ripHistorical"]);

const FORCE_DEMO = process.env.DEMO_DATA === "1";
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Yahoo responses are loosely typed; we validate fields as we map them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;
const yf: Raw = yahooFinance;

function toQuote(q: Record<string, unknown>): Quote {
  const symbol = q.symbol as string;
  return {
    symbol,
    name: (q.longName as string) ?? (q.shortName as string) ?? symbol,
    market: guessMarket(symbol, q.quoteType as string | undefined),
    currency: (q.currency as string) ?? "USD",
    price: (q.regularMarketPrice as number) ?? 0,
    change: (q.regularMarketChange as number) ?? 0,
    changePercent: (q.regularMarketChangePercent as number) ?? 0,
  };
}

export async function getQuotes(symbols: string[]): Promise<{ quotes: Quote[]; demo: boolean }> {
  if (FORCE_DEMO) return { quotes: symbols.map(demoQuote), demo: true };
  try {
    const raw = await cached<Raw>(`quotes:${symbols.join(",")}`, () => yf.quote(symbols));
    const list = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    const bySymbol = new Map(list.map((q) => [q.symbol as string, toQuote(q)]));
    return { quotes: symbols.map((s) => bySymbol.get(s) ?? demoQuote(s)), demo: false };
  } catch (err) {
    console.warn("getQuotes failed, using demo data:", (err as Error).message);
    return { quotes: symbols.map(demoQuote), demo: true };
  }
}

async function getCandles(symbol: string): Promise<Candle[]> {
  const period1 = new Date(Date.now() - 400 * 86400 * 1000);
  const res = await cached<Raw>(`chart:${symbol}`, () => yf.chart(symbol, { period1, interval: "1d" }));
  return (res.quotes as Record<string, unknown>[])
    .filter((q) => q.close != null && q.open != null)
    .map((q) => ({
      time: Math.floor(new Date(q.date as string).getTime() / 1000),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume as number) ?? 0,
    }));
}

async function getFundamentals(symbol: string): Promise<Fundamentals | null> {
  const r = await cached<Raw>(`fund:${symbol}`, () =>
    yf.quoteSummary(symbol, {
      modules: ["summaryDetail", "financialData", "defaultKeyStatistics", "assetProfile"],
    }),
  );
  const sd = r.summaryDetail ?? {};
  const fd = r.financialData ?? {};
  const ks = r.defaultKeyStatistics ?? {};
  const ap = r.assetProfile ?? {};
  return {
    sector: ap.sector,
    industry: ap.industry,
    description: ap.longBusinessSummary,
    marketCap: sd.marketCap,
    trailingPE: sd.trailingPE,
    forwardPE: sd.forwardPE ?? ks.forwardPE,
    priceToBook: ks.priceToBook,
    eps: ks.trailingEps,
    revenueGrowth: fd.revenueGrowth,
    earningsGrowth: fd.earningsGrowth,
    profitMargin: fd.profitMargins ?? ks.profitMargins,
    operatingMargin: fd.operatingMargins,
    returnOnEquity: fd.returnOnEquity,
    debtToEquity: fd.debtToEquity,
    currentRatio: fd.currentRatio,
    dividendYield: sd.dividendYield,
    beta: sd.beta,
    fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: sd.fiftyTwoWeekLow,
    circulatingSupply: sd.circulatingSupply,
    volume24h: sd.volume24Hr,
  };
}

export async function getAsset(symbol: string): Promise<AssetData> {
  if (FORCE_DEMO) return demoAsset(symbol);
  try {
    const [{ quotes, demo }, candles] = await Promise.all([getQuotes([symbol]), getCandles(symbol)]);
    if (demo || candles.length < 30) throw new Error("insufficient live data");
    const quote = quotes[0];
    const fundamentals =
      quote.market === "forex" ? null : await getFundamentals(symbol).catch(() => null);
    return { quote, candles, fundamentals, demo: false };
  } catch (err) {
    console.warn(`getAsset(${symbol}) failed, using demo data:`, (err as Error).message);
    return demoAsset(symbol);
  }
}

const SEARCHABLE = new Set(["EQUITY", "ETF", "CRYPTOCURRENCY", "CURRENCY", "INDEX"]);

export async function searchSymbols(query: string): Promise<CatalogEntry[]> {
  const q = query.trim();
  if (!q) return [];
  const local = CATALOG.filter(
    (e) => e.symbol.toLowerCase().includes(q.toLowerCase()) || e.name.toLowerCase().includes(q.toLowerCase()),
  );
  if (FORCE_DEMO) return local;
  try {
    const res = await cached<Raw>(`search:${q.toLowerCase()}`, () => yf.search(q, { quotesCount: 10, newsCount: 0 }));
    const remote = (res.quotes as Record<string, unknown>[])
      .filter((r) => r.symbol && SEARCHABLE.has(r.quoteType as string))
      .map((r) => ({
        symbol: r.symbol as string,
        name: (r.longname as string) ?? (r.shortname as string) ?? (r.symbol as string),
        market: guessMarket(r.symbol as string, r.quoteType as string),
      }));
    const seen = new Set(remote.map((r) => r.symbol));
    return [...remote, ...local.filter((l) => !seen.has(l.symbol))].slice(0, 12);
  } catch {
    return local;
  }
}
