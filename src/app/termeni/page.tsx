import Link from "next/link";
import { LegalPage, Operator } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Termeni și condiții · Traders Insight" };

export default function TermsPage() {
  return (
    <LegalPage title="Termeni și condiții">
      <h2>1. Cine suntem</h2>
      <p>
        Platforma {SITE.name} ({SITE.url}) este operată de <Operator />. Ne poți scrie la{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>

      <h2>2. Acceptarea termenilor</h2>
      <p>
        Prin utilizarea platformei confirmi că ai citit și accepți acești termeni, precum și{" "}
        <Link href="/disclaimer">Disclaimerul</Link>, <Link href="/confidentialitate">Politica de confidențialitate</Link> și{" "}
        <Link href="/cookies">Politica de cookies</Link>. Dacă nu ești de acord, te rugăm să nu folosești platforma.
        Platforma se adresează persoanelor de cel puțin 18 ani.
      </p>

      <h2>3. Serviciul</h2>
      <p>
        {SITE.name} oferă date de piață, grafice și analize tehnice și fundamentale generate automat, cu scop
        informativ și educațional. Nu executăm tranzacții, nu păstrăm fonduri și nu oferim consultanță de investiții.
        Putem modifica, suspenda sau întrerupe oricând funcționalități, fără a garanta disponibilitatea continuă a
        serviciului.
      </p>

      <h2>4. Utilizare permisă</h2>
      <ul>
        <li>Folosești platforma doar în scop personal și necomercial.</li>
        <li>Nu extragi automat datele (scraping), nu le revinzi și nu le redistribui.</li>
        <li>Nu încerci să perturbi funcționarea platformei sau să accesezi neautorizat sistemele noastre.</li>
        <li>Nu folosești platforma în scopuri ilegale, inclusiv manipularea pieței.</li>
      </ul>

      <h2>5. Proprietate intelectuală</h2>
      <p>
        Codul, designul, textele și metodologia platformei aparțin operatorului sau licențiatorilor săi. Datele de
        piață aparțin furnizorilor lor. Graficele folosesc biblioteca TradingView Lightweight Charts™.
      </p>

      <h2>6. Răspundere</h2>
      <p>
        Platforma este oferită „ca atare”. Nu garantăm exactitatea, completitudinea sau actualitatea datelor și
        analizelor. Deciziile de investiții îți aparțin în totalitate, conform <Link href="/disclaimer">Disclaimerului</Link>.
        Nimic din acești termeni nu limitează drepturile pe care le ai ca și consumator conform legii.
      </p>

      <h2>7. Modificări</h2>
      <p>
        Putem actualiza acești termeni. Data ultimei actualizări apare în partea de sus a paginii. Continuarea
        utilizării după actualizare înseamnă acceptarea noii versiuni.
      </p>

      <h2>8. Legea aplicabilă și litigii</h2>
      <p>
        Termenii sunt guvernați de legea română. Litigiile se soluționează pe cale amiabilă sau, în lipsa unei
        înțelegeri, de instanțele competente din România. Consumatorii pot apela și la{" "}
        <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer">soluționarea alternativă a litigiilor (ANPC – SAL)</a>.
      </p>
    </LegalPage>
  );
}
