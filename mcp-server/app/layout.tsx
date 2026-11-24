export const metadata = { title: "Traders Insight MT5 · MCP", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body style={{ fontFamily: "-apple-system, system-ui, sans-serif", margin: 0, padding: 16, lineHeight: 1.5 }}>{children}</body>
    </html>
  );
}
