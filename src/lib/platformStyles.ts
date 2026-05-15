/** Unified platform labels + badge colors (Google amber, Meta navy, Shopify green). */

export type PlatformId = 'meta_ads' | 'google_ads' | 'shopify' | string

const LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  shopify: 'Shopify',
  tiktok_ads: 'TikTok Ads',
}

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return 'Unknown'
  const key = platform.toLowerCase()
  if (LABELS[key]) return LABELS[key]
  const s = platform.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function platformBadgeClass(platform: string | null | undefined): string {
  const key = (platform || '').toLowerCase()
  if (key === 'meta_ads') return 'bg-[#1e3a5f] text-white border border-[#2d4a6f]'
  if (key === 'google_ads') return 'bg-amber-100 text-amber-950 border border-amber-300'
  if (key === 'shopify') return 'bg-emerald-100 text-emerald-900 border border-emerald-300'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

export function platformShortLabel(platform: string | null | undefined): string {
  const key = (platform || '').toLowerCase()
  if (key === 'meta_ads') return 'Meta'
  if (key === 'google_ads') return 'Google'
  if (key === 'shopify') return 'Shopify'
  return platformLabel(platform).split(' ')[0] || 'Other'
}

export function isAdPlatform(platform: string | null | undefined): boolean {
  const k = (platform || '').toLowerCase()
  return k === 'meta_ads' || k === 'google_ads'
}
