"use client";

import { useEffect, useMemo, useState } from "react";
import type { Signal, TechnicalAnalysis } from "@/lib/analysis";
import { bollinger, sma } from "@/lib/indicators";
import type { StructureAnalysis } from "@/lib/structure";
import type { Candle, Level } from "@/lib/types";
import { PriceChart, type Marker, type Overlay, type PriceLine } from "./PriceChart";
import { VerdictBadge } from "./VerdictBadge";

type Tab = "ma" | "levels" | "smc" | "wyckoff" | "elliott" | "profile" | "vwap" | "bollinger";

const TABS: { id: Tab; label: string; needsVolume?: boolean; about: string }[] = [
  { id: "ma", label: "Medii mobile", about: "Prețul mediu pe 50 și 200 de zile arată direcția generală." },
  { id: "levels", label: "Suport / Rezistență", about: "Niveluri unde prețul s-a oprit în trecut. Stelele arată cât de important e nivelul." },
  { id: "smc", label: "SMC", about: "Smart Money Concepts: structura pieței (BOS, CHoCH), order blocks și fair value gaps." },
  { id: "wyckoff", label: "Wyckoff", about: "Fazele de acumulare, creștere, distribuție și scădere ale unui ciclu de piață." },
  { id: "elliott", label: "Elliott", about: "Mișcările prețului numărate ca valuri: 5 în direcția trendului, 3 de corecție." },
  { id: "profile", label: "Volume Profile", needsVolume: true, about: "La ce prețuri s-a tranzacționat cel mai mult volum." },
  { id: "vwap", label: "VWAP", needsVolume: true, about: "Prețul mediu ponderat cu volumul, de la ultima întoarcere majoră." },
  { id: "bollinger", label: "Bollinger", about: "Intervalul obișnuit de variație a prețului în ultima lună." },
];

const DEFAULT_TABS: Record<Level, Tab[]> = {
  beginner: ["ma", "levels"],
  intermediate: ["ma", "levels", "vwap"],
  advanced: ["levels", "smc", "vwap"],
};

// Which observation (from the analysis) describes each tab.
const TAB_SIGNAL: Record<Tab, string> = {
  ma: "trend",
  levels: "levels",
  smc: "smc",
  wyckoff: "wyckoff",
  elliott: "elliott",
  profile: "volumeProfile",
  vwap: "vwap",
  bollinger: "bollinger",
};

const TABS_KEY = "ti:chartTabs";

const GREEN = "#22c55e";
const RED = "#ef4444";

