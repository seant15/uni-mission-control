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
  if (key === 'meta_ads') return 'uni-platform-badge uni-platform-badge--meta'
  if (key === 'google_ads') return 'uni-platform-badge uni-platform-badge--google'
  if (key === 'shopify') return 'uni-platform-badge uni-platform-badge--shopify'
  return 'uni-platform-badge uni-platform-badge--default'
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
