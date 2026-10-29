export type Market = "stocks" | "crypto" | "forex";
export type Level = "beginner" | "intermediate" | "advanced";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  name: string;
  market: Market;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface Fundamentals {
  sector?: string;
  industry?: string;
  description?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  eps?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  profitMargin?: number;
  operatingMargin?: number;
  returnOnEquity?: number;
  debtToEquity?: number;
  currentRatio?: number;
  dividendYield?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  // crypto
  circulatingSupply?: number;
  volume24h?: number;
}

export interface AssetData {
  quote: Quote;
  candles: Candle[];
  fundamentals: Fundamentals | null;
  demo: boolean;
}
