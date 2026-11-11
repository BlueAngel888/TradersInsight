# Traders Insight

Aplicație web (instalabilă pe telefon ca PWA) care oferă analiză tehnică și fundamentală pentru
**acțiuni, crypto și forex**, adaptată nivelului utilizatorului: începător, mediu sau avansat.

> Informațiile au caracter strict informativ și educațional și nu constituie consultanță financiară.

## Funcționalități

- **Alegerea nivelului** la prima vizită (se poate schimba oricând din meniu). Nivelul decide cât de
  detaliate sunt explicațiile și ce grafice și metrici apar.
- **Analiză tehnică:** trend (SMA 50/200), RSI 14, MACD 12/26/9, benzi Bollinger 20/2, evoluție pe o lună,
  ATR, niveluri de suport și rezistență, plus un rezumat pozitiv / neutru / negativ.
- **Taburi de analiză deasupra graficului**, care se pot combina: medii mobile, suport/rezistență (cu putere 1–3),
  SMC (BOS, CHoCH, order blocks, fair value gaps, premium/discount), Wyckoff (faze și evenimente),
  Elliott (numărătoare automată cu ținte Fibonacci), Volume Profile (POC, Value Area), VWAP ancorat și Bollinger.
  Pentru fiecare tab activ, sub grafic apare ce arată, explicat pe nivelul utilizatorului.
- **Analiză fundamentală (acțiuni):** P/E, creșterea veniturilor, marja de profit, ROE, datorii/capital,
  dividende. Pentru crypto: capitalizare, volum, ofertă în circulație.
- **Grafice interactive** (TradingView Lightweight Charts), căutare de simboluri, watchlist local.
- **Disclaimer** vizibil pe fiecare pagină de analiză.

## Pornire

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # teste pentru indicatori și analiză
```

`DEMO_DATA=1 npm run dev` pornește aplicația cu date demonstrative, fără acces la internet.

## Date

Datele vin din Yahoo Finance prin `yahoo-finance2` (fără cheie API). Este o sursă neoficială, potrivită
pentru prototip. Înainte de lansarea publică trebuie înlocuită cu un furnizor licențiat (de exemplu
Financial Modeling Prep, Polygon sau Twelve Data). Toată logica de date este în `src/lib/market.ts`.
Dacă sursa nu răspunde, aplicația afișează date demonstrative și un banner de avertizare.

## Structură

- `src/lib/indicators.ts`: indicatorii tehnici (funcții pure, testate)
- `src/lib/analysis.ts`: interpretarea indicatorilor și a datelor fundamentale
- `src/lib/advanced.ts`: SMC, Wyckoff, Elliott, Volume Profile, VWAP, niveluri cheie (funcții pure, testate)
- `src/lib/structure.ts`: observațiile și elementele de grafic pentru fiecare sistem
- `src/components/ChartWorkspace.tsx`: graficul cu taburi
- `src/lib/market.ts`: sursa de date, cu cache de 5 minute
- `src/components/AssetView.tsx`: pagina unui activ, adaptată nivelului

## Cont MT5 demo (MetaApi, doar citire)

Pagina `/mt5` afișează soldul, equity și pozițiile deschise ale unui cont MT5 **demo** conectat prin [MetaApi](https://metaapi.cloud). Integrarea nu plasează ordine, iar serverul refuză orice cont care nu este de tip demo.

Variabile de mediu (de pus în Vercel, nu în cod):

| Variabilă | Ce este |
| --- | --- |
| `METAAPI_TOKEN` | Tokenul API din panoul MetaApi |
| `METAAPI_ACCOUNT_ID` | ID-ul contului adăugat în MetaApi |
| `MT5_ACCESS_KEY` | O parolă aleasă de tine, cerută pe pagina `/mt5` |
| `METAAPI_REGION` | Opțional; altfel se citește automat din MetaApi |
| `MT5_SYMBOLS` | Opțional; simbolurile scanate, ex. `EURUSD,XAUUSD` (implicit) |

### Scanner SMC

Pe aceeași pagină, secțiunea „Semnale SMC” rulează detectorul din `src/lib/setup.ts`: trend aliniat pe Daily/4H/1H, doji pe 15m/5m/1m care a luat lichiditatea, impuls, intrare limită la Fibonacci 0.786, SL dincolo de doji, TP la 1:2 și 1:3, plus confluențe (order block, FVG, suport/rezistență confirmate, volume profile). Doar semnale, fără ordine.
