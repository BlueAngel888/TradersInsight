export function formatPrice(n: number, currency?: string) {
  const digits = Math.abs(n) < 10 ? 4 : 2;
  const str = n.toLocaleString("ro-RO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency ? `${str} ${currency}` : str;
}

export function formatPercent(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("ro-RO", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

export function formatBig(n?: number) {
  if (n === undefined || n === null) return "–";
  const abs = Math.abs(n);
  const f = (v: number, s: string) => `${v.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} ${s}`;
  if (abs >= 1e12) return f(n / 1e12, "tril.");
  if (abs >= 1e9) return f(n / 1e9, "mld.");
  if (abs >= 1e6) return f(n / 1e6, "mil.");
  return n.toLocaleString("ro-RO");
}
