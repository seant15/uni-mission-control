/** Rolling 30d ad spend targets per platform (clients.target_ad_spend_30d_by_platform). */

export type AdPlatformSpendKey = 'meta_ads' | 'google_ads'

export type AdSpendTargetByPlatform = Partial<Record<AdPlatformSpendKey, number>>

const PLATFORM_KEYS: AdPlatformSpendKey[] = ['meta_ads', 'google_ads']

export function parseAdSpendTargets(raw: unknown): AdSpendTargetByPlatform {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: AdSpendTargetByPlatform = {}
  for (const key of PLATFORM_KEYS) {
    const v = o[key]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[key] = v
    else if (typeof v === 'string' && v.trim()) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) out[key] = n
    }
  }
  return out
}

export function adSpendTargetTotal(targets: AdSpendTargetByPlatform): number {
  return PLATFORM_KEYS.reduce((s, k) => s + (targets[k] ?? 0), 0)
}

export function spendTargetUsagePct(spent: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null
  return (spent / target) * 100
}

/** Cumulative 30d pace for day index 1..N within a chart range. */
export function cumulativePaceForDay(target30d: number, dayIndex1Based: number): number {
  if (target30d <= 0 || dayIndex1Based <= 0) return 0
  return (target30d / 30) * dayIndex1Based
}

export function platformSpendLabel(platform: AdPlatformSpendKey): string {
  return platform === 'meta_ads' ? 'Meta' : 'Google'
}

export function resolveActiveSpendTarget(
  targets: AdSpendTargetByPlatform,
  selectedPlatform: string,
): number {
  if (selectedPlatform === 'meta_ads') return targets.meta_ads ?? 0
  if (selectedPlatform === 'google_ads') return targets.google_ads ?? 0
  return adSpendTargetTotal(targets)
}

export function rollupCostByPlatform(
  rows: Array<{ platform?: string | null; cost?: number | null; spend?: number | null }>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const p = String(row.platform || '')
    if (!p) continue
    const add = Number(row.cost ?? row.spend) || 0
    out[p] = (out[p] || 0) + add
  }
  return out
}
