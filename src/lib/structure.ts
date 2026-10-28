// Turns the market-structure models in advanced.ts into level-aware signals
// plus the overlays the chart draws.
import {
  adaptiveThreshold,
  anchoredVwap,
  elliott,
  keyLevels,
  smartMoney,
  volumeProfile,
  wyckoff,
  zigzag,
  type ElliottResult,
  type KeyLevel,
  type VolumeProfile,
  type WyckoffResult,
  type Zone,
} from "./advanced";
import { summarize, type Signal, type Summary, type Verdict } from "./analysis";
import type { Candle } from "./types";

export interface ChartMarker {
  index: number;
  position: "aboveBar" | "belowBar";
  text: string;
  color: string;
}

export interface StructureAnalysis {
  signals: Signal[];
  summary: Summary;
  hasVolume: boolean;
  profile: VolumeProfile | null;
  vwap: { values: (number | null)[]; upper: (number | null)[]; lower: (number | null)[]; anchorIndex: number } | null;
  zones: Zone[];
  smcMarkers: ChartMarker[];
  elliottMarkers: ChartMarker[];
  elliott: ElliottResult;
  wyckoff: WyckoffResult | null;
  levels: { support: KeyLevel[]; resistance: KeyLevel[] };
}

const fmt = (n: number) => {
  const d = Math.abs(n) < 10 ? 4 : 2;
  return n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
};

const WYCKOFF_TEXT: Record<WyckoffResult["phase"], { name: string; simple: string; verdict: Verdict }> = {
  accumulation: {
    name: "Acumulare",
    simple: "După o scădere, prețul s-a stabilizat într-un interval. Uneori, în astfel de perioade investitorii mari cumpără treptat.",
    verdict: "neutral",
  },
  reaccumulation: {
    name: "Reacumulare",
    simple: "Prețul face o pauză după o creștere, iar cumpărătorii rămân mai activi decât vânzătorii.",
    verdict: "positive",
  },
  distribution: {
    name: "Distribuție",
    simple: "După o creștere, prețul s-a blocat într-un interval. Uneori, în astfel de perioade investitorii mari vând treptat.",
    verdict: "neutral",
  },
  redistribution: {
    name: "Redistribuție",
    simple: "Prețul face o pauză după o scădere, iar vânzătorii rămân mai activi decât cumpărătorii.",
    verdict: "negative",
  },
  markup: { name: "Markup (creștere)", simple: "Prețul este într-o fază de creștere.", verdict: "positive" },
  markdown: { name: "Markdown (scădere)", simple: "Prețul este într-o fază de scădere.", verdict: "negative" },
};

const WYCKOFF_EVENT: Record<NonNullable<WyckoffResult["event"]>, string> = {
  spring: "Spring: o scurtă coborâre sub suportul intervalului, urmată de revenire (semn posibil de absorbție a ofertei).",
  upthrust: "Upthrust: o scurtă urcare peste rezistența intervalului, urmată de revenire (semn posibil de epuizare a cererii).",
  sos: "Sign of Strength: închidere peste rezistența intervalului.",
  sow: "Sign of Weakness: închidere sub suportul intervalului.",
};

function zoneText(z: Zone) {
  return `${fmt(z.bottom)} – ${fmt(z.top)}`;
}

