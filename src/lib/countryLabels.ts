/** English country labels for Meta ISO codes + Google geo criterion ids. */

import googleGeoCountriesJson from '../data/googleGeoCountries.json'

const ISO_DISPLAY = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

/** Common Google Ads country criterion ids (fallback until googleGeoCountries.json is present). */
const GOOGLE_GEO_FALLBACK: Record<string, string> = {
  '2840': 'United States',
  '2826': 'United Kingdom',
  '2124': 'Canada',
  '2036': 'Australia',
  '2276': 'Germany',
  '2250': 'France',
  '2752': 'Sweden',
  '2724': 'Spain',
  '2380': 'Italy',
  '2528': 'Netherlands',
  '2756': 'Switzerland',
  '2056': 'Belgium',
  '2080': 'Brazil',
  '2392': 'Japan',
  '2410': 'South Korea',
  '2356': 'India',
  '2484': 'Mexico',
  '2702': 'Singapore',
  '2344': 'Hong Kong',
  '2158': 'Taiwan',
  '2554': 'New Zealand',
}

const googleGeoCache: Record<string, string> = {
  ...GOOGLE_GEO_FALLBACK,
  ...(googleGeoCountriesJson as Record<string, string>),
}

export function countryDisplayLabel(raw: string, platform?: string | null): string {
  const trimmed = (raw || '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return 'Unknown'

  const geoMatch = /^Geo\s+(\d+)$/i.exec(trimmed)
  const numericId = /^\d+$/.test(trimmed) ? trimmed : geoMatch?.[1]
  if (numericId) {
    const hit = GOOGLE_GEO_FALLBACK[numericId] ?? googleGeoCache?.[numericId]
    if (hit) return hit
    if ((platform || '').toLowerCase() === 'google_ads' || geoMatch) {
      return `Country (${numericId})`
    }
  }

  const iso = trimmed.toUpperCase()
  if (iso.length === 2 && /^[A-Z]{2}$/.test(iso)) {
    const name = ISO_DISPLAY?.of(iso)
    if (name && name !== iso) return name
  }

  if (trimmed.length > 3 && !/^geo\s+\d+$/i.test(trimmed)) {
    return trimmed.replace(/_/g, ' ')
  }

  return trimmed.replace(/_/g, ' ') || 'Unknown'
}

