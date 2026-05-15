import { db } from './api'

/** React Query key: global announcement row (`user_id` = default_user) */
export const GLOBAL_ANNOUNCEMENT_QUERY_KEY = ['dashboard-settings', 'global-announcement'] as const

/** Shell branding + density (merged from `default_user` + personal row in getDashboardSettings). */
export const APP_SHELL_SETTINGS_QUERY_KEY = ['dashboard-settings', 'app-shell'] as const

export type UiDensity = 'compact' | 'comfort'

export interface DashboardSettings {
  // Display Settings
  defaultBusinessType: 'leadgen' | 'ecommerce'
  defaultDateRange: number
  defaultMetric: 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas'

  // Chart Settings
  chartHeight: number
  showGridLines: boolean
  animateChart: boolean

  // Table Settings
  rowsPerPage: number
  showPlatformBadge: boolean

  // Data Settings
  cacheTimeout: number
  autoRefresh: boolean
  refreshInterval: number

  // Announcement Banner
  announcementEnabled: boolean
  announcementText: string
  announcementStyle: 'info' | 'warning' | 'success' | 'neutral'

  /** Org shell — stored on `default_user` row, merged for all users */
  appTitle: string
  appSubtitle: string
  appLogoUrl: string
  uiDensity: UiDensity

  /** Org-wide FABs — stored on `default_user`, merged for all users */
  assistOpenclawFabEnabled: boolean
  assistFeedbackFabEnabled: boolean
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  defaultBusinessType: 'ecommerce',
  defaultDateRange: 30,
  defaultMetric: 'roas',
  chartHeight: 350,
  showGridLines: true,
  animateChart: true,
  rowsPerPage: 50,
  showPlatformBadge: true,
  cacheTimeout: 5,
  autoRefresh: false,
  refreshInterval: 60,
  announcementEnabled: false,
  announcementText: '',
  announcementStyle: 'info',
  appTitle: 'UNI Mission Control',
  appSubtitle: 'Marketing Performance Hub',
  appLogoUrl: '/uni-logo.gif',
  uiDensity: 'comfort',
  assistOpenclawFabEnabled: false,
  assistFeedbackFabEnabled: true,
}

function mapDbRow(row: Record<string, unknown> | null | undefined): Partial<DashboardSettings> | null {
  if (!row) return null
  const d = row.ui_density
  const density: UiDensity | undefined = d === 'compact' || d === 'comfort' ? d : undefined
  return {
    defaultBusinessType: row.default_business_type as DashboardSettings['defaultBusinessType'],
    defaultDateRange: Number(row.default_date_range),
    defaultMetric: row.default_metric as DashboardSettings['defaultMetric'],
    chartHeight: Number(row.chart_height),
    showGridLines: Boolean(row.show_grid_lines),
    animateChart: Boolean(row.animate_chart),
    rowsPerPage: Number(row.rows_per_page),
    showPlatformBadge: Boolean(row.show_platform_badge),
    cacheTimeout: Number(row.cache_timeout),
    autoRefresh: Boolean(row.auto_refresh),
    refreshInterval: Number(row.refresh_interval),
    announcementEnabled: Boolean(row.announcement_enabled),
    announcementText: (row.announcement_text as string) ?? '',
    announcementStyle: (row.announcement_style as DashboardSettings['announcementStyle']) ?? 'info',
    appTitle: typeof row.app_title === 'string' && row.app_title.trim() ? row.app_title.trim() : undefined,
    appSubtitle: typeof row.app_subtitle === 'string' && row.app_subtitle.trim() ? row.app_subtitle.trim() : undefined,
    appLogoUrl: typeof row.app_logo_url === 'string' && row.app_logo_url.trim() ? row.app_logo_url.trim() : undefined,
    uiDensity: density,
    assistOpenclawFabEnabled:
      row.assist_openclaw_fab_enabled === null || row.assist_openclaw_fab_enabled === undefined
        ? undefined
        : Boolean(row.assist_openclaw_fab_enabled),
    assistFeedbackFabEnabled:
      row.assist_feedback_fab_enabled === null || row.assist_feedback_fab_enabled === undefined
        ? undefined
        : Boolean(row.assist_feedback_fab_enabled),
  }
}

