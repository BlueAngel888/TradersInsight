"use client";

import Link from "next/link";
import { useState } from "react";
import { MARKET_LABELS } from "@/lib/catalog";
import type { Market, Quote } from "@/lib/types";
import { useLevel } from "./LevelProvider";
import { Onboarding } from "./Onboarding";
import { DemoBanner } from "./DemoBanner";
import { formatPercent, formatPrice } from "./format";

const INTRO: Record<Market, string> = {
  stocks: "Acțiunile sunt părți dintr-o companie. Prețul lor depinde de rezultatele firmei și de așteptările investitorilor.",
  crypto: "Criptomonedele sunt active digitale, foarte volatile: prețul poate varia cu peste 10% într-o singură zi.",
  forex: "Forex înseamnă schimbul valutar. Prețul arată câte unități din a doua monedă primești pentru una din prima.",
};

export function QuoteTable({ quotes }: { quotes: Quote[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
      {quotes.map((q) => {
        const up = q.changePercent >= 0;
        return (
          <li key={q.symbol}>
            <Link href={`/asset/${encodeURIComponent(q.symbol)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-panel-hover">
              <div className="min-w-0">
                <div className="truncate font-medium">{q.name}</div>
                <div className="text-xs text-muted">{q.symbol}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{formatPrice(q.price, q.currency)}</div>
                <div className={`text-xs ${up ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MarketBoard({ quotes, demo }: { quotes: Quote[]; demo: boolean }) {
  const { ready, level } = useLevel();
  const [market, setMarket] = useState<Market>("stocks");
  if (!ready) return null;
  if (!level) return <Onboarding />;

  return (
    <div className="space-y-5">
      {demo && <DemoBanner />}
      <div>
        <h1 className="text-2xl font-bold">Piețe</h1>
        <p className="mt-1 text-sm text-muted">Alege un activ ca să vezi analiza tehnică și fundamentală.</p>
      </div>
      <div className="flex gap-2">
        {(Object.keys(MARKET_LABELS) as Market[]).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            className={`rounded-lg border px-4 py-1.5 text-sm ${m === market ? "border-accent bg-accent/15" : "border-line bg-panel hover:border-accent"}`}
          >
            {MARKET_LABELS[m]}
          </button>
        ))}
      </div>
      {level === "beginner" && <p className="rounded-lg border border-line bg-panel p-3 text-sm text-muted">{INTRO[market]}</p>}
      <QuoteTable quotes={quotes.filter((q) => q.market === market)} />
    </div>
  );
}
