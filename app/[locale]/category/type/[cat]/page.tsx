import type { Metadata } from "next";
import { CategoryList } from "@/lib/category-page";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale; cat: string } }): Metadata {
  const name = params.cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pageMeta(params.locale, `/category/type/${params.cat}`, `${name} Exams 2026`,
    `Indian government ${name.toLowerCase()} exams — notifications, dates and eligibility.`);
}

export default function Page({ params }: { params: { locale: Locale; cat: string } }) {
  const name = params.cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return CategoryList({
    locale: params.locale, filter: { category: params.cat },
    h1: `${name} ${params.locale === "hi" ? "परीक्षाएँ" : "exams"}`,
    intro: params.locale === "hi" ? "इस श्रेणी की सभी परीक्षाएँ।" : `Every tracked exam in the ${name.toLowerCase()} category.`,
  });
}
