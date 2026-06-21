# Mission Control design system (2026-06)

Light dashboard is the primary product surface (~60%+ of UI). UNI Marketing site (`unimarketingagency.com`) informs accent, typography, and section rhythm — not a full dark marketing clone.

## Token sources

| Layer | File |
|-------|------|
| Dashboard tokens | `src/styles/uni-design-tokens.css` |
| Accent + theme | `src/index.css` (`data-accent`, `data-theme`) |
| Marketing reference | `00-unimarketingagency/design/tokens.json` |

## Accents (`data-accent`)

- `uni` — brand `#E85D04` (default)
- `orange` — Tailwind orange scale
- `blue` — alternate

## Themes (`data-theme`)

- `light` — default; existing cards, FilterShell, KPI grids
- `dark` — `#060c16` surfaces, light text (Settings → My appearance)
- `system` — follows OS preference

Personal prefs stored in `dashboard_settings.ui_theme`, `ui_accent`, `personal_ui_density`.

## Primitives

Use existing classes before inventing new ones:

- Section label: `.uni-section-label`
- Card: `.uni-card`, `.uni-card-header`, `.uni-card-body`
- KPI journey sections: `KpiSection` in `MarketingOverview.tsx`

## Client insights

One-off widgets: `client_dashboard_modules` + `ClientInsightsSection` below Agency KPI cards when a client is selected and has active modules.
