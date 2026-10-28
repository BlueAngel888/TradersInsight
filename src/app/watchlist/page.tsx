"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLevel } from "@/components/LevelProvider";
import { QuoteTable } from "@/components/MarketBoard";
import type { Quote } from "@/lib/types";

export default function WatchlistPage() {
  const { ready, watchlist } = useLevel();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (watchlist.length === 0) {
      setQuotes([]);
      return;
    }
    fetch(`/api/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`)
      .then((r) => r.json())
      .then((d) => setQuotes(d.quotes ?? []))
      .catch(() => setQuotes([]));
  }, [ready, watchlist]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Watchlist</h1>
      {quotes === null ? (
        <p className="text-sm text-muted">Se încarcă…</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted">
          Nu urmărești încă niciun activ. Deschide un activ din <Link href="/" className="text-accent hover:underline">Piețe</Link> și
          apasă „Adaugă în watchlist”.
        </p>
      ) : (
        <QuoteTable quotes={quotes} />
      )}
    </div>
  );
}
