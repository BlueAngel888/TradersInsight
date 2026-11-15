"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/components/format";
import { positionSide, type Mt5Snapshot } from "@/lib/mt5";
import { Mt5Signals } from "@/components/Mt5Signals";

const KEY_STORAGE = "ti-mt5-key";

function readKey() {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export default function Mt5Page() {
  const [key, setKey] = useState("");
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<Mt5Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (k: string) => {
    if (!k) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mt5", { headers: { "x-access-key": k }, cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setData(null);
        setError(body.error ?? `Eroare ${res.status}`);
        if (res.status === 401) {
          setKey("");
          try { sessionStorage.removeItem(KEY_STORAGE); } catch {}
        }
      } else {
        setData(body);
      }
    } catch {
      setError("Nu am putut contacta serverul.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const k = readKey();
    if (k) { setKey(k); load(k); }
  }, [load]);

  useEffect(() => {
    if (!key) return;
    const id = setInterval(() => load(key), 15000);
    return () => clearInterval(id);
  }, [key, load]);

  if (!key) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Cont MT5 demo</h1>
        <p className="text-sm text-muted">Introdu cheia de acces ca să vezi contul demo conectat prin MetaApi.</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const k = draft.trim();
            try { sessionStorage.setItem(KEY_STORAGE, k); } catch {}
            setKey(k);
            load(k);
          }}
        >
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Cheie de acces"
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
            autoComplete="current-password"
          />
          <button className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg">Deschide</button>
        </form>
        {error && <p className="text-sm text-down">{error}</p>}
      </div>
    );
  }

  const a = data?.account;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Cont MT5 demo</h1>
        <button onClick={() => load(key)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel-hover" disabled={loading}>
          {loading ? "Se actualizează…" : "Actualizează"}
        </button>
      </div>
      <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
        Doar citire. Aplicația nu plasează și nu modifică ordine. Se acceptă numai conturi demo.
      </p>
      {error && <p className="text-sm text-down">{error}</p>}
      {!data && !error && <p className="text-sm text-muted">Se încarcă…</p>}
      {a && data && (
        <>
          <p className="text-sm text-muted">
            {a.name} · {a.login} · {a.broker} ({a.server}) · 1:{a.leverage}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sold" value={formatPrice(a.balance, a.currency)} />
            <Stat label="Equity" value={formatPrice(a.equity, a.currency)} />
            <Stat label="Marjă liberă" value={formatPrice(a.freeMargin, a.currency)} />
            <Stat label="Profit deschis" value={formatPrice(data.totalProfit, a.currency)} />
          </div>
          <section className="space-y-2">
            <h2 className="font-semibold">Poziții deschise ({data.positions.length})</h2>
            {data.positions.length === 0 ? (
              <p className="text-sm text-muted">Nicio poziție deschisă.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
                {data.positions.map((p) => {
                  const side = positionSide(p.type);
                  const pnl = p.profit ?? 0;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold">
                          {p.symbol} <span className={side === "BUY" ? "text-up" : "text-down"}>{side}</span> {p.volume}
                        </div>
                        <div className="text-xs text-muted">
                          Intrare {formatPrice(p.openPrice)}
                          {p.currentPrice !== undefined && ` · Acum ${formatPrice(p.currentPrice)}`}
                          {` · SL ${p.stopLoss ? formatPrice(p.stopLoss) : "–"} · TP ${p.takeProfit ? formatPrice(p.takeProfit) : "–"}`}
                        </div>
                      </div>
                      <div className={`font-semibold ${pnl >= 0 ? "text-up" : "text-down"}`}>{formatPrice(pnl, a.currency)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <Mt5Signals accessKey={key} />
          <p className="text-xs text-muted">Actualizat {new Date(data.fetchedAt).toLocaleTimeString("ro-RO")} · se reîmprospătează la 15 secunde.</p>
        </>
      )}
    </div>
  );
}
