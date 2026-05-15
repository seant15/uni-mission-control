import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const META_BREAKDOWNS: Array<{ dimension: string; breakdown: string }> = [
  { dimension: 'device', breakdown: 'device_platform' },
  { dimension: 'age', breakdown: 'age' },
  { dimension: 'gender', breakdown: 'gender' },
  { dimension: 'demographic', breakdown: 'age,gender' },
]

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(`${start}T12:00:00.000Z`)
  const last = new Date(`${end}T12:00:00.000Z`)
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function breakdownValue(dimension: string, row: Record<string, string | undefined>): string {
  if (dimension === 'device') return String(row.device_platform || 'unknown').slice(0, 120)
  if (dimension === 'age') return String(row.age || 'unknown').slice(0, 120)
  if (dimension === 'gender') return String(row.gender || 'unknown').slice(0, 120)
  return `${row.age || 'unknown'} · ${row.gender || 'unknown'}`.slice(0, 120)
}

function pickConversions(actions: Array<{ action_type?: string; value?: string }> | undefined, event: string, backups: string[]) {
  const list = actions || []
  const tryEvent = (ev: string) => {
    const hit = list.find(a => a.action_type === ev)
    return hit ? Number(hit.value) || 0 : 0
  }
  let conversions = tryEvent(event)
  if (conversions === 0) {
    for (const b of backups) {
      conversions = tryEvent(b)
      if (conversions > 0) break
    }
  }
  let revenue = 0
  const purchaseVal = list.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
  if (purchaseVal) revenue = Number(purchaseVal.value) || 0
  return { conversions, revenue }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const metaToken = process.env.META_ADS_ACCESS_TOKEN
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return res.status(500).json({ error: 'Server missing Supabase env' })
  }
  if (!metaToken) {
    return res.status(503).json({ error: 'META_ADS_ACCESS_TOKEN not configured on server' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' })
  }
  const jwt = authHeader.slice(7)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  const { startDate, endDate, clientId } = (req.body || {}) as {
    startDate?: string
    endDate?: string
    clientId?: string
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' })
  }

  const days = enumerateDays(startDate, endDate)
  if (days.length > 31) {
    return res.status(400).json({ error: 'Max 31 days per sync request' })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  let cq = admin
    .from('clients')
    .select('id, name, meta_ad_account_id, meta_ad_account_id_2, meta_ads_conversion, meta_ads_conversion_backup, status')
    .in('status', ['active', 'Active', 'ACTIVE'])
  if (clientId && clientId !== 'all') cq = cq.eq('id', clientId)
  const { data: clients, error: cErr } = await cq
  if (cErr) return res.status(500).json({ error: cErr.message })

  let rowsWritten = 0
  for (const client of clients || []) {
    const conv = (client.meta_ads_conversion as string) || 'purchase'
    const backup = (client.meta_ads_conversion_backup as string[]) || []
    const accounts = [client.meta_ad_account_id, client.meta_ad_account_id_2].filter(Boolean) as string[]

    for (const actId of accounts) {
      const cleanAct = String(actId).startsWith('act_') ? String(actId) : `act_${actId}`
      for (const day of days) {
        for (const { dimension, breakdown } of META_BREAKDOWNS) {
          const url = new URL(`https://graph.facebook.com/v19.0/${cleanAct}/insights`)
          url.searchParams.set('access_token', metaToken)
          url.searchParams.set('time_range', JSON.stringify({ since: day, until: day }))
          url.searchParams.set('fields', 'spend,impressions,clicks,actions,action_values')
          url.searchParams.set('level', 'account')
          url.searchParams.set('breakdowns', breakdown)
          url.searchParams.set('limit', '500')

          const apiRes = await fetch(url.toString())
          if (!apiRes.ok) continue
          const json = (await apiRes.json()) as { data?: Array<Record<string, unknown>> }
          const payload: Record<string, unknown>[] = []
          for (const e of json.data || []) {
            const spend = Number(e.spend) || 0
            const impressions = Number(e.impressions) || 0
            if (spend === 0 && impressions === 0) continue
            const { conversions, revenue } = pickConversions(
              e.actions as Array<{ action_type?: string; value?: string }>,
              conv,
              backup,
            )
            const pseudo: Record<string, string | undefined> = {
              device_platform: e.device_platform as string | undefined,
              age: e.age as string | undefined,
              gender: e.gender as string | undefined,
            }
            payload.push({
              client_id: client.id,
              date: day,
              platform: 'meta_ads',
              ad_account_id: String(actId),
              dimension,
              dimension_value: breakdownValue(dimension, pseudo),
              cost: spend,
              revenue,
              impressions,
              clicks: Number(e.clicks) || 0,
              conversions,
            })
          }
          if (payload.length === 0) continue
          const { error: upErr } = await admin.from('daily_performance_breakdown').upsert(payload, {
            onConflict: 'client_id,date,platform,ad_account_id,dimension,dimension_value',
          })
          if (!upErr) rowsWritten += payload.length
        }
      }
    }
  }

  return res.status(200).json({
    ok: true,
    rows: rowsWritten,
    message: `Synced Meta breakdowns for ${days.length} day(s), ${(clients || []).length} client(s)`,
  })
}
