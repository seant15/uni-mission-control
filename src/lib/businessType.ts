/** Canonical clients.business_type — must match Supabase CHECK (ecommerce | leadgen). */

export type BusinessType = 'leadgen' | 'ecommerce'

const LEADGEN_ALIASES = new Set([
  'leadgen',
  'lead_gen',
  'lead_generation',
  'local',
  'lead gen',
])

export function normalizeBusinessType(raw: unknown): BusinessType {
  if (raw == null || raw === '') return 'ecommerce'
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_')
  if (LEADGEN_ALIASES.has(s) || LEADGEN_ALIASES.has(String(raw).trim().toLowerCase())) {
    return 'leadgen'
  }
  return 'ecommerce'
}

export function isLeadGen(raw: unknown): boolean {
  return normalizeBusinessType(raw) === 'leadgen'
}

export function isEcommerce(raw: unknown): boolean {
  return normalizeBusinessType(raw) === 'ecommerce'
}

export function businessTypeLabel(bt: BusinessType): string {
  return bt === 'leadgen' ? 'Lead Gen' : 'eCommerce'
}

/** UI registry keys for future Mission Control system console (column visibility, defaults). */
export const BUSINESS_TYPE_UI_REGISTRY = {
  heatedDrill: {
    leadgen: {
      hideRoas: true,
      hideRevenue: true,
      conversionLabel: 'Leads',
      cpaLabel: 'CPL',
    },
    ecommerce: {
      hideRoas: false,
      hideRevenue: false,
      conversionLabel: 'Conv.',
      cpaLabel: 'CPA',
    },
  },
} as const
