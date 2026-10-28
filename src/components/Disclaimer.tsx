export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-muted">
        Informațiile au caracter strict informativ și educațional și nu constituie consultanță financiară sau
        recomandare de investiții. Tranzacționarea implică riscul pierderii capitalului.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
      <strong>Atenție:</strong> analizele de mai jos sunt generate automat din date publice, au caracter strict
      informativ și educațional și <strong>nu reprezintă consultanță financiară</strong> sau o recomandare de a
      cumpăra ori vinde. Performanțele trecute nu garantează rezultate viitoare. Decizia și riscul îți aparțin.
    </div>
  );
}
