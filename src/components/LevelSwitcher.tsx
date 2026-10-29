"use client";

import { LEVELS, useLevel } from "./LevelProvider";
import type { Level } from "@/lib/types";

export function LevelSwitcher() {
  const { ready, level, setLevel } = useLevel();
  if (!ready || !level) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">Nivel</span>
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as Level)}
        className="rounded-md border border-line bg-panel px-2 py-1"
        aria-label="Nivel de experiență"
      >
        {LEVELS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
