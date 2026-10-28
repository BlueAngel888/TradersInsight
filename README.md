# Traders Insight

Aplicație web (instalabilă pe telefon ca PWA) care oferă analiză tehnică și fundamentală pentru
**acțiuni, crypto și forex**, adaptată nivelului utilizatorului: începător, mediu sau avansat.

> Informațiile au caracter strict informativ și educațional și nu constituie consultanță financiară.

## Funcționalități

- **Alegerea nivelului** la prima vizită (se poate schimba oricând din meniu). Nivelul decide cât de
  detaliate sunt explicațiile și ce grafice și metrici apar.
- **Analiză tehnică:** trend (SMA 50/200), RSI 14, MACD 12/26/9, benzi Bollinger 20/2, evoluție pe o lună,
  ATR, niveluri de suport și rezistență, plus un rezumat pozitiv / neutru / negativ.
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
- `src/lib/market.ts`: sursa de date, cu cache de 5 minute
- `src/components/AssetView.tsx`: pagina unui activ, adaptată nivelului
