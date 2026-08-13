import type { Metadata } from "next";
import MonthCalendar from "@/components/MonthCalendar";
import { getKeyDatesForMonth } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const hi = params.locale === "hi";
  return pageMeta(params.locale, "/calendar",
    hi ? "परीक्षा कैलेंडर" : "Exam Calendar — Every Government Exam Deadline",
    hi ? "महीने के अनुसार हर सरकारी परीक्षा की मुख्य तिथियाँ।" : "Month-by-month key dates and deadlines for every tracked Indian government exam.");
}

export default async function CalendarPage({ params, searchParams }: {
  params: { locale: Locale }; searchParams: { y?: string; m?: string };
}) {
  const now = new Date();
  const year = parseInt(searchParams.y ?? "", 10) || now.getFullYear();
  const month1 = Math.min(12, Math.max(1, parseInt(searchParams.m ?? "", 10) || now.getMonth() + 1));
  const items = await getKeyDatesForMonth(year, month1);
  return (
    <div className="wrap py-8">
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight">📅 {params.locale === "hi" ? "परीक्षा कैलेंडर" : "Exam calendar"}</h1>
      <MonthCalendar year={year} month1={month1} items={items} locale={params.locale} basePath="/calendar" />
    </div>
  );
}
