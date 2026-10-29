import Link from "next/link";
import { LegalPage, Operator } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Politica de confidențialitate · Traders Insight" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Politica de confidențialitate">
      <p>
        Această politică explică ce date personale prelucrăm atunci când folosești {SITE.name}, în conformitate cu
        Regulamentul (UE) 2016/679 (GDPR) și legislația română aplicabilă.
      </p>

      <h2>1. Operatorul de date</h2>
      <p>
        Operatorul este <Operator />. Pentru orice întrebare legată de datele tale ne poți scrie la{" "}
        <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
      </p>

      <h2>2. Ce date prelucrăm</h2>
      <ul>
        <li>
          <strong>Preferințe salvate pe dispozitivul tău:</strong> nivelul de experiență ales, lista de urmărire
          (watchlist) și taburile de analiză afișate. Acestea sunt stocate local în browser (localStorage) și nu ne
          sunt transmise.
        </li>
        <li>
          <strong>Date tehnice:</strong> adresa IP, tipul browserului și paginile accesate, înregistrate automat în
          jurnalele serverului și ale furnizorului de găzduire, pentru securitate și funcționare.
        </li>
        <li>
          <strong>Mesajele trimise prin e-mail:</strong> numele, adresa de e-mail și conținutul mesajului, dacă ne
          contactezi.
        </li>
      </ul>
      <p>Nu cerem și nu prelucrăm date despre conturile tale de tranzacționare sau despre investițiile tale.</p>

      <h2>3. Scopuri și temei legal</h2>
      <ul>
        <li>Furnizarea și securitatea platformei: interesul nostru legitim (art. 6 alin. 1 lit. f GDPR).</li>
        <li>Răspunsul la solicitări: interesul legitim sau demersurile la cererea ta (art. 6 alin. 1 lit. b).</li>
        <li>Respectarea obligațiilor legale, unde e cazul (art. 6 alin. 1 lit. c).</li>
      </ul>

      <h2>4. Cui transmitem datele</h2>
      <p>
        Folosim furnizori care ne ajută să operăm platforma, de exemplu furnizorul de găzduire și furnizorii de date
        de piață. Cererile de date de piață pleacă de pe serverele noastre, nu din browserul tău. Unii furnizori pot
        prelucra date în afara Spațiului Economic European; în acest caz ne bazăm pe garanții adecvate, precum
        clauzele contractuale standard ale Comisiei Europene. Nu vindem datele tale.
      </p>

      <h2>5. Cât timp păstrăm datele</h2>
      <p>
        Jurnalele tehnice se păstrează cel mult 90 de zile. Corespondența se păstrează cât este necesar pentru
        soluționarea solicitării și apoi cel mult 3 ani. Datele din browser rămân pe dispozitivul tău până când le
        ștergi.
      </p>

      <h2>6. Drepturile tale</h2>
      <p>
        Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a
        nu face obiectul unei decizii bazate exclusiv pe prelucrare automată care te afectează semnificativ. Ne poți
        scrie la <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>. Ai și dreptul de a depune plângere la{" "}
        <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer">
          Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)
        </a>
        .
      </p>

      <h2>7. Cookies</h2>
      <p>
        Detalii despre stocarea locală și cookies găsești în <Link href="/cookies">Politica de cookies</Link>.
      </p>
    </LegalPage>
  );
}
