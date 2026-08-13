import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryList } from "@/lib/category-page";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;
const VALID = ["10th", "12th", "graduate", "pg"];
const LABEL: Record<string, [string, string]> = {
  "10th": ["10th Pass Government Jobs", "10वीं पास सरकारी नौकरियाँ"],
  "12th": ["12th Pass Government Jobs", "12वीं पास सरकारी नौकरियाँ"],
  graduate: ["Graduate Government Jobs", "स्नातक सरकारी नौकरियाँ"],
  pg: ["Post-Graduate Government Jobs", "परास्नातक सरकारी नौकरियाँ"],
};

export function generateMetadata({ params }: { params: { locale: Locale; q: string } }): Metadata {
  const l = LABEL[params.q]?.[params.locale === "hi" ? 1 : 0] ?? params.q;
  return pageMeta(params.locale, `/category/qualification/${params.q}`, `${l} 2026`,
    `All Indian government exams open to ${params.q} qualified candidates — live dates and eligibility.`);
}

export default function Page({ params }: { params: { locale: Locale; q: string } }) {
  if (!VALID.includes(params.q)) notFound();
  const l = LABEL[params.q][params.locale === "hi" ? 1 : 0];
  return CategoryList({
    locale: params.locale, filter: { qualification: params.q },
    h1: l, intro: params.locale === "hi" ? "आपकी योग्यता के अनुसार परीक्षाएँ।" : "Exams you can apply for with this qualification.",
  });
}
