# Platform walkthrough feedback — handoff round (post-deploy 548869c)

Purpose: single record of a full-platform pass after recent development, split so dashboard (frontend), Supabase or app-backend, and ads_data_sync can pick up work without re-transcribing chat.

Conventions: "FE" = uni-mission-control (Vite/React). "BE sync" = ads_data_sync execution on VPS/cron. "DB" = Supabase migrations and data.

---

一、Overview（UNI Overview / MarketingOverview）

1. Layout: KPI / metric cards feel too large; tighten vertical rhythm, padding, and grid so the page reads more compact while staying readable on laptop.
2. Future (idea, not blocking): configurable overview modules and reusable "standard" blocks that mirror tables from other tabs (e.g. asset layer). Treat as roadmap after compact layout lands.
3. Time range: today only 7d / 30d / 90d presets. Product wants more presets aligned with analysis habits, e.g. last 24 hours, last 30 hours (and similar short windows), still fast to pick without full custom range every time.
4. Segments "All clients" / "By client" / "By account": UX is inconsistent — time axis and controls differ between modes. Goal: unify filter + date behavior so "By client" and "All clients" feel as capable as "By account" (where custom date range already exists). "By client" currently lacks a clear client selector on the page; clarify IA (when scope is single client via role vs explicit picker).
5. Asset performance: candidate to surface on Overview, possibly under the "By account" style layout as an asset layer; many more breakdown tables will land on Overview and Creative over time — design for density.
6. Settings: per-user performance dashboard preferences (admin / user settings) must be reconciled with the new Overview behavior so saved prefs still apply after Overview changes.

---

二、Global chrome — left sidebar

1. Collapsible sidebar on desktop (horizontal collapse / expand), persistent state (localStorage or user prefs) if product agrees.
2. Mobile: prefer a top/bottom collapsible nav bar instead of cramming the full desktop sidebar; validate focus trap, scroll, and route changes.
3. Acceptance: no broken layout at common breakpoints; collapsed state must not hide the only path to key routes.

---

三、Alerts

Explicitly deferred to a later deep pass: copy/i18n (remaining Chinese strings), search/filter polish, RileyFaithDesign data not loading (treat as separate data/env investigation). One-off "refresh fixed filter" observation ignored per product.

---

四、Mission Board — ClickUp link (current behavior vs asks)

What "Link ClickUp task" does today (FE + DB only):

- User pastes a task URL; `MissionBoard.tsx` parses task id and normalizes a URL, then saves `clickup_task_id` and `clickup_task_url` on `mission_cards` via API.
- If `clickup_task_url` is set, the UI shows an "Open in ClickUp" link (`href` to that URL). It does not call ClickUp API to validate the task exists.
- `synced_from_clickup` when true means the row was tied to an inbound sync path (e.g. n8n); delete from dashboard is blocked for those cards (see `api.ts`).

What it does not do today:

- No in-app action to create a new ClickUp task from a card.
- No mapping of card → ClickUp list / folder / assignee by client or team; that would require ClickUp API + a mapping model (client_id → list_id, etc.) and workflow decisions.

Product asks to consider later:

- Generate new ClickUp tasks from Mission Board.
- Route tasks to different lists (per client folder / list model) and thus implicit "team" ownership — needs ClickUp workspace structure doc and API credentials scope.

---

五、Realtime performance

1. "Time display" / timezone control does not change the data slice shown below — user expectation: choosing a timezone should drive how buckets are labeled and/or which 12h / 24h / 30h window is fetched or displayed. FE likely needs to pass timezone into queries or re-bucket client-side; BE may need to expose data already in a consistent basis (document contract).
2. Align semantics with Overview / Creative when comparing "24h" vs "calendar day" vs "realtime" so labels and numbers do not contradict each other (single glossary for "last 24h" vs "today local").

---

六、Creative performance

1. Primary issue: thumbnails / images missing for many rows; records appear without usable `image_url` (or equivalent). FE fallbacks exist but root fix is data pipeline.
2. Product direction: denser tables, more columns where useful; eventual breakdown tables shared with Overview patterns.
3. Optional IA: "Asset performance" block could move toward Overview (see section one); if moved, avoid duplicate maintenance — one source component or shared query module.

---

七、Feedback widget

1. Bug: attaching an image leads to crash / inability to submit. FE should reproduce with browser console + Network tab; verify Supabase Storage bucket, RLS policies, max upload size, and `uploadFeedbackAttachment` path. Harden UX: show inline error instead of hard crash if upload fails.

---

八、Frontend backlog summary (uni-mission-control)

Priority cluster A — layout and navigation: compact Overview cards; collapsible sidebar desktop + mobile pattern; unify Overview segment filters and date presets (include short windows).

Priority cluster B — correctness vs copy: Realtime timezone actually affecting display or queries; Creative empty images mitigated in UI only until sync fixed; Feedback attachment submit stability.

Priority cluster C — roadmap: customizable overview modules; Mission Board → ClickUp create/list routing; asset tables placement.

---

九、Backend / ads_data_sync backlog (for execution team)

1. Creative images: ensure marketing sync jobs persist `image_url` / `thumbnail_url` (and any required creative asset fields) for Meta rows used by Creative Performance. Repo convention: full runs use `sync_marketing_data.py` with creatives path as documented for VPS/n8n; metrics-only runs explain missing thumbnails. Audit recent sync logs for RileyFaithDesign if that client lost rows or URLs.
2. RileyFaithDesign: data stopped loading — separate ticket: verify client status, account ids, sync errors, RLS, and last successful `hourly_performance` / `daily_performance` / `meta_ads` timestamps for that `client_id`.
3. Realtime / timezone: if product requires server-side bucketing by advertiser TZ, define API contract (query params + response shape); today much data is UTC-hour based — document in OPENCLAW / UNI pipeline docs so FE does not fake TZ on UTC buckets incorrectly.
4. Optional future: ClickUp outbound task creation and list assignment — not in current dashboard scope; needs API keys, rate limits, idempotency, and mapping tables.

---

十、Supabase / DB (shared)

1. Apply any pending migrations on the same project Vercel uses (`data_timezone`, `meta_ads` extra columns, `mission_cards` ClickUp columns, `alert_rules` template check, etc.) if previews still error on missing columns.
2. Feedback Storage: bucket + policies for attachment uploads if not already production-ready.

---

十一、Suggested sequencing (fast test loop)

1. BE sync: creative image fields + RileyFaithDesign investigation (unblocks honest Creative QA).
2. FE: Overview compact + sidebar + unified Overview date/filters (largest visible win).
3. FE: Realtime TZ behavior + Feedback attachments (user-visible correctness).
4. Alerts deep dive and Mission Board ClickUp automation remain later phases.

---

Document owner: generated from stakeholder walkthrough; amend in-repo as tickets are created or scope changes.
