# Bridge MT5 local (gratuit, fără MetaApi)

Scriptul `bridge.py` citește datele direct din terminalul MT5 desktop, prin pachetul oficial
`MetaTrader5` pentru Python, și le servește aplicației în același format ca MetaApi.

- Merge pe **Windows** sau într-o mașină virtuală Windows (de ex. UTM pe Mac).
- Ascultă doar pe `127.0.0.1`, deci nu e accesibil din rețea.
- **Doar citire**: nu plasează, nu modifică și nu închide ordine.
- **Doar demo**: nu pornește și refuză orice cerere dacă contul logat în MT5 nu este demo.

## Pași

1. Instalează MT5 desktop de la broker, loghează-te în contul demo și apasă **Algo Trading**.
2. Instalează Python 3.11 sau 3.12 (bifează „Add Python to PATH”), apoi Node.js LTS.
3. Pornește bridge-ul:
   ```
   pip install MetaTrader5
   python tools\mt5-bridge\bridge.py
   ```
4. Într-o altă fereastră, pornește aplicația local:
   ```
   set MT5_BRIDGE_URL=http://127.0.0.1:8765
   set MT5_ACCESS_KEY=o-parola-aleasa-de-tine
   npm install
   npm run dev
   ```
5. Deschide http://localhost:3000/mt5 și introdu cheia de acces.
