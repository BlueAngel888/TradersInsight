import { Disclaimer } from "@/components/Disclaimer";

export const metadata = { title: "Despre · Traders Insight" };

export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">Despre Traders Insight</h1>
      <p>
        Traders Insight adună date de piață pentru acțiuni, criptomonede și perechi valutare și le transformă în analiză
        tehnică și fundamentală pe înțelesul tău. Nivelul ales (începător, mediu sau avansat) decide cât de detaliate sunt
        explicațiile și câte date vezi.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Cum calculăm</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>Trend: prețul față de mediile mobile pe 50 și 200 de zile.</li>
        <li>RSI (14): sub 30 supravândut, peste 70 supracumpărat.</li>
        <li>MACD (12, 26, 9): poziția liniei MACD față de linia de semnal.</li>
        <li>Benzi Bollinger (20, 2): poziția prețului în intervalul obișnuit.</li>
        <li>Suport și rezistență: maxime și minime locale grupate, cu putere de la 1 la 3 după numărul de atingeri și volum.</li>
        <li>SMC: structura pieței (BOS, CHoCH), order blocks nemitigate, fair value gaps neumplute, zonă premium/discount.</li>
        <li>Wyckoff: intervalul ultimelor ~60 de sesiuni, trendul anterior și raportul de volum cerere/ofertă; evenimente spring, upthrust, SOS, SOW.</li>
        <li>Elliott: numărătoare automată pe pivoți zigzag, cu regulile clasice de impuls și ținte Fibonacci.</li>
        <li>Volume Profile: volumul pe niveluri de preț în ultimele 120 de sesiuni (POC, Value Area 70%).</li>
        <li>VWAP: preț mediu ponderat cu volumul, ancorat la ultima întoarcere majoră, cu benzi ±1σ.</li>
        <li>Fundamentale: P/E, creșterea veniturilor, marje, ROE, îndatorare și dividende.</li>
      </ul>
      <p className="text-muted">
        Fiecare indicator primește un verdict pozitiv, neutru sau negativ după praguri fixe, iar rezumatul arată câte
        observații sunt în fiecare categorie. Pragurile sunt convenții uzuale, nu predicții.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Sursa datelor</h2>
      <p className="text-muted">
        Prețurile și datele fundamentale provin din surse publice și pot avea întârzieri sau erori. Verifică întotdeauna
        informațiile înainte de a lua o decizie.
      </p>
      <Disclaimer />
    </article>
  );
}
