// Pure helpers for the MetaApi (MT5) integration. Kept free of network
// and server-only imports so they can be unit-tested.

export type Mt5TradeMode = "ACCOUNT_TRADE_MODE_DEMO" | "ACCOUNT_TRADE_MODE_CONTEST" | "ACCOUNT_TRADE_MODE_REAL";

export interface Mt5AccountInfo {
  platform: string;
  broker: string;
  currency: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  marginLevel?: number;
  name: string;
  login: number;
  type: Mt5TradeMode | string;
}

export interface Mt5Position {
  id: string;
  symbol: string;
  type: string; // POSITION_TYPE_BUY | POSITION_TYPE_SELL
  volume: number;
  openPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  swap?: number;
  time?: string;
}

export interface Mt5Snapshot {
  account: Mt5AccountInfo;
  positions: Mt5Position[];
  totalProfit: number;
  fetchedAt: string;
}

export class Mt5NotDemoError extends Error {
  constructor(type: string) {
    super(`Contul MT5 nu este demo (tip: ${type}). Integrarea funcționează doar cu conturi demo.`);
    this.name = "Mt5NotDemoError";
  }
}

/** Throws unless the account is explicitly a demo account. Unknown or missing types are refused. */
export function assertDemo(account: Pick<Mt5AccountInfo, "type">): void {
  if (account.type !== "ACCOUNT_TRADE_MODE_DEMO") throw new Mt5NotDemoError(String(account.type ?? "necunoscut"));
}

export function buildSnapshot(account: Mt5AccountInfo, positions: Mt5Position[], now = new Date()): Mt5Snapshot {
  assertDemo(account);
  const totalProfit = positions.reduce((s, p) => s + (p.profit ?? 0) + (p.swap ?? 0), 0);
  return { account, positions, totalProfit: Math.round(totalProfit * 100) / 100, fetchedAt: now.toISOString() };
}

export const positionSide = (type: string) => (type === "POSITION_TYPE_SELL" ? "SELL" : "BUY");

/** Constant-time string comparison for the dashboard access key. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
