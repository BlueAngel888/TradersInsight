// MCP tools. Read tools are safe to call freely. Trading is a two-step flow:
// preview_trade checks the trade and returns a signed confirmation code;
// execute_trade sends it only with that code, after the user said yes.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectSetup } from "../analysis/setup";
import { summarizeFrame } from "../analysis/summary";
import { signingKey } from "./config";
import {
  accountContext,
  deployAccount,
  getCandles,
  getDeals,
  getOrders,
  getPositions,
  getPrice,
  getSpecification,
  listAccounts,
  resolveAccount,
  sendTrade,
  TIMEFRAMES,
  type AccountContext,
  type Position,
  type Timeframe,
} from "./metaapi";
import { classifyAccount, tradingPolicy } from "./config";
import { nonce, sign, verify } from "./tokens";
import {
  checkClose,
  checkModifyPosition,
  checkOpen,
  describeIntent,
  lotsForRisk,
  tradeBody,
  type Check,
  type MarketContext,
  type PositionSnapshot,
  type TradeIntent,
} from "./trade";

const CONFIRM_TTL_MS = 10 * 60_000;

type Content = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): Content => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 1) }] });
const fail = (e: unknown): Content => ({ content: [{ type: "text", text: `Eroare: ${e instanceof Error ? e.message : String(e)}` }], isError: true });

async function safely(fn: () => Promise<unknown>): Promise<Content> {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
}

const accountArg = z.string().describe("Contul: login MT5, id MetaApi sau o parte din nume (vezi list_accounts).");
const symbolArg = z.string().describe("Simbolul exact de la broker, ex. EURUSD, XAUUSD, US30.cash.");
const tfArg = z.enum(TIMEFRAMES);

async function marketContext(ctx: AccountContext, symbol: string): Promise<MarketContext> {
  const [spec, price] = await Promise.all([getSpecification(ctx.ref, symbol), getPrice(ctx.ref, symbol)]);
  return {
    balance: ctx.info.balance,
    currency: ctx.info.currency,
    bid: price.bid,
    ask: price.ask,
    tickSize: spec.tickSize,
    lossTickValue: price.lossTickValue,
    minVolume: spec.minVolume,
    maxVolume: spec.maxVolume,
    volumeStep: spec.volumeStep,
    digits: spec.digits,
  };
}

const snapshot = (p: Position): PositionSnapshot => ({
  id: p.id,
  symbol: p.symbol,
  side: p.type === "POSITION_TYPE_SELL" ? "sell" : "buy",
  volume: p.volume,
  openPrice: p.openPrice,
  stopLoss: p.stopLoss || undefined,
  takeProfit: p.takeProfit || undefined,
});

interface Prepared {
  ctx: AccountContext;
  check: Check;
  positionVolume?: number;
  symbol?: string;
}

async function prepare(accountQuery: string, intent: TradeIntent): Promise<Prepared> {
  const ctx = await accountContext(accountQuery);
  if (!ctx.policy.tradingAllowed) return { ctx, check: { errors: [ctx.policy.reason], warnings: [] } };

  switch (intent.action) {
    case "open": {
      const m = await marketContext(ctx, intent.symbol);
      return { ctx, symbol: intent.symbol, check: checkOpen(intent, m, ctx.policy) };
    }
    case "modify_position":
    case "close_position": {
      const pos = (await getPositions(ctx.ref)).find((p) => p.id === intent.positionId);
      if (!pos) return { ctx, check: { errors: [`Nu există poziția ${intent.positionId} pe acest cont.`], warnings: [] } };
      const m = await marketContext(ctx, pos.symbol);
      const check = intent.action === "modify_position" ? checkModifyPosition(intent, snapshot(pos), m, ctx.policy) : checkClose(intent, snapshot(pos), m);
      return { ctx, check, symbol: pos.symbol, positionVolume: pos.volume };
    }
    case "modify_order":
    case "cancel_order": {
      const ord = (await getOrders(ctx.ref)).find((o) => o.id === intent.orderId);
      if (!ord) return { ctx, check: { errors: [`Nu există ordinul în așteptare ${intent.orderId}.`], warnings: [] } };
      const check: Check = { errors: [], warnings: [] };
      if (intent.action === "modify_order" && intent.stopLoss === undefined && !ord.stopLoss && ctx.policy.requireStopLoss)
        check.errors.push("Stop loss obligatoriu (REQUIRE_STOP_LOSS).");
      return { ctx, check, symbol: ord.symbol };
    }
  }
}

