import { SITE, isPlaceholder } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="legal mx-auto max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-xs text-muted">Ultima actualizare: {SITE.legalUpdated}</p>
      {children}
    </article>
  );
}

/** Renders a site value, highlighting placeholders that still need real data. */
export function Field({ value }: { value: string }) {
  return isPlaceholder(value) ? (
    <mark className="rounded bg-warn/20 px-1 text-warn">{value}</mark>
  ) : (
    <>{value}</>
  );
}

export function Operator() {
  return (
    <>
      <Field value={SITE.company} />, cu sediul în <Field value={SITE.address} />, înregistrată la Registrul
      Comerțului sub nr. <Field value={SITE.registration} />, CUI <Field value={SITE.taxId} />
    </>
  );
}
