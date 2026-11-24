import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

// Status page: shows which settings are missing, never their values.
export default function Home() {
  const e = env();
  const rows: [string, boolean, string][] = [
    ["METAAPI_TOKEN", !!e.metaApiToken, "tokenul MetaApi"],
    ["MCP_PASSWORD", e.password.length >= 12, "parola de conectare (min. 12 caractere)"],
  ];
  return (
    <main style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Server MCP pentru MT5</h1>
      <p>
        Adresa pentru Claude (conector personalizat): <code>/api/mcp</code> pe acest domeniu.
      </p>
      <ul>
        {rows.map(([k, set, label]) => (
          <li key={k}>
            {set ? "✅" : "❌"} <code>{k}</code> — {label}
          </li>
        ))}
        <li>
          {e.tradingEnabled ? "🟢 Tranzacționare pornită" : "⛔ Tranzacționare oprită (TRADING_ENABLED=false)"}; conturi cash/funded permise:{" "}
          {e.tradingLogins.size ? `${e.tradingLogins.size}` : "niciunul (doar citire)"}
        </li>
        <li>
          Limite: max {e.maxLot} loturi/ordin, risc max {e.maxRiskPercent}% la stop, stop loss {e.requireStopLoss ? "obligatoriu" : "opțional"}
        </li>
      </ul>
    </main>
  );
}
