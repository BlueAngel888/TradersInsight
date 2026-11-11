"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/components/format";
import type { SetupResult } from "@/lib/setup";

interface Row { symbol: string; ltf: string; result: SetupResult | null; error?: string }

const TREND_LABEL = { bullish: "bullish", bearish: "bearish", neutral: "neutru" } as const;
const STATUS_LABEL = { waiting: "Aștept 0.786", triggered: "A atins 0.786", invalidated: "Invalidat" } as const;

export function Mt5Signals({ accessKey }: { accessKey: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mt5/scan", { headers: { "x-access-key": accessKey }, cache: "no-store" });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? `Eroare ${res.status}`);
      else {
        setRows(body.rows);
        setAt(body.scannedAt);
      }
    } catch {
      setError("Nu am putut contacta serverul.");
    } finally {
      setLoading(false);
    }
  }, [accessKey]);

  useEffect(() => {
    scan();
    const id = setInterval(scan, 120000);
    return () => clearInterval(id);
  }, [scan]);

  // One line per symbol: the setup if any LTF has one, otherwise the first row.
  const bySymbol = new Map<string, Row>();
  for (const r of rows ?? []) {
    const prev = bySymbol.get(r.symbol);
    if (!prev || (!prev.result?.setup && r.result?.setup)) bySymbol.set(r.symbol, r);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Semnale SMC (HTF → doji → 0.786)</h2>
        <button onClick={scan} disabled={loading} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel-hover">
          {loading ? "Scanez…" : "Scanează"}
        </button>
      </div>
      <p className="text-xs text-muted">Doar semnale. Niciun ordin nu este plasat automat.</p>
      {error && <p className="text-sm text-down">{error}</p>}
      {rows === null && !error && <p className="text-sm text-muted">Se scanează…</p>}
      <ul className="space-y-2">
        {[...bySymbol.values()].map((r) => {
          const t = r.result?.trend;
          const s = r.result?.setup;
          return (
            <li key={r.symbol} className="rounded-lg border border-line bg-panel p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.symbol}</span>
                {t && (
                  <span className="text-xs text-muted">
                    D1 {TREND_LABEL[t.d1]} · 4H {TREND_LABEL[t.h4]} · 1H {TREND_LABEL[t.h1]}
                  </span>
                )}
              </div>
              {r.error ? (
                <p className="mt-1 text-down">{r.error}</p>
              ) : s ? (
                <div className="mt-2 space-y-1">
                  <div>
                    <span className={s.direction === "bullish" ? "text-up" : "text-down"}>{s.direction === "bullish" ? "BUY LIMIT" : "SELL LIMIT"}</span>{" "}
                    pe {r.ltf} · <span className="font-semibold">{STATUS_LABEL[s.status]}</span>
                  </div>
                  <div className="text-xs text-muted">
                    Intrare {formatPrice(s.entry)} · SL {formatPrice(s.stopLoss)} ·{" "}
                    {s.targets.map((x) => `TP 1:${x.ratio} ${formatPrice(x.price)}`).join(" · ")}
                  </div>
                  <div className="text-xs text-muted">Doji la {new Date(s.dojiTime * 1000).toLocaleString("ro-RO")}, a luat lichiditatea de la {formatPrice(s.swept)}</div>
                  {s.confluence.length > 0 && <div className="text-xs">Confluențe: {s.confluence.join(", ")}</div>}
                </div>
              ) : (
                <p className="mt-1 text-muted">{r.result?.reason}</p>
              )}
            </li>
          );
        })}
      </ul>
      {at && <p className="text-xs text-muted">Scanat {new Date(at).toLocaleTimeString("ro-RO")} · automat la 2 minute.</p>}
    </section>
  );
}
