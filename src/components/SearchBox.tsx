"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MARKET_LABELS, type CatalogEntry } from "@/lib/catalog";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={box} className="relative w-full max-w-sm">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Caută: Apple, BTC, EUR/USD…"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-line bg-panel shadow-xl">
          {results.map((r) => (
            <li key={r.symbol}>
              <Link
                href={`/asset/${encodeURIComponent(r.symbol)}`}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-panel-hover"
              >
                <span className="truncate">
                  <span className="font-semibold">{r.symbol}</span> <span className="text-muted">{r.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{MARKET_LABELS[r.market]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