export async function getDashboardSettings(userId: string): Promise<DashboardSettings> {
  try {
    const personal = await db.getSettings(userId)
    const global = userId !== 'default_user' ? await db.getSettings('default_user') : null

    const p = mapDbRow(personal as Record<string, unknown> | undefined) ?? {}
    const g = mapDbRow(global as Record<string, unknown> | undefined) ?? {}

    const shell = {
      appTitle: (g.appTitle ?? p.appTitle) ?? DEFAULT_SETTINGS.appTitle,
      appSubtitle: (g.appSubtitle ?? p.appSubtitle) ?? DEFAULT_SETTINGS.appSubtitle,
      appLogoUrl: (g.appLogoUrl ?? p.appLogoUrl) ?? DEFAULT_SETTINGS.appLogoUrl,
      uiDensity: ((g.uiDensity ?? p.uiDensity) as UiDensity | undefined) ?? DEFAULT_SETTINGS.uiDensity,
      assistOpenclawFabEnabled: g.assistOpenclawFabEnabled ?? DEFAULT_SETTINGS.assistOpenclawFabEnabled,
      assistFeedbackFabEnabled: g.assistFeedbackFabEnabled ?? DEFAULT_SETTINGS.assistFeedbackFabEnabled,
    }

    if (userId === 'default_user') {
      return {
        ...DEFAULT_SETTINGS,
        ...g,
        ...p,
        ...shell,
        announcementEnabled: p.announcementEnabled ?? g.announcementEnabled ?? DEFAULT_SETTINGS.announcementEnabled,
        announcementText: p.announcementText ?? g.announcementText ?? '',
        announcementStyle: p.announcementStyle ?? g.announcementStyle ?? 'info',
      }
    }

    return {
      ...DEFAULT_SETTINGS,
      ...g,
      ...p,
      ...shell,
      defaultBusinessType: p.defaultBusinessType ?? g.defaultBusinessType ?? DEFAULT_SETTINGS.defaultBusinessType,
      defaultDateRange: p.defaultDateRange ?? g.defaultDateRange ?? DEFAULT_SETTINGS.defaultDateRange,
      defaultMetric: p.defaultMetric ?? g.defaultMetric ?? DEFAULT_SETTINGS.defaultMetric,
      chartHeight: p.chartHeight ?? g.chartHeight ?? DEFAULT_SETTINGS.chartHeight,
      showGridLines: p.showGridLines ?? g.showGridLines ?? DEFAULT_SETTINGS.showGridLines,
      animateChart: p.animateChart ?? g.animateChart ?? DEFAULT_SETTINGS.animateChart,
      rowsPerPage: p.rowsPerPage ?? g.rowsPerPage ?? DEFAULT_SETTINGS.rowsPerPage,
      showPlatformBadge: p.showPlatformBadge ?? g.showPlatformBadge ?? DEFAULT_SETTINGS.showPlatformBadge,
      cacheTimeout: p.cacheTimeout ?? g.cacheTimeout ?? DEFAULT_SETTINGS.cacheTimeout,
      autoRefresh: p.autoRefresh ?? g.autoRefresh ?? DEFAULT_SETTINGS.autoRefresh,
      refreshInterval: p.refreshInterval ?? g.refreshInterval ?? DEFAULT_SETTINGS.refreshInterval,
    }
  } catch (error) {
    console.error('Error loading dashboard settings:', error)
    return DEFAULT_SETTINGS
  }
}

export type SaveDashboardSettingsResult = { ok: true } | { ok: false; error: string }

function errMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return String(error)
}

export async function saveDashboardSettings(
  userId: string,
  settings: DashboardSettings,
  /** When saving a personal row, omit org shell fields so they stay controlled from `default_user`. */
  omitShellFields = false
): Promise<SaveDashboardSettingsResult> {
  try {
    const dbSettings: Record<string, unknown> = {
      default_business_type: settings.defaultBusinessType,
      default_date_range: settings.defaultDateRange,
      default_metric: settings.defaultMetric,
      chart_height: settings.chartHeight,
      show_grid_lines: settings.showGridLines,
      animate_chart: settings.animateChart,
      rows_per_page: settings.rowsPerPage,
      show_platform_badge: settings.showPlatformBadge,
      cache_timeout: settings.cacheTimeout,
      auto_refresh: settings.autoRefresh,
      refresh_interval: settings.refreshInterval,
      announcement_enabled: settings.announcementEnabled,
      announcement_text: settings.announcementText,
      announcement_style: settings.announcementStyle,
    }
    if (!omitShellFields) {
      dbSettings.app_title = settings.appTitle
      dbSettings.app_subtitle = settings.appSubtitle
      dbSettings.app_logo_url = settings.appLogoUrl
      dbSettings.ui_density = settings.uiDensity
      dbSettings.assist_openclaw_fab_enabled = settings.assistOpenclawFabEnabled
      dbSettings.assist_feedback_fab_enabled = settings.assistFeedbackFabEnabled
    }

    await db.saveSettings(userId, dbSettings)
    return { ok: true }
  } catch (error) {
    console.error('Error saving dashboard settings:', error)
    return { ok: false, error: errMessage(error) }
  }
}
