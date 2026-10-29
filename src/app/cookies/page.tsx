import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Politica de cookies · Traders Insight" };

const STORAGE = [
  { key: "ti:level", purpose: "Nivelul de experiență ales (începător, mediu, avansat)" },
  { key: "ti:watchlist", purpose: "Activele adăugate în watchlist" },
  { key: "ti:chartTabs:<nivel>", purpose: "Sistemele de analiză afișate pe grafic" },
];

export default function CookiesPage() {
  return (
    <LegalPage title="Politica de cookies">
      <p>
        {SITE.name} nu folosește cookies de publicitate, de urmărire sau de analiză. Folosim doar stocarea locală a
        browserului (localStorage) pentru a ține minte preferințele tale. Aceste informații rămân pe dispozitivul tău
        și nu ne sunt transmise.
      </p>

      <h2>Ce stocăm</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-medium">Cheie</th>
              <th className="py-2 pr-4 font-medium">Scop</th>
              <th className="py-2 font-medium">Durată</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE.map((s) => (
              <tr key={s.key} className="border-b border-line">
                <td className="py-2 pr-4 font-mono text-xs">{s.key}</td>
                <td className="py-2 pr-4">{s.purpose}</td>
                <td className="py-2">Până la ștergere</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Fiind strict necesare pentru funcționalitățile cerute de tine, aceste date nu necesită consimțământ separat
        (art. 4 alin. 5 din Legea nr. 506/2004). Dacă vom introduce în viitor cookies de analiză sau marketing, îți
        vom cere acordul înainte.
      </p>

      <h2>Cum ștergi datele</h2>
      <p>
        Poți șterge oricând aceste informații din setările browserului (ștergerea datelor site-ului). După ștergere,
        aplicația îți va cere din nou să alegi nivelul de experiență.
      </p>
    </LegalPage>
  );
}
