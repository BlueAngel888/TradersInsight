# Server MCP pentru MT5 (Claude ↔ MetaApi)

Un server MCP pe care îl adaugi în Claude ca **conector personalizat**. Claude poate
apoi să vadă toate conturile tale MT5 din MetaApi (demo, cash, funded), să facă
analiză pe grafice și să plaseze/modifice/închidă tranzacții **cu confirmarea ta**.
Merge și din aplicația Claude de pe iPhone, pentru că rulează pe Vercel.

## Ce poate face Claude

| Unealtă | Ce face |
|---|---|
| `list_accounts` | Toate conturile, tipul (demo / cash / funded), sold, dacă se poate tranzacționa |
| `get_account` | Sold, equity, marjă, poziții deschise, ordine în așteptare |
| `get_history` | Tranzacții închise, profit net, rată de câștig, profit pe simbol |
| `get_price` | Bid/ask, spread, volum minim/maxim |
| `get_candles` | Lumânări OHLCV brute |
| `analyze_market` | Trend SMC (BOS/CHoCH), premium/discount, order blocks, FVG, EMA 20/50/200, RSI, ATR, volume profile, suport/rezistență + scanarea setup-ului tău (D1/4H/1H aliniat → doji pe lichiditate → 0.786) |
| `calculate_position_size` | Lotul pentru un risc în % la un stop dat |
| `deploy_account` | Pornește un cont oprit în MetaApi |
| `preview_trade` | **Pasul 1**: verifică tranzacția și arată riscul. Nu trimite nimic. |
| `execute_trade` | **Pasul 2**: trimite tranzacția, doar cu codul din preview (valabil 10 min) |

## Protecții

- **Conturile cash și funded sunt doar-citire** până pui login-ul lor în `TRADING_LOGINS`.
  Conturile de la firme prop (FundedNext, FTMO etc.) sunt recunoscute după nume/server
  și tratate ca funded chiar dacă MT5 le raportează „demo”.
- **Preview + confirmare**: orice ordin trece întâi prin `preview_trade`; Claude îți arată
  rezumatul și abia după „da” apelează `execute_trade`. Codul e semnat, deci nu poate fi
  modificat între preview și execuție. Regulile se verifică din nou la execuție.
- **Limite de risc**: stop loss obligatoriu, max `MAX_LOT` loturi pe ordin, max
  `MAX_RISK_PERCENT`% din sold pierdut la stop. Lărgirea stopului peste limită e blocată.
- **Buton de oprire**: `TRADING_ENABLED=false` oprește orice tranzacție pe toate conturile.
- **Parolă**: doar cine știe `MCP_PASSWORD` poate conecta un client.
- Cel mai sigur pentru un cont pe care vrei doar să-l urmărești: adaugă-l în MetaApi cu
  **parola de investitor** (read-only). Atunci nici MetaApi nu poate tranzacționa pe el.

## Variabile de mediu (Vercel → Settings → Environment Variables)

| Nume | Obligatoriu | Exemplu / implicit |
|---|---|---|
| `METAAPI_TOKEN` | da | tokenul din app.metaapi.cloud → API access |
| `MCP_PASSWORD` | da | o parolă lungă, minim 12 caractere |
| `TRADING_LOGINS` | nu | `12345678,87654321` — conturi cash/funded pe care permiți tranzacții |
| `READONLY_LOGINS` | nu | conturi pe care nu se tranzacționează niciodată |
| `MAX_LOT` | nu | `1` |
| `MAX_RISK_PERCENT` | nu | `2` |
| `REQUIRE_STOP_LOSS` | nu | `true` |
| `TRADING_ENABLED` | nu | `true` (pune `false` ca să oprești tot) |
| `AUTH_SECRET` | nu | se generează din token + parolă dacă lipsește |

Dacă schimbi `MCP_PASSWORD`, Claude e deconectat și trebuie să te loghezi din nou.

## Instalare de pe iPhone

1. **MetaApi** (app.metaapi.cloud în Safari): adaugă fiecare cont MT5 (login, parolă, server).
   Pentru demo pune parola principală; pentru cash/funded poți pune parola de investitor
   dacă vrei doar citire. Copiază tokenul din *API access*.
2. **Vercel** (vercel.com în Safari): *Add New → Project* → importă `tradersinsight` →
   la *Root Directory* alege `mcp-server` → adaugă `METAAPI_TOKEN` și `MCP_PASSWORD` →
   *Deploy*. Deschide adresa primită: pagina arată ✅ dacă variabilele sunt setate.
3. **Claude** (claude.ai în Safari): *Settings → Connectors → Add custom connector* →
   URL: `https://<proiectul-tău>.vercel.app/api/mcp` → *Connect* → scrii parola →
   *Permite accesul*. Conectorul apare apoi și în aplicația Claude de pe iPhone.
4. Într-o conversație nouă: „Ce conturi MT5 am?” sau „Analizează XAUUSD pe contul demo”.

## Dezvoltare

```bash
npm install
npm test        # reguli de risc, tokenuri, flux OAuth + MCP cap-coadă cu MetaApi simulat
npm run build
```
