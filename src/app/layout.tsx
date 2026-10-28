import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { LevelProvider } from "@/components/LevelProvider";
import { LevelSwitcher } from "@/components/LevelSwitcher";
import { SearchBox } from "@/components/SearchBox";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Traders Insight",
  description: "Analiză tehnică și fundamentală pentru acțiuni, crypto și forex, adaptată nivelului tău.",
  appleWebApp: { capable: true, title: "Traders Insight", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className="min-h-screen antialiased">
        <LevelProvider>
          <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
              <Link href="/" className="mr-2 text-lg font-bold tracking-tight">
                Traders<span className="text-accent">Insight</span>
              </Link>
              <nav className="flex gap-4 text-sm text-muted">
                <Link href="/" className="hover:text-fg">Piețe</Link>
                <Link href="/watchlist" className="hover:text-fg">Watchlist</Link>
                <Link href="/despre" className="hover:text-fg">Despre</Link>
              </nav>
              <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:justify-end sm:flex">
                <SearchBox />
              </div>
              <div className="ml-auto sm:ml-0">
                <LevelSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl border-t border-line px-4 py-6">
            <Disclaimer compact />
          </footer>
        </LevelProvider>
      </body>
    </html>
  );
}