export function ChartWorkspace({ candles, level, technical, structure }: {
  candles: Candle[];
  level: Level;
  technical: TechnicalAnalysis;
  structure: StructureAnalysis;
}) {
  const available = TABS.filter((t) => !t.needsVolume || structure.hasVolume);
  const [active, setActive] = useState<Tab[]>(DEFAULT_TABS[level]);

  // Remember the user's tab choice per level.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${TABS_KEY}:${level}`) ?? "null");
      setActive(Array.isArray(saved) ? saved : DEFAULT_TABS[level]);
    } catch {
      setActive(DEFAULT_TABS[level]);
    }
  }, [level]);

  const toggle = (id: Tab) =>
    setActive((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(`${TABS_KEY}:${level}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

  const on = (id: Tab) => active.includes(id) && available.some((t) => t.id === id);

  const series = useMemo(() => {
    const close = candles.map((c) => c.close);
    const bb = bollinger(close);
    return { sma50: sma(close, 50), sma200: sma(close, 200), bbUpper: bb.upper, bbLower: bb.lower };
  }, [candles]);

  const overlays = useMemo<Overlay[]>(() => {
    const list: Overlay[] = [];
    if (on("ma")) {
      list.push(
        { label: "Media 50 zile", color: "#60a5fa", values: series.sma50 },
        { label: "Media 200 zile", color: "#f59e0b", values: series.sma200 },
      );
    }
    if (on("bollinger")) {
      list.push(
        { label: "Bollinger sus", color: "#a78bfa", values: series.bbUpper, dashed: true },
        { label: "Bollinger jos", color: "#a78bfa", values: series.bbLower, dashed: true },
      );
    }
    if (on("vwap") && structure.vwap) {
      list.push({ label: "VWAP ancorat", color: "#f472b6", values: structure.vwap.values });
      if (level !== "beginner") {
        list.push(
          { label: "VWAP +1σ", color: "#f472b6", values: structure.vwap.upper, dashed: true },
          { label: "VWAP −1σ", color: "#f472b6", values: structure.vwap.lower, dashed: true },
        );
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, series, structure.vwap, level]);

  const lines = useMemo<PriceLine[]>(() => {
    const out: PriceLine[] = [];
    if (on("levels")) {
      structure.levels.support.forEach((l) =>
        out.push({ price: l.price, color: GREEN, title: `S ${"★".repeat(l.strength)}`, width: l.strength === 3 ? 2 : 1 }),
      );
      structure.levels.resistance.forEach((l) =>
        out.push({ price: l.price, color: RED, title: `R ${"★".repeat(l.strength)}`, width: l.strength === 3 ? 2 : 1 }),
      );
    }
    if (on("smc")) {
      for (const z of structure.zones) {
        const color = z.direction === "bullish" ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)";
        out.push(
          { price: z.top, color, title: "", style: 1, axisLabel: false },
          { price: z.bottom, color, title: "", style: 1, axisLabel: false },
        );
      }
    }
    if (on("wyckoff") && structure.wyckoff) {
      out.push(
        { price: structure.wyckoff.rangeHigh, color: "#38bdf8", title: "Wyckoff sus", style: 2 },
        { price: structure.wyckoff.rangeLow, color: "#38bdf8", title: "Wyckoff jos", style: 2 },
      );
    }
    if (on("elliott")) {
      if (structure.elliott.target !== null) out.push({ price: structure.elliott.target, color: "#f59e0b", title: "Țintă", style: 2 });
      if (structure.elliott.invalidation !== null)
        out.push({ price: structure.elliott.invalidation, color: "#f59e0b", title: "Invalidare", style: 3 });
    }
    if (on("profile") && structure.profile) {
      out.push(
        { price: structure.profile.poc, color: "#facc15", title: "POC", style: 0, width: 2 },
        { price: structure.profile.vah, color: "#facc15", title: "VAH", style: 2 },
        { price: structure.profile.val, color: "#facc15", title: "VAL", style: 2 },
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, structure]);

  const markers = useMemo<Marker[]>(
    () => [...(on("smc") ? structure.smcMarkers : []), ...(on("elliott") ? structure.elliottMarkers : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, structure],
  );

  const observations = useMemo(() => {
    const all: Signal[] = [...technical.signals, ...structure.signals];
    return available
      .filter((t) => active.includes(t.id))
      .map((t) => ({ tab: t, obs: all.find((s) => s.id === TAB_SIGNAL[t.id]) }))
      .filter((x): x is { tab: (typeof TABS)[number]; obs: Signal } => Boolean(x.obs));
  }, [active, available, technical.signals, structure.signals]);

  const showProfile = on("profile");

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Sisteme de analiză afișate pe grafic">
        {available.map((t) => (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            aria-pressed={active.includes(t.id)}
            title={t.about}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              active.includes(t.id) ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:border-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PriceChart
        candles={candles}
        overlays={overlays}
        lines={lines}
        markers={markers}
        profile={showProfile ? structure.profile : null}
      />

      {!structure.hasVolume && (
        <p className="mt-3 text-xs text-muted">
          Pentru acest activ nu există date de volum (normal la forex), așa că Volume Profile și VWAP nu sunt disponibile.
        </p>
      )}

      {observations.length > 0 ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold">Ce arată graficul</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {observations.map(({ tab, obs }) => (
              <li key={tab.id} className="rounded-lg border border-line bg-bg/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{tab.label}</div>
                    {level !== "beginner" && <div className="mt-0.5 font-mono text-xs">{obs.value}</div>}
                  </div>
                  <VerdictBadge verdict={obs.verdict} />
                </div>
                {level === "beginner" && <p className="mt-1 text-xs text-muted">{tab.about}</p>}
                <p className="mt-2 text-sm text-muted">{level === "advanced" ? obs.detail : obs.simple}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Alege unul sau mai multe sisteme de analiză de deasupra graficului.</p>
      )}
    </section>
  );
}
