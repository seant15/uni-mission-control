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

/** Flat daily spend pace to hit a 30d target (for chart reference line). */
export function dailySpendPace(target30d: number): number {
  if (!Number.isFinite(target30d) || target30d <= 0) return 0
  return target30d / 30
}

export function sumAdSpendTargetsForClients(
  clients: Array<{ target_ad_spend_30d_by_platform?: unknown }>,
): AdSpendTargetByPlatform {
  const out: AdSpendTargetByPlatform = {}
  for (const client of clients) {
    const t = parseAdSpendTargets(client.target_ad_spend_30d_by_platform)
    if (t.meta_ads) out.meta_ads = (out.meta_ads ?? 0) + t.meta_ads
    if (t.google_ads) out.google_ads = (out.google_ads ?? 0) + t.google_ads
  }
  return out
}

export function formatSpendTargetUsage(spent: number, target: number): string | null {
  const pct = spendTargetUsagePct(spent, target)
  if (pct == null) return null
  return `${pct.toFixed(0)}% of $${target.toLocaleString()}`
}

export function platformKeyFromBreakdown(platform: string): AdPlatformSpendKey | null {
  const p = platform.toLowerCase()
  if (p === 'meta_ads' || p === 'meta') return 'meta_ads'
  if (p === 'google_ads' || p === 'google') return 'google_ads'
  return null
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
