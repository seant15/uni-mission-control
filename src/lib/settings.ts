import { db } from './api'

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
}

export async function getDashboardSettings(userId: string): Promise<DashboardSettings> {
  try {
    const dbSettings = await db.getSettings(userId)

    if (dbSettings) {
      return {
        defaultBusinessType: dbSettings.default_business_type,
        defaultDateRange: dbSettings.default_date_range,
        defaultMetric: dbSettings.default_metric,
        chartHeight: dbSettings.chart_height,
        showGridLines: dbSettings.show_grid_lines,
        animateChart: dbSettings.animate_chart,
        rowsPerPage: dbSettings.rows_per_page,
        showPlatformBadge: dbSettings.show_platform_badge,
        cacheTimeout: dbSettings.cache_timeout,
        autoRefresh: dbSettings.auto_refresh,
        refreshInterval: dbSettings.refresh_interval,
      }
    }

    return DEFAULT_SETTINGS
  } catch (error) {
    console.error('Error loading dashboard settings:', error)
    return DEFAULT_SETTINGS
  }
}

export async function saveDashboardSettings(
  userId: string,
  settings: DashboardSettings
): Promise<boolean> {
  try {
    const dbSettings = {
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
    }

    await db.saveSettings(userId, dbSettings)
    return true
  } catch (error) {
    console.error('Error saving dashboard settings:', error)
    return false
  }
}
