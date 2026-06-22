# UNI Mission Control — UI Design Constitution

Read before any tab, table, or section work. Mirrors the unimarketingagency.com constitution model (tokens → classes → registry → validate), adapted for an interactive dashboard.

## Stack

- Platform: React + Vite + Tailwind (light primary; dark optional)
- Delivery route: Dashboard UI constitution (not Elementor)
- Source of truth: `design/tokens.json` → `src/styles/uni-design-tokens.css` → `src/components/ui/*` → `design/ui-registry.yaml`

## Non-negotiables (locked tabs)

1. Accent via `--brand-600` / `data-accent` — do not hardcode random blues/purples for primary actions.
2. Tab pages use `TabPageShell` + `TabNav` for in-page tabs (Alerts, Settings sub-views, etc.).
3. Data tables use `DataTableShell` + `DataTable` — no raw `bg-white rounded-xl … overflow-hidden` table wrappers.
4. Section blocks use `DashboardSection` or `.uni-section-panel` — no ad-hoc card shells on locked routes.
5. Filter strips use `FilterShell` (`.uni-filter-shell`) — not one-off sticky bars.
6. Section labels: `.uni-section-label` or `ReportSectionHeader` — not random uppercase gray text.
7. Table headers: `.uni-data-table-th` / `DataTableHeadCell` — not `bg-gray-50 text-xs uppercase` one-offs.
8. No card-inside-card on the same visual layer.
9. Prefer CSS variables (`var(--uni-*)`) over inline hex when a token exists.

## Variables (dashboard light)

| Token | Use |
|---|---|
| `--uni-bg` | Page background |
| `--uni-surface` / `--uni-card` | Cards, table shells |
| `--uni-border` | Borders, dividers |
| `--uni-text` / `--uni-text-muted` | Body / secondary |
| `--brand-600` | Primary CTA, active tab |

Marketing site reference: `00-unimarketingagency/design/tokens.json` (dark marketing site). Dashboard keeps light surfaces; dark theme overrides in `src/index.css`.

## Components (use, do not reinvent)

| Component | Role |
|---|---|
| `TabPageShell` | Page title, subtitle, optional icon, header actions |
| `TabNav` | In-page tab bar (Alerts, Rules, …) |
| `DashboardSection` | Card section with optional `ReportSectionHeader` |
| `DataTableShell` + `DataTable` | Locked table container + `<table>` |
| `DataTableHead` / `DataTableHeadCell` | Thead row/cells |
| `DataTableBody` / `DataTableRow` / `DataTableCell` | Tbody primitives |
| `EmptyState` | Zero-row / all-clear states inside sections |
| `FilterShell` | Sticky filter strip (Overview, Heated, Mission filters) |
| `ReportSectionHeader` | Section label + title + badge |

Import from `src/components/ui` or direct paths.

## Tab registry

Which routes are locked: `design/ui-registry.yaml`. Run validation before merge:

```bash
npm run validate:ui
```

## Page assembly (agent workflow)

1. Read `design/ui-registry.yaml` — is this tab `locked` or `migrating`?
2. Use shared components from the registry `requires` list.
3. Run `npm run validate:ui` — fix P1 violations on locked tabs.
4. Visual QA: light + dark theme, compact + comfort density.

## Migrating tabs (warn-only until flipped to `locked`)

Overview, Heated, Creative, Realtime, Settings — use shared components for **new** sections; full sweep is incremental. Do not add new raw table wrappers on any tab.
