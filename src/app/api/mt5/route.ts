import { NextResponse } from "next/server";
import { getMt5Snapshot, MetaApiConfigError } from "@/lib/metaapi";
import { Mt5NotDemoError, safeEqual } from "@/lib/mt5";

export const dynamic = "force-dynamic";

// Read-only view of the connected MT5 demo account. Protected by MT5_ACCESS_KEY
// because the site is public and the account data is private.
export async function GET(req: Request) {
  const expected = process.env.MT5_ACCESS_KEY;
  if (!expected) return NextResponse.json({ error: "Integrarea MT5 nu este configurată pe server." }, { status: 503 });
  const given = req.headers.get("x-access-key") ?? "";
  if (!safeEqual(given, expected)) return NextResponse.json({ error: "Cheie de acces greșită." }, { status: 401 });

  try {
    return NextResponse.json(await getMt5Snapshot());
  } catch (e) {
    if (e instanceof Mt5NotDemoError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof MetaApiConfigError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("MT5 snapshot failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Eroare MetaApi." }, { status: 502 });
  }
}
