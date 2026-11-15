import { NextResponse } from "next/server";
import { MetaApiConfigError, scanSetups } from "@/lib/metaapi";
import { Mt5NotDemoError, safeEqual } from "@/lib/mt5";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const symbolsFromEnv = () =>
  (process.env.MT5_SYMBOLS ?? "EURUSD,XAUUSD")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

// Signals only. This route never places orders.
export async function GET(req: Request) {
  const expected = process.env.MT5_ACCESS_KEY;
  if (!expected) return NextResponse.json({ error: "Integrarea MT5 nu este configurată pe server." }, { status: 503 });
  if (!safeEqual(req.headers.get("x-access-key") ?? "", expected)) return NextResponse.json({ error: "Cheie de acces greșită." }, { status: 401 });
  try {
    return NextResponse.json({ rows: await scanSetups(symbolsFromEnv()), scannedAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof Mt5NotDemoError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof MetaApiConfigError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("MT5 scan failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare MetaApi." }, { status: 502 });
  }
}
