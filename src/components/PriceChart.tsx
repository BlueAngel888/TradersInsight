"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/types";
import type { Series } from "@/lib/indicators";

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

export function PriceChart({ candles, overlays, levels }: {
  candles: Candle[];
  overlays: Overlay[];
  levels?: { support: number[]; resistance: number[] };
}) {
  const ref = useRef<HTMLDivElement>(null);

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
    levels?.support.forEach((p) =>
      series.createPriceLine({ price: p, color: COLORS.up, lineStyle: 3, lineWidth: 1, axisLabelVisible: true, title: "S" }),
    );
    levels?.resistance.forEach((p) =>
      series.createPriceLine({ price: p, color: COLORS.down, lineStyle: 3, lineWidth: 1, axisLabelVisible: true, title: "R" }),
    );
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 180), to: candles.length });
    return () => chart.remove();
  }, [candles, overlays, levels]);

  return (
    <div>
      <div ref={ref} className="h-[360px] w-full" />
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
