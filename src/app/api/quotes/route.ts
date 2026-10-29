import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market";

export async function GET(req: Request) {
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);
  if (symbols.length === 0) return NextResponse.json({ quotes: [], demo: false });
  return NextResponse.json(await getQuotes(symbols));
}
