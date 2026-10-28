"use client";

import { useEffect, useRef, useState } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/types";
import type { Series } from "@/lib/indicators";
import type { VolumeProfile } from "@/lib/advanced";

export interface Overlay {
  label: string;
  color: string;
  values: Series;
  dashed?: boolean;
}

const COLORS = {
  text: "#9aa4b2",
  grid: "rgba(148,163,184,0.08)",
  up: "#22c55e",
  down: "#ef4444",
};

function toLine(candles: Candle[], values: Series) {
  return candles
    .map((c, i) => ({ time: c.time as UTCTimestamp, value: values[i] }))
    .filter((p): p is { time: UTCTimestamp; value: number } => p.value !== null);
}

function baseChart(el: HTMLDivElement, height: number): IChartApi {
  return createChart(el, {
    height,
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: COLORS.text },
    grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    crosshair: { mode: 0 },
  });
}

export interface PriceLine {
  price: number;
  color: string;
  title: string;
  style?: 0 | 1 | 2 | 3 | 4; // lightweight-charts LineStyle
  width?: 1 | 2 | 3;
  axisLabel?: boolean;
}

interface ProfileBar {
  top: number;
  height: number;
  width: number; // 0..1
  kind: "poc" | "value" | "other";
}

export interface Marker {
  index: number;
  position: "aboveBar" | "belowBar";
  text: string;
  color: string;
}

export function PriceChart({ candles, overlays, lines = [], markers = [], profile = null }: {
  candles: Candle[];
  overlays: Overlay[];
  lines?: PriceLine[];
  markers?: Marker[];
  /** Drawn as a horizontal histogram aligned with the price scale. */
  profile?: VolumeProfile | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<ProfileBar[]>([]);
  const [scaleWidth, setScaleWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const chart = baseChart(ref.current, 360);
    const series = chart.addCandlestickSeries({
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderVisible: false,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
    });
    series.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    for (const o of overlays) {
      const line = chart.addLineSeries({
        color: o.color,
        lineWidth: 2,
        lineStyle: o.dashed ? 2 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(toLine(candles, o.values));
    }
    for (const l of lines) {
      series.createPriceLine({
        price: l.price,
        color: l.color,
        lineStyle: l.style ?? 3,
        lineWidth: l.width ?? 1,
        axisLabelVisible: l.axisLabel ?? true,
        title: l.title,
      });
    }
    series.setMarkers(
      [...markers]
        .sort((a, b) => a.index - b.index)
        .map((m) => ({
          time: candles[m.index].time as UTCTimestamp,
          position: m.position,
          color: m.color,
          shape: "circle" as const,
          size: 0.5,
          text: m.text,
        })),
    );
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 180), to: candles.length });

    // Keep the volume profile aligned with the price axis as the chart scrolls,
    // zooms or resizes.
    let frame = 0;
    const layoutProfile = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!profile) return setBars([]);
        const max = Math.max(...profile.bins.map((b) => b.volume)) || 1;
        const out: ProfileBar[] = [];
        for (const b of profile.bins) {
          const y1 = series.priceToCoordinate(b.high);
          const y2 = series.priceToCoordinate(b.low);
          if (y1 === null || y2 === null) continue;
          const isPoc = profile.poc >= b.low && profile.poc <= b.high;
          const inValue = b.low >= profile.val - 1e-9 && b.high <= profile.vah + 1e-9;
          out.push({
            top: y1,
            height: Math.max(1, y2 - y1 - 1),
            width: b.volume / max,
            kind: isPoc ? "poc" : inValue ? "value" : "other",
          });
        }
        setScaleWidth(chart.priceScale("right").width());
        setBars(out);
      });
    };
    // The price scale settles only after the first paint, so lay out again shortly after.
    const settle = setTimeout(layoutProfile, 60);
    chart.timeScale().subscribeVisibleLogicalRangeChange(layoutProfile);
    const ro = new ResizeObserver(layoutProfile);
    ro.observe(ref.current);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      ro.disconnect();
      chart.remove();
    };
  }, [candles, overlays, lines, markers, profile]);

  return (
    <div>
      <div className="relative">
        <div ref={ref} className="h-[360px] w-full" />
        {profile && (
          <div
            className="pointer-events-none absolute inset-y-0 w-1/4 overflow-hidden"
            style={{ right: scaleWidth }}
            aria-hidden
          >
            {bars.map((b, i) => (
              <div
                key={i}
                className={`absolute right-0 rounded-l-sm ${
                  b.kind === "poc" ? "bg-yellow-400/60" : b.kind === "value" ? "bg-sky-400/30" : "bg-slate-400/20"
                }`}
                style={{ top: b.top, height: b.height, width: `${b.width * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>
      {overlays.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          {overlays.map((o) => (
            <span key={o.label} className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4" style={{ background: o.color }} />
              {o.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function OscillatorChart({ candles, lines, histogram, bands }: {
  candles: Candle[];
  lines: Overlay[];
  histogram?: Series;
  bands?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = baseChart(ref.current, 140);
    if (histogram) {
      const h = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      h.setData(
        toLine(candles, histogram).map((p) => ({ ...p, color: p.value >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" })),
      );
    }
    lines.forEach((o, idx) => {
      const s = chart.addLineSeries({ color: o.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: idx === 0 });
      s.setData(toLine(candles, o.values));
      if (idx === 0) bands?.forEach((b) => s.createPriceLine({ price: b, color: COLORS.text, lineStyle: 2, lineWidth: 1, axisLabelVisible: false, title: "" }));
    });
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 180), to: candles.length });
    return () => chart.remove();
  }, [candles, lines, histogram, bands]);

  return <div ref={ref} className="h-[140px] w-full" />;
}
