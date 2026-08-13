import type { Metadata } from "next";
import { CategoryList } from "@/lib/category-page";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale; stateSlug: string } }): Metadata {
  const name = params.stateSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pageMeta(params.locale, `/category/state/${params.stateSlug}`,
    `${name} Government Exams 2026`,
    `${name} state government exam notifications, dates and eligibility.`);
}

export default function Page({ params }: { params: { locale: Locale; stateSlug: string } }) {
  const name = params.stateSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return CategoryList({
    locale: params.locale, filter: { state: params.stateSlug },
    h1: `${name} ${params.locale === "hi" ? "सरकारी परीक्षाएँ" : "government exams"}`,
    intro: params.locale === "hi" ? "इस राज्य की सभी परीक्षाएँ।" : `State exams conducted for ${name}.`,
  });
}
