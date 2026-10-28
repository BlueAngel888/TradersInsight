import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/market";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchSymbols(q.slice(0, 50)) });
}
