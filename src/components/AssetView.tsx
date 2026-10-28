"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { FundamentalAnalysis, Signal, Summary, TechnicalAnalysis, Verdict } from "@/lib/analysis";
import { bollinger, macd, rsi, sma } from "@/lib/indicators";
import { MARKET_LABELS } from "@/lib/catalog";
import type { AssetData, Level } from "@/lib/types";
import { useLevel } from "./LevelProvider";
import { Onboarding } from "./Onboarding";
import { OscillatorChart, PriceChart, type Overlay } from "./PriceChart";
import { DemoBanner } from "./DemoBanner";
import { Disclaimer } from "./Disclaimer";
import { formatBig, formatPercent, formatPrice } from "./format";

const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  positive: { label: "Pozitiv", className: "bg-up/15 text-up border-up/40" },
  negative: { label: "Negativ", className: "bg-down/15 text-down border-down/40" },
  neutral: { label: "Neutru", className: "bg-muted/15 text-muted border-muted/40" },
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_STYLE[verdict];
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${v.className}`}>{v.label}</span>;
}

function SummaryCard({ title, summary, level }: { title: string; summary: Summary; level: Level }) {
  const text =
    summary.verdict === "positive"
      ? "Majoritatea indicatorilor arată semnale pozitive."
      : summary.verdict === "negative"
        ? "Majoritatea indicatorilor arată semnale negative."
        : "Indicatorii sunt împărțiți: nu există o direcție clară.";
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <VerdictBadge verdict={summary.verdict} />
      </div>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <div className="mt-3 flex gap-4 text-sm">
        <span className="text-up">▲ {summary.positives} pozitive</span>
        <span className="text-muted">● {summary.neutrals} neutre</span>
        <span className="text-down">▼ {summary.negatives} negative</span>
      </div>
      {level === "advanced" && <p className="mt-2 text-xs text-muted">Scor agregat: {summary.score} (de la -100 la +100)</p>}
    </div>
  );
}

function SignalList({ signals, level }: { signals: Signal[]; level: Level }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
      {signals.map((s) => (
        <li key={s.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{s.name}</div>
              {level !== "beginner" && <div className="mt-0.5 font-mono text-sm">{s.value}</div>}
            </div>
            <VerdictBadge verdict={s.verdict} />
          </div>
          <p className="mt-2 text-sm text-muted">{level === "beginner" ? s.simple : level === "intermediate" ? s.simple : s.detail}</p>
          {level === "advanced" && <p className="mt-1 text-xs text-muted">{s.simple}</p>}
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

const pctOrDash = (n?: number) => (n === undefined || n === null ? "–" : formatPercent(n * 100));
const numOrDash = (n?: number, d = 2) =>
  n === undefined || n === null ? "–" : n.toLocaleString("ro-RO", { maximumFractionDigits: d });

export function AssetView({ data, technical, fundamental }: {
  data: AssetData;
  technical: TechnicalAnalysis;
  fundamental: FundamentalAnalysis | null;
}) {
  const { ready, level, watchlist, toggleWatch } = useLevel();
  const { quote, candles, fundamentals: f } = data;

  const charts = useMemo(() => {
    const close = candles.map((c) => c.close);
    const bb = bollinger(close);
    const m = macd(close);
    return {
      sma50: sma(close, 50),
      sma200: sma(close, 200),
      bbUpper: bb.upper,
      bbLower: bb.lower,
      rsi: rsi(close),
      macd: m.macd,
      signal: m.signal,
      hist: m.histogram,
    };
  }, [candles]);

  const overlays = useMemo<Overlay[]>(() => {
    if (!level) return [];
    const list: Overlay[] = [
      { label: "Media 50 zile", color: "#60a5fa", values: charts.sma50 },
      { label: "Media 200 zile", color: "#f59e0b", values: charts.sma200 },
    ];
    if (level === "advanced") {
      list.push(
        { label: "Bollinger sus", color: "#a78bfa", values: charts.bbUpper, dashed: true },
        { label: "Bollinger jos", color: "#a78bfa", values: charts.bbLower, dashed: true },
      );
    }
    return list;
  }, [charts, level]);

  const rsiLines = useMemo<Overlay[]>(() => [{ label: "RSI", color: "#38bdf8", values: charts.rsi }], [charts]);
  const macdLines = useMemo<Overlay[]>(
    () => [
      { label: "MACD", color: "#38bdf8", values: charts.macd },
      { label: "Semnal", color: "#f59e0b", values: charts.signal },
    ],
    [charts],
  );
  const rsiBands = useMemo(() => [30, 70], []);
  const levels = level === "beginner" ? undefined : technical.levels;

  if (!ready) return null;
  if (!level) return <Onboarding />;

  const watched = watchlist.includes(quote.symbol);
  const up = quote.change >= 0;

  return (
    <div className="space-y-6">
      {data.demo && <DemoBanner />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted">
            <Link href="/" className="hover:underline">Piețe</Link> / {MARKET_LABELS[quote.market]}
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {quote.name} <span className="text-base font-normal text-muted">{quote.symbol}</span>
          </h1>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold">{formatPrice(quote.price, quote.currency)}</span>
            <span className={up ? "text-up" : "text-down"}>
              {up ? "+" : ""}
              {formatPrice(quote.change)} ({formatPercent(quote.changePercent)})
            </span>
          </div>
        </div>
        <button
          onClick={() => toggleWatch(quote.symbol)}
          className={`rounded-lg border px-4 py-2 text-sm ${watched ? "border-accent bg-accent/15" : "border-line bg-panel hover:border-accent"}`}
        >
          {watched ? "★ În watchlist" : "☆ Adaugă în watchlist"}
        </button>
      </header>

      <Disclaimer />

      <section className="rounded-xl border border-line bg-panel p-4">
        <PriceChart candles={candles} overlays={overlays} levels={levels} />
        {level === "beginner" && (
          <p className="mt-3 text-sm text-muted">
            Fiecare bară arată evoluția prețului într-o zi: verde dacă a crescut, roșu dacă a scăzut. Liniile colorate
            sunt prețul mediu din ultimele 50, respectiv 200 de zile și arată direcția generală.
          </p>
        )}
      </section>

      {level !== "beginner" && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-panel p-4">
            <h3 className="mb-2 text-sm font-semibold">RSI (14)</h3>
            <OscillatorChart candles={candles} lines={rsiLines} bands={rsiBands} />
          </div>
          <div className="rounded-xl border border-line bg-panel p-4">
            <h3 className="mb-2 text-sm font-semibold">MACD (12, 26, 9)</h3>
            <OscillatorChart candles={candles} lines={macdLines} histogram={charts.hist} />
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Analiză tehnică</h2>
          <SummaryCard title="Rezumat tehnic" summary={technical.summary} level={level} />
          <SignalList signals={technical.signals} level={level} />
          {level !== "beginner" && (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Suporturi" value={technical.levels.support.map((p) => formatPrice(p)).join(" · ") || "–"} />
              <Metric label="Rezistențe" value={technical.levels.resistance.map((p) => formatPrice(p)).join(" · ") || "–"} />
              {level === "advanced" && technical.atrPercent !== null && (
                <Metric label="Volatilitate zilnică (ATR 14)" value={`${(technical.atrPercent * 100).toFixed(2)}%`} />
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Analiză fundamentală</h2>
          {quote.market === "forex" && (
            <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
              Perechile valutare nu au date fundamentale de companie. Cursul este influențat de dobânzile băncilor
              centrale, inflație, balanța comercială și evenimente geopolitice.
            </p>
          )}
          {quote.market === "crypto" && f && (
            <>
              <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
                Criptomonedele nu au profit sau venituri ca o companie. Mai jos sunt datele de piață principale.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Capitalizare" value={formatBig(f.marketCap)} />
                <Metric label="Volum 24h" value={formatBig(f.volume24h)} />
                <Metric label="Monede în circulație" value={formatBig(f.circulatingSupply)} />
                <Metric label="Interval 52 săpt." value={`${numOrDash(f.fiftyTwoWeekLow)} – ${numOrDash(f.fiftyTwoWeekHigh)}`} />
              </div>
            </>
          )}
          {quote.market === "stocks" && f && fundamental && (
            <>
              <SummaryCard title="Rezumat fundamental" summary={fundamental.summary} level={level} />
              <SignalList signals={fundamental.signals} level={level} />
              {level === "advanced" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric label="Capitalizare" value={formatBig(f.marketCap)} />
                  <Metric label="P/E forward" value={numOrDash(f.forwardPE)} />
                  <Metric label="P/B" value={numOrDash(f.priceToBook)} />
                  <Metric label="EPS" value={numOrDash(f.eps)} />
                  <Metric label="Creștere profit" value={pctOrDash(f.earningsGrowth)} />
                  <Metric label="Marjă operațională" value={pctOrDash(f.operatingMargin)} />
                  <Metric label="Current ratio" value={numOrDash(f.currentRatio)} />
                  <Metric label="Beta" value={numOrDash(f.beta)} />
                  <Metric label="Interval 52 săpt." value={`${numOrDash(f.fiftyTwoWeekLow)} – ${numOrDash(f.fiftyTwoWeekHigh)}`} />
                </div>
              )}
              {(f.sector || f.description) && level !== "beginner" && (
                <div className="rounded-xl border border-line bg-panel p-4 text-sm">
                  {f.sector && (
                    <div className="text-muted">
                      {f.sector}
                      {f.industry ? ` · ${f.industry}` : ""}
                    </div>
                  )}
                  {f.description && <p className="mt-2 line-clamp-6">{f.description}</p>}
                </div>
              )}
            </>
          )}
          {quote.market === "stocks" && !f && (
            <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
              Datele fundamentale nu sunt disponibile pentru acest simbol.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
