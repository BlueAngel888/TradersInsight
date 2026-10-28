import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Traders Insight",
    short_name: "TradersInsight",
    description: "Analiză tehnică și fundamentală pentru acțiuni, crypto și forex.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
