# Mission Control — performance backlog

Recorded 2026-06-21 (America/Phoenix). Phase 5 item 1 (ErrorBoundary) shipped in the same wave; items below are deferred.

## Done this wave

- [x] Top-level `AppErrorBoundary` — prevents full white-screen freeze on render errors
- [x] Native form control text color fix (OS dark mode date/select)

## Backlog (priority order)

### P1 — Query & refetch pressure

- [ ] Set global `refetchOnWindowFocus: false` in `main.tsx` (or disable on heavy pages only: Overview/Heated)
- [ ] Reduce parallel Supabase queries on `DataAnalytics` mount — tier 1: KPI + daily chart; tier 2: tabs/drill-down on demand
- [ ] Audit background `refetchInterval` timers (`App.tsx` alert count 60s, `RealtimePerformance`, Alerts tabs) — pause when tab hidden (`document.visibilityState`)

### P2 — Bundle & main-thread

- [ ] Route-level code split (`React.lazy`) for Alerts, Heated/DataAnalytics, Creative, Mission Board, AI Chat Admin
- [ ] Manual chunks for Recharts + heavy deps (current prod bundle ~1.36 MB JS)
- [ ] Defer non-critical chart animation when `prefers-reduced-motion`

### P3 — Data payload

- [ ] Paginate or cap date range on keyword/search-term queries
- [ ] Wire Settings `autoRefresh` / `refreshInterval` to React Query or remove dead UI
- [ ] Supabase select column pruning on largest tables (`daily_performance`, `hourly_performance`)

### P4 — Observability

- [ ] Enable Vercel Speed Insights + Web Vitals
- [ ] Optional client beacon: long task / query duration logging for super_admin
- [ ] Document repro checklist: page, filters, browser, role, Network slowest request

## Symptom reference

User report: all pages, all users, UI stops responding (not just slow — full freeze). Likely multi-factor: large JS parse + query storm + unhandled render error (now mitigated by ErrorBoundary).

## Hosting

Stay on Vercel until P1–P2 measured. Re-evaluate Cloudflare Pages / self-host only if client-side fixes insufficient.
