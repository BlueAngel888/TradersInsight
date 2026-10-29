import type { Metadata } from "next";
import { AssetView } from "@/components/AssetView";
import { analyzeFundamentals, analyzeTechnical } from "@/lib/analysis";
import { getAsset } from "@/lib/market";
import { analyzeStructure } from "@/lib/structure";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${decodeURIComponent(symbol).toUpperCase()} · Traders Insight` };
}

export default async function AssetPage({ params }: Props) {
  const { symbol } = await params;
  const data = await getAsset(decodeURIComponent(symbol).toUpperCase());
  const technical = analyzeTechnical(data.candles);
  const fundamental = data.quote.market === "stocks" && data.fundamentals ? analyzeFundamentals(data.fundamentals) : null;
  const structure = analyzeStructure(data.candles);
  return <AssetView data={data} technical={technical} fundamental={fundamental} structure={structure} />;
}
