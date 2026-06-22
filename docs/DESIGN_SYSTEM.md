# Mission Control design system (2026-06)

Light dashboard is the primary product surface. UNI Marketing site (`unimarketingagency.com`) informs accent, typography, and section rhythm.

**Constitution (locked tabs):** read `design/DESIGN.md` before UI work. Validate with `npm run validate:ui`.

## Token sources

| Layer | File |
|-------|------|
| Dashboard tokens + classes | `src/styles/uni-design-tokens.css` |
| Accent + theme | `src/index.css` (`data-accent`, `data-theme`) |
| Dashboard registry | `design/ui-registry.yaml` |
| Marketing reference | `00-unimarketingagency/design/tokens.json` |

## Locked components (use before inventing)

| Component | Path |
|-----------|------|
| Tab page | `TabPageShell` |
| In-page tabs | `TabNav` |
| Sections | `DashboardSection` |
| Tables | `DataTableShell`, `DataTable`, `DataTableHead*` |
| Empty states | `EmptyState` |
| Filters | `FilterShell` |
| Section titles | `ReportSectionHeader` |

Import: `src/components/ui`

## Accents (`data-accent`)

- `uni` — brand `#E85D04` (default)
- `orange` — Tailwind orange scale
- `blue` — alternate

## Themes (`data-theme`)

- `light` — default
- `dark` — `#060c16` surfaces (Settings → My appearance)
- `system` — follows OS

Personal prefs: `dashboard_settings.ui_theme`, `ui_accent`, `personal_ui_density`.

## Tab lock status

See `design/ui-registry.yaml`. **Locked:** Alerts, Mission, Feedback. **Migrating:** Overview, Heated, Creative, Realtime, Settings.

## Client insights

`client_dashboard_modules` + `ClientInsightsSection` below Agency KPI when a client has active modules.
