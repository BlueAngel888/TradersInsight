import Link from "next/link";

export function Disclaimer() {
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
      <strong>Atenție:</strong> analizele de mai jos sunt generate automat din date publice, au caracter strict
      informativ și educațional și <strong>nu reprezintă consultanță financiară</strong> sau o recomandare de a
      cumpăra ori vinde. Performanțele trecute nu garantează rezultate viitoare. Decizia și riscul îți aparțin.{" "}
      <Link href="/disclaimer" className="text-accent hover:underline">Disclaimer complet</Link>
    </div>
  );
}
