/** In-memory agency filter for active-client queries (invalidated when agency changes). */

let scopedAgencyId: string | null = null
let activeClientIdsCache: { ids: string[]; agencyId: string | null; at: number } | null = null

const CACHE_MS = 45_000

export function getScopedAgencyId(): string | null {
  return scopedAgencyId
}

export function setScopedAgencyId(agencyId: string | null) {
  scopedAgencyId = agencyId
  activeClientIdsCache = null
}

export function peekActiveClientIdsCache(): string[] | null {
  if (!activeClientIdsCache) return null
  if (Date.now() - activeClientIdsCache.at >= CACHE_MS) return null
  if (activeClientIdsCache.agencyId !== scopedAgencyId) return null
  return activeClientIdsCache.ids
}

export function storeActiveClientIdsCache(ids: string[]) {
  activeClientIdsCache = { ids, agencyId: scopedAgencyId, at: Date.now() }
}
