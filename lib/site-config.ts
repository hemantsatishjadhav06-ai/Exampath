// Single source of truth for brand identity — never hardcode these elsewhere.
export const siteConfig = {
  name: "MeraSafar",
  parentCompany: "Vayulabs",
  domain: "merasafar.in", // placeholder — update when finalized
  supportEmail: "contact@merasafar.in", // placeholder
  defaultLocale: "en" as const,
  locales: ["en", "hi"] as const,
  tagline: "Your journey to a government job — every exam, every date, verified.",
  taglineHi: "सरकारी नौकरी तक आपका सफ़र — हर परीक्षा, हर तारीख़, सत्यापित।",
};
export type Locale = (typeof siteConfig.locales)[number];
export const baseUrl = `https://${siteConfig.domain}`;