export function analyzeStructure(candles: Candle[]): StructureAnalysis {
  const price = candles[candles.length - 1].close;
  const hasVolume = candles.slice(-120).some((c) => c.volume > 0);
  const signals: Signal[] = [];

  // --- SMC
  const smc = smartMoney(candles);
  const recentOb = smc.orderBlocks.find((z) => (z.direction === "bullish" ? z.top <= price : z.bottom >= price));
  const recentFvg = smc.fairValueGaps[0];
  const ev = smc.lastEvent;
  const zoneLabel = smc.zone === "premium" ? "premium" : smc.zone === "discount" ? "discount" : "echilibru";
  signals.push({
    id: "smc",
    name: "Smart Money Concepts",
    value: `Structură ${smc.trend === "bullish" ? "ascendentă" : smc.trend === "bearish" ? "descendentă" : "neclară"}${
      ev ? ` · ultimul ${ev.kind} ${ev.direction === "bullish" ? "↑" : "↓"} la ${fmt(ev.level)}` : ""
    } · zonă ${zoneLabel}`,
    verdict: smc.trend === "bullish" ? "positive" : smc.trend === "bearish" ? "negative" : "neutral",
    simple:
      (smc.trend === "bullish"
        ? "Prețul face maxime și minime tot mai sus: structura pieței este ascendentă."
        : smc.trend === "bearish"
          ? "Prețul face maxime și minime tot mai jos: structura pieței este descendentă."
          : "Structura pieței nu are încă o direcție clară.") +
      (ev?.kind === "CHoCH" ? " Recent, direcția s-a schimbat, ceea ce poate marca începutul unui nou trend." : "") +
      ` Prețul este în jumătatea ${smc.zone === "premium" ? "scumpă (premium)" : smc.zone === "discount" ? "ieftină (discount)" : "de mijloc"} a intervalului recent.`,
    detail: [
      `Dealing range ${fmt(smc.range.low)} – ${fmt(smc.range.high)}, echilibru ${fmt(smc.range.equilibrium)}.`,
      recentOb ? `Order block ${recentOb.direction === "bullish" ? "bullish" : "bearish"} nemitigat: ${zoneText(recentOb)}.` : "",
      recentFvg ? `Fair value gap ${recentFvg.direction === "bullish" ? "bullish" : "bearish"} neumplut: ${zoneText(recentFvg)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  // --- Wyckoff (needs volume to judge supply and demand)
  const wy = wyckoff(candles);
  if (wy) {
    const t = WYCKOFF_TEXT[wy.phase];
    let verdict = t.verdict;
    if (wy.event === "spring" || wy.event === "sos") verdict = "positive";
    if (wy.event === "upthrust" || wy.event === "sow") verdict = "negative";
    signals.push({
      id: "wyckoff",
      name: "Wyckoff",
      value: `${t.name}${wy.event ? ` · ${wy.event.toUpperCase()}` : ""}`,
      verdict,
      simple: t.simple + (wy.event ? ` ${WYCKOFF_EVENT[wy.event].split(":")[0]} detectat recent.` : ""),
      detail: [
        `Interval ${fmt(wy.rangeLow)} – ${fmt(wy.rangeHigh)} (ultimele ~60 de sesiuni), trend anterior ${wy.priorTrend === "up" ? "ascendent" : "descendent"}.`,
        wy.demandRatio !== null && hasVolume
          ? `Volum mediu zile de creștere / zile de scădere: ${wy.demandRatio.toFixed(2)}.`
          : "Fără date de volum: faza se estimează doar din preț.",
        wy.event ? WYCKOFF_EVENT[wy.event] : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  // --- Elliott
  const el = elliott(candles);
  const elText: Record<ElliottResult["pattern"], string> = {
    "impulse-complete": "Impuls de 5 valuri încheiat",
    wave5: "Valul 5 în desfășurare",
    wave3: "Valul 3 în desfășurare",
    correction: "Corecție A-B-C",
    none: "Fără model clar",
  };
  const up = el.direction === "bullish";
  let elVerdict: Verdict = "neutral";
  if (el.pattern === "wave3" || el.pattern === "wave5") elVerdict = up ? "positive" : "negative";
  if (el.pattern === "impulse-complete") elVerdict = up ? "negative" : "positive"; // a correction usually follows
  signals.push({
    id: "elliott",
    name: "Valuri Elliott",
    value: `${elText[el.pattern]}${el.pattern !== "none" ? (up ? " (sus)" : " (jos)") : ""}`,
    verdict: elVerdict,
    simple:
      el.pattern === "wave3"
        ? `Prețul pare să fie în cea mai puternică etapă a unei mișcări ${up ? "de creștere" : "de scădere"}.`
        : el.pattern === "wave5"
          ? `Prețul pare să fie în ultima etapă a unei mișcări ${up ? "de creștere" : "de scădere"}. După ea urmează de obicei o corecție.`
          : el.pattern === "impulse-complete"
            ? `O mișcare completă ${up ? "de creștere" : "de scădere"} pare încheiată. De obicei urmează o corecție în sens opus.`
            : el.pattern === "correction"
              ? "Prețul pare să fie într-o corecție, o pauză temporară față de trendul principal."
              : "Mișcările recente nu se potrivesc clar cu un model Elliott.",
    detail:
      el.pattern === "none"
        ? "Pivoții zigzag nu respectă regulile de impuls (valul 2 nu depășește începutul valului 1, valul 3 nu e cel mai scurt, valul 4 nu se suprapune cu valul 1)."
        : [
            el.target !== null ? `Țintă Fibonacci estimată: ${fmt(el.target)}.` : "",
            el.invalidation !== null ? `Numărătoarea se invalidează la ${fmt(el.invalidation)}.` : "",
            "Numărătoare automată pe pivoți zigzag; interpretarea valurilor rămâne subiectivă.",
          ]
            .filter(Boolean)
            .join(" "),
  });

  // --- Volume profile and VWAP
  const profile = hasVolume ? volumeProfile(candles) : null;

  // --- Support / resistance
  const levels = keyLevels(candles, profile);
  const s1 = levels.support[0];
  const r1 = levels.resistance[0];
  const dist = (l: KeyLevel) => Math.abs(l.price / price - 1);
  const nearSupport = s1 && dist(s1) < 0.02;
  const nearResistance = r1 && dist(r1) < 0.02;
  signals.push({
    id: "levels",
    name: "Suport și rezistență",
    value: `S ${s1 ? fmt(s1.price) : "–"} · R ${r1 ? fmt(r1.price) : "–"}`,
    verdict: nearSupport && !nearResistance ? "positive" : nearResistance && !nearSupport ? "negative" : "neutral",
    simple: [
      s1 ? `Cel mai apropiat nivel unde prețul s-a oprit din scădere în trecut este ${fmt(s1.price)} (${(dist(s1) * 100).toFixed(1)}% sub prețul actual).` : "Nu există un suport clar sub prețul actual.",
      r1 ? `Cel mai apropiat nivel unde s-a oprit din creștere este ${fmt(r1.price)} (${(dist(r1) * 100).toFixed(1)}% deasupra).` : "Nu există o rezistență clară deasupra prețului.",
    ].join(" "),
    detail: [
      ...levels.support.map((l) => `Suport ${fmt(l.price)}: ${l.touches} atingeri, putere ${l.strength}/3.`),
      ...levels.resistance.map((l) => `Rezistență ${fmt(l.price)}: ${l.touches} atingeri, putere ${l.strength}/3.`),
      "Puterea crește cu numărul de atingeri și cu confirmarea din Volume Profile.",
    ].join(" "),
  });

  if (profile) {
    const verdict: Verdict = price > profile.vah ? "positive" : price < profile.val ? "negative" : "neutral";
    signals.push({
      id: "volumeProfile",
      name: "Volume Profile (120 sesiuni)",
      value: `POC ${fmt(profile.poc)} · VA ${fmt(profile.val)} – ${fmt(profile.vah)}`,
      verdict,
      simple:
        `Cele mai multe tranzacții din ultimele luni s-au făcut în jurul prețului ${fmt(profile.poc)}. ` +
        (verdict === "positive"
          ? "Prețul a urcat peste zona în care s-a tranzacționat cel mai mult, semn de interes din partea cumpărătorilor."
          : verdict === "negative"
            ? "Prețul a coborât sub zona în care s-a tranzacționat cel mai mult, semn de presiune din partea vânzătorilor."
            : "Prețul se află în zona în care s-a tranzacționat cel mai mult, unde piața consideră prețul „corect”."),
      detail: `Point of Control ${fmt(profile.poc)}, Value Area (70% din volum) ${fmt(profile.val)} – ${fmt(profile.vah)}.${
        profile.hvn.length ? ` Noduri de volum ridicat: ${profile.hvn.map(fmt).join(", ")}.` : ""
      }`,
    });
  }

  let vwap: StructureAnalysis["vwap"] = null;
  if (hasVolume) {
    // Anchor at the last major zigzag pivot, a common anchored-VWAP choice.
    const pivots = zigzag(candles, adaptiveThreshold(candles) * 1.5);
    const anchor = pivots.length ? pivots[pivots.length - 1] : { index: Math.max(0, candles.length - 120), type: "L" as const };
    const v = anchoredVwap(candles, anchor.index);
    const now = v?.values[v.values.length - 1] ?? null;
    if (v && now !== null) {
      vwap = { ...v, anchorIndex: anchor.index };
      const above = price > now;
      const sdNow = (v.upper[v.upper.length - 1] as number) - now;
      signals.push({
        id: "vwap",
        name: "VWAP ancorat",
        value: `${fmt(now)} · preț ${above ? "peste" : "sub"} VWAP`,
        verdict: above ? "positive" : "negative",
        simple: above
          ? "Prețul este peste prețul mediu plătit de cumpărători de la ultima întoarcere majoră: în medie, aceștia sunt pe profit."
          : "Prețul este sub prețul mediu plătit de cumpărători de la ultima întoarcere majoră: în medie, aceștia sunt pe pierdere.",
        detail: `VWAP ancorat la ${anchor.type === "L" ? "minimul" : "maximul"} major din ${new Date(candles[anchor.index].time * 1000).toLocaleDateString("ro-RO")}: ${fmt(now)}, benzi ±1σ ${fmt(now - sdNow)} – ${fmt(now + sdNow)}. Pe date zilnice nu se calculează VWAP-ul intraday.`,
      });
    }
  }

  const smcMarkers: ChartMarker[] = smc.events.slice(-4).map((e) => ({
    index: e.index,
    position: e.direction === "bullish" ? "aboveBar" : "belowBar",
    text: e.kind,
    color: e.direction === "bullish" ? "#22c55e" : "#ef4444",
  }));
  const elliottMarkers: ChartMarker[] = el.labels
    .filter((l) => l.label)
    .map((l) => {
      const isHigh = candles[l.index].high === l.price;
      return { index: l.index, position: isHigh ? "aboveBar" : "belowBar", text: l.label, color: "#f59e0b" };
    });

  return {
    signals,
    summary: summarize(signals),
    hasVolume,
    profile,
    vwap,
    zones: [...smc.orderBlocks.slice(0, 2), ...smc.fairValueGaps.slice(0, 2)],
    smcMarkers,
    elliottMarkers,
    elliott: el,
    wyckoff: wy,
    levels,
  };
}
