# Frontend brief — UNI Mission Control (canonical, 2026-05)

Repo: `uni-mission-control` (Vite + React + TS + Tailwind + TanStack Query + Supabase JS).

## 1. Shipped UI and behavior (May 2026 pass)

- App shell: frosted sidebar, centered logo and collapse control when collapsed, soft global background wash (`App.tsx`).
- Overview — Agency: client breakdown chart with controls moved up; performance-by-platform block lower; client + by-account tables ordered at bottom (`MarketingOverview.tsx`, `AgencyClientBreakdown.tsx`).
- Overview — Heated: KPI cards → main daily trend chart → one card with tab strip: Daily breakdown, Meta campaigns, Google campaigns, Google keywords, Search terms. Tabs with no rows are disabled; active tab auto-falls back when filters change (`DataAnalytics.tsx`).
- Overview routing: `/` uses `OverviewPage.tsx` with two tabs — Agency View (rollup) and Heated View (embedded `DataAnalytics`). Legacy query params `all-clients`, `by-client`, `by-account` redirect into `agency` or `heated`. The older three-tab spec (separate “By client” = `ClientsOverview`) is not recreated; `/clients-overview` redirects to `/?tab=agency`.
- Mission Board: narrower columns (~210px), more vertical spacing (`MissionBoard.tsx`).
- Alerts: bulk select (per page), Create missions / Archive (`dismissAlert`) / Delete; stronger `new` status styling (`Alerts.tsx`, `AlertGroupList.tsx`). Tabs: Alerts / Alert Rules / A/B & delivery.
- Real-time Performance: bottom duplicate “recent alerts” block removed (`RealtimePerformance.tsx`). Time display still labels UTC-hour buckets; changing numbers per tz mode needs a backend contract (see combined brief §Realtime).
- Settings: brand-colored controls, tab “Defaults & charts”, copy stating defaults apply to Account Performance (Heated), not Marketing Overview or Real-time; avatar gradient follows accent; announcement “info” preview uses light stone/beige (`DashboardSettings.tsx`).
- A/B observability: `db.getLastAbJobRun()` + card on Alerts → A/B & delivery tab (`AbTestDeliveryTab.tsx`). Detail: `docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md` (also summarized in backend brief migrations list).

## 2. AGENT_BRIEF_FRONTEND_DEV alignment (status)

- P1-1 Daily vs hourly merge: `getDailyPerformance` uses per-`client_id|date` presence before hourly gap-fill (`api.ts`).
- P1-2 Realtime window: `getHourlyPerformance` uses fresh `new Date()`; query key includes `windowHours` and a 5-minute `hourlySlot`; hourly `staleTime` 60s (`RealtimePerformance.tsx`).
- P1-3 Creative thumbnails: `CreativeThumb` fallbacks + page-level amber banner when >60% of URLs with src fail (`CreativePerformance.tsx`).
- P2-4 Roles: `RoleGuard`, `rbac.ts`, `scopedClientIdFromUser`, sidebar filtering; DB may still emit `client_user` — normalized to effective `client` where needed.
- P2-5 Navigation: two-tab Overview (above), not the original three internal tabs.
- P3-6 ClickUp: Mission cards support ClickUp link/badge (`MissionBoard.tsx`, types/migrations as deployed).
- P3-7 Rule builder: `min_spend_threshold` + Slack fields tied to `client_alert_delivery` (`RuleBuilderModal.tsx`).

## 3. What the frontend cannot fix alone

- Real-time “Time display” must change API + bucket math if numbers must differ by UTC vs local vs account; today it is mostly labeling on UTC slices.
- Creative images require non-null `image_url` / `thumbnail_url` (and valid HTTPS URLs) from Supabase / sync.
- OpenClaw iframe: set `VITE_OPENCLAW_CHAT_URL`; embed page must allow `frame-ancestors` / avoid blocking `X-Frame-Options` (see `docs/OPENCLAW_CHAT_URL.md` in repo).

## 4. Commands and checks

- `npm run build` (from repo root).
- Smoke: Alerts bulk actions; DataAnalytics tabs with Meta-only / Google-only filters; A/B tab shows last `job_runs` row after migrations.

## 5. Session-touched source files (reference list)

`App.tsx`, `AgencyClientBreakdown.tsx`, `MarketingOverview.tsx`, `DataAnalytics.tsx`, `MissionBoard.tsx`, `RealtimePerformance.tsx`, `Alerts.tsx`, `Alerts/AlertGroupList.tsx`, `Alerts/AbTestDeliveryTab.tsx`, `DashboardSettings.tsx`, `lib/api.ts`, `docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md`, `TEAM_BRIEF_FRONTEND.md` (repo copy — now points here).
