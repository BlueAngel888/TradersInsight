import { MarketBoard } from "@/components/MarketBoard";
import { CATALOG } from "@/lib/catalog";
import { getQuotes } from "@/lib/market";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { quotes, demo } = await getQuotes(CATALOG.map((e) => e.symbol));
  // The catalog decides which tab an asset belongs in.
  const withMarket = quotes.map((q, i) => ({ ...q, market: CATALOG[i].market, name: q.name || CATALOG[i].name }));
  return <MarketBoard quotes={withMarket} demo={demo} />;
}
