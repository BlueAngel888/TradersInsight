import type { Market } from "./types";

export interface CatalogEntry {
  symbol: string;
  name: string;
  market: Market;
}

export const CATALOG: CatalogEntry[] = [
  { symbol: "AAPL", name: "Apple", market: "stocks" },
  { symbol: "MSFT", name: "Microsoft", market: "stocks" },
  { symbol: "NVDA", name: "NVIDIA", market: "stocks" },
  { symbol: "AMZN", name: "Amazon", market: "stocks" },
  { symbol: "GOOGL", name: "Alphabet", market: "stocks" },
  { symbol: "TSLA", name: "Tesla", market: "stocks" },
  { symbol: "ASML.AS", name: "ASML Holding", market: "stocks" },
  { symbol: "TLV.RO", name: "Banca Transilvania", market: "stocks" },
  { symbol: "SNP.RO", name: "OMV Petrom", market: "stocks" },
  { symbol: "BTC-USD", name: "Bitcoin", market: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum", market: "crypto" },
  { symbol: "SOL-USD", name: "Solana", market: "crypto" },
  { symbol: "BNB-USD", name: "BNB", market: "crypto" },
  { symbol: "XRP-USD", name: "XRP", market: "crypto" },
  { symbol: "ADA-USD", name: "Cardano", market: "crypto" },
  { symbol: "EURUSD=X", name: "EUR/USD", market: "forex" },
  { symbol: "GBPUSD=X", name: "GBP/USD", market: "forex" },
  { symbol: "USDJPY=X", name: "USD/JPY", market: "forex" },
  { symbol: "EURRON=X", name: "EUR/RON", market: "forex" },
  { symbol: "USDRON=X", name: "USD/RON", market: "forex" },
  { symbol: "USDCHF=X", name: "USD/CHF", market: "forex" },
];

export const MARKET_LABELS: Record<Market, string> = {
  stocks: "Acțiuni",
  crypto: "Crypto",
  forex: "Forex",
};

export function guessMarket(symbol: string, quoteType?: string): Market {
  if (quoteType === "CRYPTOCURRENCY") return "crypto";
  if (quoteType === "CURRENCY") return "forex";
  if (quoteType) return "stocks";
  if (symbol.endsWith("=X")) return "forex";
  if (/-(USD|EUR|USDT)$/.test(symbol)) return "crypto";
  return "stocks";
}
