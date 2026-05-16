/** Turn PostgREST / Supabase errors into human-readable strings (never "[object Object]"). */
export function formatSupabaseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [o.message, o.details, o.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(' — ')
    if (o.code) return `Database error (${o.code})`
  }
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}
