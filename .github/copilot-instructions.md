# MeraSafar — Copilot repository instructions (merasafar branch)

Bilingual (English unprefixed / `/hi`) government-exam portal: Next.js 14
App Router + TypeScript + Tailwind, deployed on Render
(merasafar.onrender.com). Data comes from `db/seed.json` when
`DATA_MODE=seed` (current default) or Supabase once provisioned — all
queries go through `lib/queries.ts`, which delegates to `lib/seed.ts`.

## Rules

1. **No mock data.** Every exam fact, paper link and cutoff traces to an
   official government source; paper links point at the official site —
   never re-host PDFs. URLs in `db/seed.json` are percent-encoded.
2. All data access goes through `lib/queries.ts`; never import seed or
   Supabase clients directly in pages.
3. Both locales must work for every page (en unprefixed, `/hi` prefixed;
   middleware handles rewrites); user-visible strings go through
   `lib/i18n.ts` or inline `hi ?` pairs, matching the file's convention.
4. The MeraSafar ⇄ Sarkari mode toggle themes via CSS variables in
   `app/globals.css` (`html[data-mode="sarkari"]`); gate mode-specific
   markup with `.mera-only` / `.sarkari-only` (they only hide, never set
   display).
5. Auth: OTP (`/api/auth/send-otp|verify-otp`) and email+password
   (`/api/auth/password`, verified by the ExamPath backend). Session is the
   `ms_session` httpOnly JWT cookie. Secrets only in env vars.
6. Paid endpoints (`/api/practice/generate`) keep their rate limiting and
   strict output validation.
7. Before pushing: `DATA_MODE=seed npx next build` must pass.
