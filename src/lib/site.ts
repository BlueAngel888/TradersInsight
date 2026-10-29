// Operator details shown on the legal pages and in the footer.
// Values in [brackets] are placeholders that must be filled in before launch.
export const SITE = {
  name: "Traders Insight",
  url: "https://tradersinsight.ro",
  company: "[Denumirea societății]",
  registration: "[Nr. Registrul Comerțului]",
  taxId: "[CUI]",
  address: "[Adresa sediului social]",
  email: "contact@tradersinsight.ro",
  privacyEmail: "privacy@tradersinsight.ro",
  legalUpdated: "29 octombrie 2026",
};

export const isPlaceholder = (value: string) => value.startsWith("[");
