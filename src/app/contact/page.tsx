import Link from "next/link";
import { Field, LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Contact · Traders Insight" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>Ai o întrebare, ai găsit o eroare în date sau vrei să ne propui o funcționalitate? Scrie-ne.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${SITE.email}`}
          className="rounded-xl border border-line bg-panel p-4 no-underline transition hover:border-accent"
        >
          <div className="text-xs text-muted">Întrebări generale și suport</div>
          <div className="mt-1 font-medium text-fg">{SITE.email}</div>
        </a>
        <a
          href={`mailto:${SITE.privacyEmail}`}
          className="rounded-xl border border-line bg-panel p-4 no-underline transition hover:border-accent"
        >
          <div className="text-xs text-muted">Protecția datelor (GDPR)</div>
          <div className="mt-1 font-medium text-fg">{SITE.privacyEmail}</div>
        </a>
      </div>

      <p className="text-muted">
        Răspundem de obicei în 2–3 zile lucrătoare. Te rugăm să nu ne trimiți date despre conturile tale de
        tranzacționare. Nu putem oferi recomandări personalizate de investiții (vezi{" "}
        <Link href="/disclaimer">Disclaimerul</Link>).
      </p>

      <h2>Date de identificare</h2>
      <ul>
        <li>Denumire: <Field value={SITE.company} /></li>
        <li>Sediu: <Field value={SITE.address} /></li>
        <li>Nr. Registrul Comerțului: <Field value={SITE.registration} /></li>
        <li>CUI: <Field value={SITE.taxId} /></li>
      </ul>

      <h2>Reclamații</h2>
      <p>
        Dacă nu ești mulțumit de răspunsul nostru, te poți adresa{" "}
        <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer">ANPC</a> sau poți folosi{" "}
        <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer">procedura SAL</a>.
      </p>
    </LegalPage>
  );
}
