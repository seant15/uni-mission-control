import type { SupabaseClient } from '@supabase/supabase-js'

type ClientRow = { id: string; name: string }
type PerfRow = {
  date: string
  platform: string | null
  cost: number | string | null
  revenue: number | string | null
  conversions: number | string | null
  impressions: number | string | null
  clicks: number | string | null
}

const ACTIVE_STATUSES = ['active', 'Active', 'ACTIVE']

function phoenixYmd(daysAgo = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(d)
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

function num(v: number | string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function looksLikePerformanceQuestion(text: string): boolean {
  return /\b(how'?s|how is|doing|performance|spend|spent|roas|revenue|conversions?|cpa|cpc|ctr|week|weekly|mtd|yesterday|today)\b/i.test(
    text
  )
}

function matchClientsFromMessage(message: string, clients: ClientRow[]): ClientRow[] {
  const msg = message.toLowerCase()
  const msgNorm = normalizeName(message)
  const hits: { client: ClientRow; score: number }[] = []

  for (const c of clients) {
    const name = c.name.trim()
    if (!name) continue
    const nameLower = name.toLowerCase()
    const nameNorm = normalizeName(name)
    let score = 0
    if (msg.includes(nameLower)) score = name.length + 10
    else if (nameNorm.length >= 2 && msgNorm.includes(nameNorm)) score = nameNorm.length + 5
    else {
      const tokens = nameLower.split(/[\s/+_-]+/).filter(t => t.length >= 2)
      for (const t of tokens) {
        if (msg.includes(t)) score = Math.max(score, t.length)
      }
    }
    if (score > 0) hits.push({ client: c, score })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 3).map(h => h.client)
}

function summarizePerfRows(rows: PerfRow[]): string {
  let cost = 0
  let revenue = 0
  let conversions = 0
  let impressions = 0
  let clicks = 0
  const byPlatform = new Map<string, { cost: number; revenue: number; conversions: number }>()

  for (const r of rows) {
    const c = num(r.cost)
    const rev = num(r.revenue)
    const conv = num(r.conversions)
    cost += c
    revenue += rev
    conversions += conv
    impressions += num(r.impressions)
    clicks += num(r.clicks)
    const plat = (r.platform || 'unknown').toString()
    const e = byPlatform.get(plat) ?? { cost: 0, revenue: 0, conversions: 0 }
    e.cost += c
    e.revenue += rev
    e.conversions += conv
    byPlatform.set(plat, e)
  }

  const roas = cost > 0 ? revenue / cost : 0
  const lines = [
    `Total spend: $${cost.toFixed(2)}`,
    `Revenue (ads-attributed): $${revenue.toFixed(2)}`,
    `ROAS: ${roas.toFixed(2)}`,
    `Conversions: ${conversions.toFixed(0)}`,
    `Impressions: ${impressions.toFixed(0)}`,
    `Clicks: ${clicks.toFixed(0)}`,
  ]

  if (byPlatform.size > 0) {
    lines.push('By platform:')
    for (const [plat, v] of [...byPlatform.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
      const pRoas = v.cost > 0 ? v.revenue / v.cost : 0
      lines.push(
        `  - ${plat}: spend $${v.cost.toFixed(2)}, revenue $${v.revenue.toFixed(2)}, ROAS ${pRoas.toFixed(2)}, conv ${v.conversions.toFixed(0)}`
      )
    }
  }

  return lines.join('\n')
}

async function fetchWeekPerf(
  userClient: SupabaseClient,
  clientId: string,
  startDate: string,
  endDate: string
): Promise<PerfRow[]> {
  const { data, error } = await userClient
    .from('daily_performance')
    .select('date, platform, cost, revenue, conversions, impressions, clicks')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(5000)

  if (error) {
    console.warn('chat context: daily_performance', error.message)
    return []
  }
  return (data ?? []) as PerfRow[]
}

export async function buildChatPerformanceContext(
  userClient: SupabaseClient,
  userMessage: string
): Promise<string> {
  if (!looksLikePerformanceQuestion(userMessage)) return ''

  const { data: clients, error: clientsErr } = await userClient
    .from('clients')
    .select('id, name')
    .in('status', ACTIVE_STATUSES)
    .order('name')

  if (clientsErr || !clients?.length) return ''

  const endDate = phoenixYmd(0)
  const startDate = phoenixYmd(6)
  const matched = matchClientsFromMessage(userMessage, clients as ClientRow[])

  const blocks: string[] = [
    '[LIVE DASHBOARD DATA — Mission Control warehouse, America/Phoenix calendar week]',
    `Date range: ${startDate} through ${endDate} (inclusive, 7 days).`,
    'Use these figures in your answer; do not say you lack live dashboard access when this block is present.',
  ]

  const targets =
    matched.length > 0
      ? matched
      : looksLikePerformanceQuestion(userMessage)
        ? (clients as ClientRow[]).slice(0, 5)
        : []

  if (targets.length === 0) {
    blocks.push(
      'No client name matched. Ask the user which client account they mean (exact name as in Mission Control).'
    )
    return blocks.join('\n')
  }

  for (const client of targets) {
    const rows = await fetchWeekPerf(userClient, client.id, startDate, endDate)
    if (!rows.length) {
      blocks.push(`\n### ${client.name}\nNo daily_performance rows in this date range (sync may be delayed).`)
      continue
    }
    blocks.push(`\n### ${client.name}\n${summarizePerfRows(rows)}`)
  }

  if (!matched.length) {
    blocks.push(
      '\nNote: Client name was not detected in the message; showing a short list of active accounts. Ask for a specific client if needed.'
    )
  }

  return blocks.join('\n')
}
