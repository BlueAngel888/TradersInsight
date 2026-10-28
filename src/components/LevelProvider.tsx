"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Level } from "@/lib/types";

interface Ctx {
  ready: boolean;
  level: Level | null;
  setLevel: (l: Level) => void;
  watchlist: string[];
  toggleWatch: (symbol: string) => void;
}

const LevelContext = createContext<Ctx | null>(null);

const LEVEL_KEY = "ti:level";
const WATCH_KEY = "ti:watchlist";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): keep in-memory state only.
  }
}

export function LevelProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [level, setLevelState] = useState<Level | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setLevelState(read<Level | null>(LEVEL_KEY, null));
    setWatchlist(read<string[]>(WATCH_KEY, []));
    setReady(true);
  }, []);

  const setLevel = useCallback((l: Level) => {
    setLevelState(l);
    write(LEVEL_KEY, l);
  }, []);

  const toggleWatch = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      write(WATCH_KEY, next);
      return next;
    });
  }, []);

  return (
    <LevelContext.Provider value={{ ready, level, setLevel, watchlist, toggleWatch }}>
      {children}
    </LevelContext.Provider>
  );
}

export function useLevel() {
  const ctx = useContext(LevelContext);
  if (!ctx) throw new Error("useLevel must be used inside LevelProvider");
  return ctx;
}

export const LEVELS: { id: Level; label: string; description: string }[] = [
  {
    id: "beginner",
    label: "Începător",
    description: "Sunt la început. Vreau explicații simple, fără jargon, și doar ce contează.",
  },
  {
    id: "intermediate",
    label: "Mediu",
    description: "Cunosc indicatorii de bază (RSI, medii mobile). Vreau valori și interpretări scurte.",
  },
  {
    id: "advanced",
    label: "Avansat",
    description: "Vreau toate datele: indicatori, niveluri, volatilitate și metrici fundamentale complete.",
  },
];
