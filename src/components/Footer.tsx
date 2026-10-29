import Link from "next/link";
import { SITE } from "@/lib/site";

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Aplicație",
    links: [
      { href: "/", label: "Piețe" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/despre", label: "Despre și metodologie" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/disclaimer", label: "Disclaimer și avertizare de risc" },
      { href: "/termeni", label: "Termeni și condiții" },
      { href: "/confidentialitate", label: "Politica de confidențialitate" },
      { href: "/cookies", label: "Politica de cookies" },
    ],
  },
  {
    title: "Contact",
    links: [
      { href: "/contact", label: "Contactează-ne" },
      { href: `mailto:${SITE.email}`, label: SITE.email, external: true },
      { href: "https://anpc.ro/ce-este-sal/", label: "ANPC – SAL", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-lg font-bold">
              Traders<span className="text-accent">Insight</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Analiză tehnică și fundamentală pentru acțiuni, crypto și forex, explicată pe nivelul tău.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className="hover:text-fg" {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="hover:text-fg">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-xs leading-relaxed text-muted">
          <strong className="text-fg">Avertizare de risc:</strong> informațiile și analizele din Traders Insight au
          caracter strict informativ și educațional și nu constituie consultanță de investiții, recomandare personalizată
          sau ofertă de a cumpăra ori vinde instrumente financiare. Tranzacționarea acțiunilor, criptomonedelor, a
          perechilor valutare și în special a produselor cu efect de levier implică un risc ridicat și poate duce la
          pierderea întregului capital investit. Performanțele trecute nu garantează rezultate viitoare. Datele pot fi
          întârziate sau eronate. <Link href="/disclaimer" className="text-accent hover:underline">Citește disclaimerul complet</Link>.
        </div>

        <div className="mt-6 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {SITE.name}. Toate drepturile rezervate.</span>
          <span>{SITE.name} nu este o firmă de investiții autorizată de ASF și nu prestează servicii de investiții.</span>
        </div>
      </div>
    </footer>
  );
}
