// Shared server helpers for the exam tab pages — one hero + tab bar template,
// driven entirely by the cycle's data (brief §2: one reusable dashboard).
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import AdSlot from "@/components/AdSlot";
import Emblem from "@/components/Emblem";
import ExamAlertPopup from "@/components/ExamAlertPopup";
import ExamTabBar from "@/components/ExamTabBar";
import FollowButton from "@/components/FollowButton";
import StatusPill from "@/components/StatusPill";
import TrackView from "@/components/TrackView";
import { daysLeft, fmtDate, inr } from "@/lib/format";
import { pick, t } from "@/lib/i18n";
import { getBody, getCycle, getExam } from "@/lib/queries";
import { breadcrumbLd, jsonLd } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";
import type { Body, Cycle, Exam } from "@/lib/types";

export interface ExamCtx { cycle: Cycle; exam: Exam | null; body: Body | null }

export async function loadExamCtx(cycleId: string): Promise<ExamCtx | null> {
  const cycle = await getCycle(cycleId);
  if (!cycle) return null;
  const [exam, body] = await Promise.all([getExam(cycle.exam_slug), getBody(cycle.body_slug)]);
  return { cycle, exam, body };
}

export function ExamShell({ ctx, locale, active, children }: {
  ctx: ExamCtx; locale: Locale; active: string; children: ReactNode;
}) {
  const { cycle, body } = ctx;
  const s = t(locale);
  const dl = daysLeft(cycle.application_end);
  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: body?.short_name ?? cycle.body_slug, path: `/body/${cycle.body_slug}` },
    { name: cycle.title, path: `/exam/${cycle.id}` },
  ], locale);
  const jobLd = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: cycle.title, description: cycle.summary ?? cycle.title,
    hiringOrganization: { "@type": "GovernmentOrganization", name: body?.name ?? cycle.body_slug, sameAs: body?.official_url ?? undefined },
    employmentType: "FULL_TIME", totalJobOpenings: cycle.vacancy || undefined,
    validThrough: cycle.application_end ?? undefined, datePosted: cycle.application_start ?? undefined,
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "IN" } },
  };
  return (
    <div className="wrap py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jobLd) }} />
      <TrackView entityType="exam_cycle" entityId={cycle.id} />
      {/* Hero */}
      <div className="card mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-700 to-brand-800 p-5 text-white">
          <Emblem short={body?.short_name ?? cycle.body_slug.toUpperCase()} color={body?.color} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-brand-100">{pick(locale, body?.name, body?.name_hi)}</p>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{pick(locale, cycle.title, cycle.title_hi)}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusPill status={cycle.status} locale={locale} />
              {cycle.vacancy > 0 && <span className="pill bg-white/15 text-white">{inr(cycle.vacancy)} {s.vacancies}</span>}
              {cycle.age_min != null && <span className="pill bg-white/15 text-white">{s.age} {cycle.age_min}–{cycle.age_max}</span>}
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-2">
            {cycle.apply_url && dl != null && dl >= 0 && (
              <a href={cycle.apply_url} target="_blank" rel="noopener" className="btn-accent">{s.apply} ↗</a>
            )}
            <FollowButton cycleId={cycle.id} locale={locale} />
          </div>
        </div>
        {cycle.application_end && (
          <p className="flex items-center gap-2 px-5 py-2.5 text-sm">
            <b className="font-extrabold text-red-600">
              {dl == null ? "" : dl < 0 ? s.closed : dl === 0 ? "Today" : `${dl} ${s.daysLeft}`}
            </b>
            <span className="text-slate-500">· {s.lastDate}: {fmtDate(cycle.application_end, locale)}</span>
          </p>
        )}
      </div>
      <ExamTabBar cycleId={cycle.id} active={active} locale={locale} />
      <AdSlot slot="exam-incontent" />
      <div className="mt-4 flex flex-col gap-5">{children}</div>
      <ExamAlertPopup cycleId={cycle.id} title={pick(locale, cycle.title, cycle.title_hi)} locale={locale} />
    </div>
  );
}

export function tabMetaTitle(locale: Locale, cycle: Cycle, tab: string): string {
  const title = pick(locale, cycle.title, cycle.title_hi);
  return tab ? `${title} ${tab}` : title;
}

export { notFound };
