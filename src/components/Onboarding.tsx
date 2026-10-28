"use client";

import { LEVELS, useLevel } from "./LevelProvider";

export function Onboarding() {
  const { setLevel } = useLevel();
  return (
    <section className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-bold tracking-tight">Bine ai venit în Traders Insight</h1>
      <p className="mt-3 text-muted">
        Analiză tehnică și fundamentală pentru acțiuni, crypto și forex, explicată pe înțelesul tău.
        Ca să adaptăm informațiile, spune-ne ce experiență ai în trading.
      </p>
      <div className="mt-8 grid gap-3">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            className="rounded-xl border border-line bg-panel p-5 text-left transition hover:border-accent hover:bg-panel-hover"
          >
            <div className="text-lg font-semibold">{l.label}</div>
            <div className="mt-1 text-sm text-muted">{l.description}</div>
          </button>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">Poți schimba nivelul oricând din meniul de sus.</p>
    </section>
  );
}
