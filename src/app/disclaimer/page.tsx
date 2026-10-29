import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Disclaimer și avertizare de risc · Traders Insight" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer și avertizare de risc">
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-4">
        <strong>Pe scurt:</strong> {SITE.name} oferă informații și instrumente de analiză cu scop educațional. Nu îți
        spunem ce să cumperi sau să vinzi. Orice decizie de tranzacționare îți aparține în totalitate, la fel și
        riscul.
      </div>

      <h2>1. Fără consultanță de investiții</h2>
      <p>
        Conținutul platformei, inclusiv analizele tehnice și fundamentale, observațiile generate automat, nivelurile de
        suport și rezistență, interpretările SMC, Wyckoff, Elliott, Volume Profile și VWAP, nu constituie consultanță de
        investiții, recomandare personalizată, cercetare de investiții în sensul MiFID II sau ofertă ori solicitare de a
        cumpăra sau vinde vreun instrument financiar ori criptoactiv. {SITE.name} nu este o firmă de investiții
        autorizată de Autoritatea de Supraveghere Financiară (ASF) și nu prestează servicii de investiții.
      </p>

      <h2>2. Riscurile tranzacționării</h2>
      <ul>
        <li>Prețul acțiunilor, criptomonedelor și al perechilor valutare poate scădea brusc și semnificativ.</li>
        <li>Criptoactivele sunt foarte volatile și, de regulă, nu sunt protejate de scheme de garantare a investițiilor.</li>
        <li>
          Produsele cu efect de levier (CFD, futures, marjă) pot amplifica pierderile peste suma depusă. O mare parte
          dintre conturile investitorilor de retail pierd bani atunci când tranzacționează CFD-uri.
        </li>
        <li>Nu investi bani de care ai nevoie și nu te împrumuta pentru a tranzacționa.</li>
      </ul>

      <h2>3. Limitele analizelor automate</h2>
      <p>
        Indicatorii și modelele sunt calculate automat, după reguli fixe, din date istorice. Metode precum Elliott sau
        Wyckoff sunt prin natura lor interpretative: analiști diferiți pot ajunge la concluzii diferite pe același
        grafic. Verdictele „pozitiv”, „neutru” sau „negativ” descriu doar contextul tehnic sau fundamental la momentul
        calculului și nu sunt predicții. Performanțele trecute nu garantează rezultate viitoare.
      </p>

      <h2>4. Exactitatea datelor</h2>
      <p>
        Datele de piață provin de la furnizori terți și pot fi întârziate, incomplete sau eronate. Când sursa nu este
        disponibilă, platforma poate afișa date demonstrative, semnalate printr-un banner. Verifică întotdeauna
        informațiile la brokerul tău sau la sursa oficială înainte de a lua o decizie.
      </p>

      <h2>5. Limitarea răspunderii</h2>
      <p>
        În limitele permise de lege, {SITE.name} și operatorul său nu răspund pentru pierderile sau prejudiciile
        rezultate din utilizarea informațiilor de pe platformă. Înainte de a investi, ia în considerare situația ta
        financiară, obiectivele și toleranța la risc și, dacă e cazul, consultă un consultant de investiții autorizat.
      </p>

      <p>
        Vezi și <Link href="/termeni">Termenii și condițiile</Link>.
      </p>
    </LegalPage>
  );
}