const accountLabel = (ctx: AccountContext) => `${ctx.ref.name || "cont"} · login ${ctx.ref.login} · ${ctx.kind}`;

const INSTRUCTIONS = `Server MT5 (MetaApi) pentru conturile lui Florin: demo, cash (real) și funded.
Reguli:
- Răspunde în română.
- Pentru orice tranzacție: întâi preview_trade, arată-i utilizatorului rezumatul (cont, simbol, direcție, volum, SL, TP, risc în bani și %), apoi cere-i confirmarea explicită. Doar după ce scrie „da”/„confirm” apelezi execute_trade cu codul primit. Nu executa niciodată din proprie inițiativă și nu reutiliza un cod vechi.
- Conturile cash și funded sunt doar-citire dacă nu sunt permise explicit pe server. Nu încerca să ocolești asta.
- Analiza e informativă, nu sfat financiar. Menționează riscul.`;

export function buildServer(): McpServer {
  const server = new McpServer({ name: "traders-insight-mt5", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  // ---------- Accounts ----------

  server.registerTool(
    "list_accounts",
    {
      title: "Listează conturile MT5",
      description: "Toate conturile MT5 din MetaApi (demo, cash, funded), cu starea conexiunii și dacă tranzacționarea e permisă pe fiecare.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      safely(async () => {
        const accounts = await listAccounts(true);
        return Promise.all(
          accounts.map(async (a) => {
            let info: Awaited<ReturnType<typeof accountContext>> | undefined;
            let note: string | undefined;
            if (a.state === "DEPLOYED") {
              try {
                info = await accountContext(a.id);
              } catch (e) {
                note = e instanceof Error ? e.message : String(e);
              }
            } else note = "Neporit în MetaApi: folosește deploy_account.";
            const kind = info?.kind ?? classifyAccount({ name: a.name, server: a.server });
            const policy = info?.policy ?? tradingPolicy(a.login, kind);
            return {
              name: a.name,
              login: a.login,
              server: a.server,
              metaApiId: a.id,
              state: a.state,
              connection: a.connectionStatus,
              kind,
              balance: info?.info.balance,
              equity: info?.info.equity,
              currency: info?.info.currency,
              tradingAllowed: policy.tradingAllowed,
              tradingNote: policy.reason,
              limits: { maxLot: policy.maxLot, maxRiskPercent: policy.maxRiskPercent, requireStopLoss: policy.requireStopLoss },
              note,
            };
          }),
        );
      }),
  );

  server.registerTool(
    "deploy_account",
    {
      title: "Pornește contul în MetaApi",
      description: "Pornește (deploy) un cont MetaApi oprit, ca să poată fi citit. Durează 1–2 minute până se conectează. Nu tranzacționează nimic.",
      inputSchema: { account: accountArg },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ account }) =>
      safely(async () => {
        const ref = await resolveAccount(account);
        if (ref.state === "DEPLOYED") return `Contul ${ref.name || ref.login} e deja pornit.`;
        await deployAccount(ref);
        return `Am pornit contul ${ref.name || ref.login}. Încearcă din nou peste 1–2 minute.`;
      }),
  );

  server.registerTool(
    "get_account",
    {
      title: "Situația contului",
      description: "Sold, equity, marjă, poziții deschise (cu profit, SL, TP) și ordine în așteptare pentru un cont.",
      inputSchema: { account: accountArg },
      annotations: { readOnlyHint: true },
    },
    ({ account }) =>
      safely(async () => {
        const ctx = await accountContext(account);
        const [positions, orders] = await Promise.all([getPositions(ctx.ref), getOrders(ctx.ref)]);
        const floating = positions.reduce((s, p) => s + (p.profit ?? 0), 0);
        return {
          account: accountLabel(ctx),
          broker: ctx.info.broker,
          server: ctx.info.server,
          currency: ctx.info.currency,
          balance: ctx.info.balance,
          equity: ctx.info.equity,
          margin: ctx.info.margin,
          freeMargin: ctx.info.freeMargin,
          marginLevel: ctx.info.marginLevel,
          leverage: ctx.info.leverage,
          floatingProfit: Math.round(floating * 100) / 100,
          trading: { allowed: ctx.policy.tradingAllowed, note: ctx.policy.reason },
          positions: positions.map((p) => ({
            positionId: p.id,
            symbol: p.symbol,
            side: p.type === "POSITION_TYPE_SELL" ? "SELL" : "BUY",
            volume: p.volume,
            openPrice: p.openPrice,
            currentPrice: p.currentPrice,
            stopLoss: p.stopLoss || null,
            takeProfit: p.takeProfit || null,
            profit: p.profit,
            opened: p.time,
          })),
          pendingOrders: orders.map((o) => ({
            orderId: o.id,
            symbol: o.symbol,
            type: o.type.replace("ORDER_TYPE_", ""),
            volume: o.currentVolume ?? o.volume,
            price: o.openPrice,
            stopLoss: o.stopLoss || null,
            takeProfit: o.takeProfit || null,
            placed: o.time,
          })),
        };
      }),
  );

  server.registerTool(
    "get_history",
    {
      title: "Istoric tranzacții",
      description: "Tranzacțiile închise din ultimele N zile, cu profit total, rată de câștig și profit pe simbol.",
      inputSchema: { account: accountArg, days: z.number().int().min(1).max(365).default(30) },
      annotations: { readOnlyHint: true },
    },
    ({ account, days }) =>
      safely(async () => {
        const ctx = await accountContext(account);
        const to = new Date();
        const from = new Date(to.getTime() - days * 86_400_000);
        const deals = await getDeals(ctx.ref, from, to);
        const closed = deals.filter((d) => d.entryType === "DEAL_ENTRY_OUT" || d.entryType === "DEAL_ENTRY_INOUT" || d.entryType === "DEAL_ENTRY_OUT_BY");
        const net = (d: (typeof deals)[number]) => (d.profit ?? 0) + (d.swap ?? 0) + (d.commission ?? 0);
        const wins = closed.filter((d) => net(d) > 0).length;
        const bySymbol: Record<string, number> = {};
        for (const d of closed) bySymbol[d.symbol ?? "?"] = Math.round(((bySymbol[d.symbol ?? "?"] ?? 0) + net(d)) * 100) / 100;
        const balanceOps = deals.filter((d) => d.type === "DEAL_TYPE_BALANCE").reduce((s, d) => s + (d.profit ?? 0), 0);
        return {
          account: accountLabel(ctx),
          period: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
          closedTrades: closed.length,
          netProfit: Math.round(closed.reduce((s, d) => s + net(d), 0) * 100) / 100,
          winRate: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : null,
          bySymbol,
          depositsWithdrawals: Math.round(balanceOps * 100) / 100,
          trades: closed.slice(-100).map((d) => ({
            time: d.time,
            symbol: d.symbol,
            side: d.type === "DEAL_TYPE_SELL" ? "SELL (închide buy)" : "BUY (închide sell)",
            volume: d.volume,
            price: d.price,
            net: Math.round(net(d) * 100) / 100,
            positionId: d.positionId,
          })),
        };
      }),
  );

  // ---------- Market data & analysis ----------

  server.registerTool(
    "get_price",
    {
      title: "Preț curent",
      description: "Bid, ask, spread și specificațiile simbolului (volum minim/maxim, pas, digits) pe contul dat.",
      inputSchema: { account: accountArg, symbol: symbolArg },
      annotations: { readOnlyHint: true },
    },
    ({ account, symbol }) =>
      safely(async () => {
        const ref = await resolveAccount(account);
        const [spec, price] = await Promise.all([getSpecification(ref, symbol), getPrice(ref, symbol)]);
        const spreadPoints = Math.round((price.ask - price.bid) / spec.tickSize);
        return { symbol, bid: price.bid, ask: price.ask, spreadPoints, time: price.time, spec };
      }),
  );

  server.registerTool(
    "get_candles",
    {
      title: "Lumânări",
      description: "Lumânări OHLCV brute pentru un simbol și timeframe (max 500). Pentru analiză folosește mai întâi analyze_market, care e mai compact.",
      inputSchema: { account: accountArg, symbol: symbolArg, timeframe: tfArg, count: z.number().int().min(10).max(500).default(100) },
      annotations: { readOnlyHint: true },
    },
    ({ account, symbol, timeframe, count }) =>
      safely(async () => {
        const ref = await resolveAccount(account);
        const candles = await getCandles(ref, symbol, timeframe as Timeframe, count);
        return {
          symbol,
          timeframe,
          columns: ["timeUTC", "open", "high", "low", "close", "volume"],
          rows: candles.map((c) => [new Date(c.time * 1000).toISOString().slice(0, 16), c.open, c.high, c.low, c.close, c.volume]),
        };
      }),
  );

  server.registerTool(
    "analyze_market",
    {
      title: "Analiză tehnică multi-timeframe",
      description:
        "Analiză pe mai multe timeframe-uri: trend SMC (BOS/CHoCH), premium/discount, order blocks, FVG, EMA 20/50/200, RSI, ATR, volume profile (POC/VAH/VAL), suport și rezistență. Plus scanarea setup-ului SMC al lui Florin (trend aliniat D1/4H/1H → doji care ia lichiditatea pe 1–15m → intrare la fib 0.786).",
      inputSchema: {
        account: accountArg,
        symbol: symbolArg,
        timeframes: z.array(tfArg).min(1).max(5).default(["1d", "4h", "1h", "15m"]),
      },
      annotations: { readOnlyHint: true },
    },
    ({ account, symbol, timeframes }) =>
      safely(async () => {
        const ref = await resolveAccount(account);
        const spec = await getSpecification(ref, symbol).catch(() => null);
        const digits = spec?.digits ?? 5;
        const frames: Record<string, unknown> = {};
        const cache: Partial<Record<Timeframe, Awaited<ReturnType<typeof getCandles>>>> = {};
        const load = async (tf: Timeframe) => (cache[tf] ??= await getCandles(ref, symbol, tf, 300));
        for (const tf of timeframes as Timeframe[]) frames[tf] = summarizeFrame(await load(tf), digits);
        const [d1, h4, h1] = await Promise.all((["1d", "4h", "1h"] as const).map(load));
        const smcSetup: Record<string, unknown> = {};
        for (const ltf of ["15m", "5m", "1m"] as const) {
          const res = detectSetup({ d1, h4, h1, ltf: await load(ltf) });
          smcSetup[ltf] = res.setup ? { ...res.setup, dojiTime: new Date(res.setup.dojiTime * 1000).toISOString(), reason: res.reason } : { reason: res.reason };
          if (!res.trend.aligned) {
            smcSetup.htfTrend = res.trend;
            break;
          }
          smcSetup.htfTrend = res.trend;
        }
        return { symbol, frames, florinSmcSetup: smcSetup, note: "Estimări algoritmice, nu sfat financiar." };
      }),
  );

  server.registerTool(
    "calculate_position_size",
    {
      title: "Calculează lotul",
      description: "Câte loturi să folosești ca, dacă se atinge stop loss-ul, să pierzi riskPercent din sold. Ține cont de valoarea tick-ului de la broker.",
      inputSchema: {
        account: accountArg,
        symbol: symbolArg,
        entryPrice: z.number().positive().optional().describe("Lipsă = prețul curent."),
        stopLoss: z.number().positive(),
        riskPercent: z.number().positive().max(10),
        side: z.enum(["buy", "sell"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ account, symbol, entryPrice, stopLoss, riskPercent, side }) =>
      safely(async () => {
        const ctx = await accountContext(account);
        const m = await marketContext(ctx, symbol);
        const entry = entryPrice ?? (side === "sell" || (!side && stopLoss > m.bid) ? m.bid : m.ask);
        const lots = lotsForRisk(riskPercent, entry, stopLoss, m);
        if (lots === undefined) throw new Error("Brokerul nu trimite valoarea tick-ului pentru acest simbol; nu pot calcula lotul.");
        const capped = Math.min(lots, ctx.policy.maxLot, m.maxVolume);
        return {
          account: accountLabel(ctx),
          symbol,
          entry,
          stopLoss,
          riskPercent,
          riskMoney: Math.round(((m.balance * riskPercent) / 100) * 100) / 100,
          currency: m.currency,
          lots: capped,
          note:
            capped < lots ? `Limitat la ${capped} (MAX_LOT sau maximul simbolului); lotul calculat era ${lots}.` : lots < m.minVolume ? `Sub volumul minim (${m.minVolume}): stopul e prea larg pentru riscul ales.` : undefined,
          tradingAllowedOnAccount: ctx.policy.tradingAllowed,
        };
      }),
  );

  // ---------- Trading (two steps) ----------

  const tradeSchema = {
    account: accountArg,
    action: z.enum(["open", "modify_position", "modify_order", "close_position", "cancel_order"]),
    symbol: symbolArg.optional().describe("Pentru open."),
    side: z.enum(["buy", "sell"]).optional().describe("Pentru open."),
    orderType: z.enum(["market", "limit", "stop"]).default("market").describe("Pentru open."),
    volume: z.number().positive().optional().describe("Loturi. Pentru open (obligatoriu, sau dă riskPercent) sau închidere parțială."),
    riskPercent: z.number().positive().max(10).optional().describe("Pentru open: calculează volumul din risc, dacă volume lipsește."),
    entryPrice: z.number().positive().optional().describe("Pentru ordine limit/stop sau modify_order."),
    stopLoss: z.number().positive().optional(),
    takeProfit: z.number().positive().optional(),
    positionId: z.string().optional().describe("Pentru modify_position / close_position."),
    orderId: z.string().optional().describe("Pentru modify_order / cancel_order."),
    comment: z.string().max(12).optional(),
  };

  server.registerTool(
    "preview_trade",
    {
      title: "Previzualizează o tranzacție",
      description:
        "PASUL 1 din 2 pentru orice tranzacție (deschidere, modificare SL/TP, închidere, anulare). Verifică regulile contului și limitele de risc și NU trimite nimic la broker. Întoarce un rezumat și un confirmationCode valabil 10 minute. Arată rezumatul utilizatorului și cere-i confirmarea explicită înainte de execute_trade.",
      inputSchema: tradeSchema,
      annotations: { readOnlyHint: true },
    },
    (a) =>
      safely(async () => {
        let intent: TradeIntent;
        switch (a.action) {
          case "open": {
            if (!a.symbol || !a.side) throw new Error("Pentru open trebuie symbol și side.");
            let volume = a.volume;
            if (volume === undefined) {
              if (a.riskPercent === undefined || a.stopLoss === undefined) throw new Error("Dă volume, sau riskPercent împreună cu stopLoss.");
              const ctx = await accountContext(a.account);
              const m = await marketContext(ctx, a.symbol);
              const entry = a.orderType === "market" ? (a.side === "buy" ? m.ask : m.bid) : a.entryPrice;
              if (entry === undefined) throw new Error("Ordinele limit/stop au nevoie de entryPrice.");
              volume = lotsForRisk(a.riskPercent, entry, a.stopLoss, m);
              if (!volume) throw new Error("Nu pot calcula volumul din risc pentru acest simbol, sau iese sub volumul minim. Dă volume direct.");
            }
            intent = { action: "open", symbol: a.symbol, side: a.side, orderType: a.orderType, volume, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit, comment: a.comment };
            break;
          }
          case "modify_position":
            if (!a.positionId) throw new Error("Lipsește positionId.");
            intent = { action: "modify_position", positionId: a.positionId, stopLoss: a.stopLoss, takeProfit: a.takeProfit };
            break;
          case "close_position":
            if (!a.positionId) throw new Error("Lipsește positionId.");
            intent = { action: "close_position", positionId: a.positionId, volume: a.volume };
            break;
          case "modify_order":
            if (!a.orderId) throw new Error("Lipsește orderId.");
            intent = { action: "modify_order", orderId: a.orderId, entryPrice: a.entryPrice, stopLoss: a.stopLoss, takeProfit: a.takeProfit };
            break;
          case "cancel_order":
            if (!a.orderId) throw new Error("Lipsește orderId.");
            intent = { action: "cancel_order", orderId: a.orderId };
            break;
        }
        const p = await prepare(a.account, intent);
        const summary = {
          account: accountLabel(p.ctx),
          trade: describeIntent(intent),
          estimatedEntry: p.check.entry,
          riskAtStop: p.check.riskMoney !== undefined ? `${p.check.riskMoney} ${p.ctx.info.currency} (${p.check.riskPercent}% din sold)` : undefined,
          rewardAtTarget: p.check.rewardMoney !== undefined ? `${p.check.rewardMoney} ${p.ctx.info.currency}` : undefined,
          warnings: p.check.warnings,
        };
        if (p.check.errors.length) return { status: "REFUZAT", errors: p.check.errors, ...summary };
        const confirmationCode = sign(
          { typ: "trade", exp: Date.now() + CONFIRM_TTL_MS, acc: p.ctx.ref.id, intent, cid: `TI${nonce(6)}`, pv: p.positionVolume },
          signingKey(),
        );
        return {
          status: "GATA DE CONFIRMARE",
          ...summary,
          confirmationCode,
          next: "Arată rezumatul utilizatorului și întreabă dacă confirmă. Doar după un „da” explicit apelează execute_trade cu acest confirmationCode.",
        };
      }),
  );

  server.registerTool(
    "execute_trade",
    {
      title: "Execută tranzacția confirmată",
      description:
        "PASUL 2 din 2. Trimite la broker tranzacția din preview_trade. Folosește-l DOAR după ce utilizatorul a văzut rezumatul și a confirmat explicit în conversație. Verifică din nou regulile înainte de trimitere.",
      inputSchema: { confirmationCode: z.string().describe("Codul primit de la preview_trade.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ({ confirmationCode }) =>
      safely(async () => {
        const t = verify<{ acc: string; intent: TradeIntent; cid: string; pv?: number }>(confirmationCode, signingKey(), "trade");
        if (!t) throw new Error("Cod de confirmare invalid sau expirat (10 minute). Fă din nou preview_trade.");
        const p = await prepare(t.acc, t.intent);
        if (p.check.errors.length) return { status: "REFUZAT la verificarea finală", errors: p.check.errors };
        if (t.pv !== undefined && p.positionVolume !== t.pv)
          throw new Error("Poziția s-a schimbat de la preview (volum diferit). Fă din nou preview_trade.");
        if (t.intent.action === "open") {
          const [positions, orders] = await Promise.all([getPositions(p.ctx.ref), getOrders(p.ctx.ref)]);
          if ([...positions, ...orders].some((x) => x.clientId === t.cid)) throw new Error("Tranzacția asta a fost deja executată.");
        }
        const res = await sendTrade(p.ctx.ref, tradeBody(t.intent, t.cid));
        return {
          status: "EXECUTAT",
          account: accountLabel(p.ctx),
          trade: describeIntent(t.intent),
          broker: `${res.stringCode} ${res.message ?? ""}`.trim(),
          orderId: res.orderId,
          positionId: res.positionId,
        };
      }),
  );

  return server;
}
