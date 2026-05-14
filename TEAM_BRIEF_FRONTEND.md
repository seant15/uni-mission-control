# TEAM BRIEF — Frontend pass (May 2026) and backend coordination

This document lists what the web app (`uni-mission-control`) changed in this pass and what the backend or platform team should own next. The same content is at `C:\Users\stan8\022026 OPENCLAW WORKSPACE\TEAM_BRIEF_FRONTEND.md` for the open workspace folder.

## Shipped in the frontend (high level)

- Shell / sidebar: lighter frosted sidebar, centered logo and collapse control when the rail is collapsed, soft global background wash (existing work carried forward in `App.tsx`).
- Marketing Overview (agency): client breakdown chart moved up with controls; platform-by-platform block moved down; tables ordered as requested (`MarketingOverview.tsx`, `AgencyClientBreakdown.tsx`).
- Account Performance / Heated (`DataAnalytics.tsx`): KPI cards, then main daily trend chart, then a single card with tab buttons for Daily breakdown, Meta campaigns, Google campaigns, Google keywords, and Search terms (only tabs with data stay enabled; auto-fallback tab when filters change).
- Agency-style metric cards and overview layout polish (`MarketingOverview.tsx`).
- Mission Board: narrower columns (about 75% of previous width), more vertical padding in the board area (`MissionBoard.tsx`).
- Alerts: bulk selection (per page), actions Create missions, Archive (maps to `dismissAlert` / status dismissed), Delete; stronger visual treatment for status `new`; tab split for Rules vs A/B was already present (`Alerts.tsx`, `AlertGroupList.tsx`).
- Real-time Performance: removed the duplicate “recent alerts” panel at the bottom; alerts stay on the dedicated Alerts page (`RealtimePerformance.tsx`).
- Settings: branding-aligned colors, tab renamed to “Defaults & charts”, copy clarifying that saved defaults apply to Account Performance (Heated), not Marketing Overview or Real-time; profile avatar gradient follows accent (orange vs blue); announcement “info” style preview shifted to light stone/beige (`DashboardSettings.tsx`).

## Backend and data — Real-time “Time display” (UTC vs local vs account)

Current behavior: `getHourlyPerformance` is keyed by `windowHours` and returns `current` / `previous` rows from `hourly_performance` (UTC hour buckets). The “Time display” control mainly changes how window bounds and some timestamps are labeled in the UI; it does not change which rows are fetched or how the comparison window is computed.

If product requires that switching between UTC, browser local, and account timezone shows different numeric slices (e.g. “last 1 hour” meaning different hour boundaries per account), the backend needs one or more of:

1. Explicit contract: for each mode, define the start/end instant used to filter hourly rows (and whether “hour” means wall-clock in a given IANA zone vs fixed UTC offset).
2. API support: either accept `tz_mode` plus optional `account_id` / `client_id` and compute bucket boundaries server-side, or return raw UTC slices and multiple pre-aggregated series — but the frontend cannot invent account-local buckets without the same rules as ingestion.
3. Ingestion alignment: ensure `hourly_performance` (or a new rollup) is keyed in a way that supports those boundaries without double-counting when crossing DST.

Until that contract exists, the UI copy should continue to state that buckets are UTC-based and labels are for display (already partially reflected in `RealtimePerformance.tsx`).

## Backend and data — Creative Performance thumbnails

The UI reads `thumbnail_url` and `image_url` from `db.getMetaCreatives` (Supabase select includes both fields). `CreativePerformance.tsx` shows an `<img>` when either URL is present; otherwise it falls back to icons / permalinks.

If thumbnails are still blank in production:

1. Confirm ETL or sync jobs populate `image_url` / `thumbnail_url` on the creatives table (column names must match what the API selects).
2. Confirm URLs are absolute HTTPS and reachable from the user browser (Meta CDN URLs sometimes expire or require referrer policies).
3. If the pipeline only stores Graph API handles, add a resolver or store stable public URLs server-side.

No frontend change is required once non-null, valid URLs are returned.

## OpenClaw iframe — “refused to connect”

The widget (`OpenClawChatWidget.tsx`) sets `iframe.src` to `import.meta.env.VITE_OPENCLAW_CHAT_URL`.

Checklist for ops / backend of the chat host:

1. Set `VITE_OPENCLAW_CHAT_URL` in `.env.local` (dev) and Vercel/host env (prod) to the full HTTPS embed URL.
2. Chat page must allow embedding from the Mission Control origin: avoid `X-Frame-Options: DENY` / `SAMEORIGIN` when the parent is another site; use CSP `frame-ancestors` listing the app origins (see `docs/OPENCLAW_CHAT_URL.md` in the repo).
3. Mixed content: parent and child should both be HTTPS.
4. Auth: use an embed token in the query string or ensure users are already logged in on the chat domain in the same browser.

## Alerts bulk actions — API usage

- Archive: `db.dismissAlert(id, userId)` → status `dismissed` with audit fields.
- Delete: `db.deleteAlert(id)` hard delete (requires RLS DELETE for the role).
- Create missions: same as row action — `findMissionCardBySourceAlert` then `createMissionCard` with `source_alert_id`; duplicates are skipped and counted in the toast.

If bulk dismiss/delete should be atomic or rate-limited, consider a single RPC in Supabase instead of many parallel calls from the browser.

## Suggested verification

- `npm run build` in `uni-mission-control` (already run green after these edits).
- Manual: Alerts page — multi-select, archive, delete, create missions on a staging project with test alerts.
- Manual: Data Analytics — tab strip with Meta-only and Google-only filters.
- OpenClaw: load app with a known-good embed URL and confirm no console CSP/frame errors.
