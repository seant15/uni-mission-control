/** Client-specific Overview widgets (one-off insights band). */

export type ClientDashboardModuleKey = 'kul_product_split'

export type ClientDashboardModule = {
  id: string
  client_id: string
  module_key: ClientDashboardModuleKey
  config_json: Record<string, unknown>
  is_active: boolean
  sort_order: number
}

export type KulProductSplitConfig = {
  title?: string
  machine_markers?: string[]
}

export function parseKulProductSplitConfig(raw: unknown): KulProductSplitConfig {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    machine_markers: Array.isArray(o.machine_markers)
      ? o.machine_markers.filter((x): x is string => typeof x === 'string')
      : undefined,
  }
}
