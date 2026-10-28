import type { Verdict } from "@/lib/analysis";

const STYLE: Record<Verdict, { label: string; className: string }> = {
  positive: { label: "Pozitiv", className: "bg-up/15 text-up border-up/40" },
  negative: { label: "Negativ", className: "bg-down/15 text-down border-down/40" },
  neutral: { label: "Neutru", className: "bg-muted/15 text-muted border-muted/40" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = STYLE[verdict];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${v.className}`}>{v.label}</span>;
}
