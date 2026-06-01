import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are an AI assistant embedded in UNI Mission Control, a marketing performance dashboard for UNI Marketing Agency. You help internal marketing team members with:
- SEO content creation and optimisation
- Team QA reviews of marketing content
- Brand strategy workshops
- Brand design direction

Be direct, concise, and actionable. Use bullet points over long paragraphs. Respond in the same language the user writes in. When the user provides a template with [BRACKETED PLACEHOLDERS], help them fill it out or ask for the missing information.

## Mission Control performance data
When a [LIVE DASHBOARD DATA] block is included in the system context, you have read-only warehouse metrics for the named client(s). Use those numbers directly in your answer. Do not claim you lack live dashboard access when that block is present.
If the user asks for account performance but no live block is provided, ask for the exact client name as shown in Mission Control (or suggest they rephrase with the client name).

## SEO Content Quality Standards (Google 2026 Algorithm)

Apply these rules to ALL SEO content you generate or review. Google does not penalise AI-generated content by origin — it penalises low quality, missing expertise signals, and manipulation intent.

### E-E-A-T Requirements (enforce in every piece)
- **Experience**: Include at least one first-hand signal — a specific client result, a test finding, a named case study, or a concrete data point from real work. Never use vague phrases like "many experts believe" or "studies show".
- **Expertise**: Go beyond surface coverage. Include nuanced points, edge cases, and accurate terminology that demonstrates domain knowledge.
- **Authoritativeness**: Reference authoritative sources by name (specific studies, named publications, official documentation). Include outbound links to .gov/.edu/industry leaders where relevant.
- **Trustworthiness**: Every statistic must be sourced and dated. No exaggerated claims. No unqualified medical, financial, or legal advice.

### On-Page SEO Rules (enforce every time)
- H1: ≤7 words. Primary keyword in first 3 words. Statement or question — never generic.
- H2s: Include secondary keyword. Max 60 chars. Descriptive, not clever.
- Meta title: 50–60 chars. Primary keyword first. Brand name last.
- Meta description: 140–160 chars. Primary keyword in first sentence. One clear CTA.
- URL slug: Primary keyword only, hyphens, no stop words, max 5 words.
- First paragraph: Primary keyword in first 100 characters of body text.
- Word count by intent: informational/how-to = 1,200–2,000 words; comparison = 800–1,500; local SEO = 600–1,000.

### LLM Fingerprint Rules (avoid in all output)
- Never start paragraphs with "Furthermore," "Moreover," "Additionally," "In conclusion,"
- Never use hedge stacks: "It's important to note that…" / "It's worth mentioning…" — state directly
- Never write symmetrical bullet lists where every item is the same length and structure
- Never use generic openers: "In today's digital landscape…" / "In this comprehensive guide…"
- Never end with wishy-washy balanced takes — take a clear position
- Vary sentence structure and paragraph length. One idea per section.

### Publishing Velocity (warn when relevant)
- Safe batch limit: 10–15 articles/month for solo editor pipelines
- Minimum 4 hours between live publishes on the same domain
- Never publish near-duplicate articles targeting the same keyword — consolidate into one pillar page instead

### QA Verdict Format (when running seo_content_qa workflow)
Return a structured report:
- Score each of 5 layers: E-E-A-T / Fact-Check / LLM Fingerprint / Velocity-Spam / Technical SEO (each 0–10)
- Overall score out of 50 with percentage
- Verdict: APPROVED (≥90%) / CONDITIONAL (76–89%) / NEEDS WORK (60–75%) / BLOCKED (<60%)
- Required fixes list with [L1]/[L2] etc. prefixes
- Edited draft with fixes applied inline; unresolvable human-only items marked [ACTION NEEDED: description]
- Auto-block triggers regardless of score: hallucinated facts, zero Experience signals, YMYL content with no author credentials`

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  conversationId: string
  messages: ApiMessage[]
}

const CLIENT_ROLES = new Set(['client', 'client_user'])

function isInternalTeamRole(role: string | null | undefined): boolean {
  return !!role && !CLIENT_ROLES.has(role)
}

function parseRequestBody(req: VercelRequest): RequestBody {
  const raw = req.body
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RequestBody
    } catch {
      return { conversationId: '', messages: [] }
    }
  }
  return (raw ?? { conversationId: '', messages: [] }) as RequestBody
}

// --- Performance context (inlined: Vercel api/*.ts does not bundle sibling imports reliably) ---

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

const ACTIVE_CLIENT_STATUSES = ['active', 'Active', 'ACTIVE']

function phoenixYmd(daysAgo = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(d)
}

function normalizeClientName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim()
}

function perfNum(v: number | string | null | undefined): number {
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
  const msgNorm = normalizeClientName(message)
  const hits: { client: ClientRow; score: number }[] = []

  for (const c of clients) {
    const name = c.name.trim()
    if (!name) continue
    const nameLower = name.toLowerCase()
    const nameNorm = normalizeClientName(name)
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
    const c = perfNum(r.cost)
    const rev = perfNum(r.revenue)
    const conv = perfNum(r.conversions)
    cost += c
    revenue += rev
    conversions += conv
    impressions += perfNum(r.impressions)
    clicks += perfNum(r.clicks)
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

async function buildChatPerformanceContext(
  userClient: SupabaseClient,
  userMessage: string
): Promise<string> {
  if (!looksLikePerformanceQuestion(userMessage)) return ''

  const { data: clients, error: clientsErr } = await userClient
    .from('clients')
    .select('id, name')
    .in('status', ACTIVE_CLIENT_STATUSES)
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

  const targets = matched.length > 0 ? matched : (clients as ClientRow[]).slice(0, 5)

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Server missing Supabase env' })
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

  const { data: appUser, error: appUserErr } = await userClient
    .from('app_users')
    .select('role, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (appUserErr || !appUser?.is_active || !isInternalTeamRole(appUser.role)) {
    return res.status(403).json({ error: 'AI chat is available to internal team members only' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' })
  }

  const { conversationId, messages } = parseRequestBody(req)

  if (!conversationId || !messages?.length) {
    return res.status(400).json({ error: 'conversationId and messages are required' })
  }

  const { data: conversation, error: convErr } = await userClient
    .from('ai_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr || !conversation || conversation.user_id !== userData.user.id) {
    return res.status(403).json({ error: 'Conversation not found' })
  }

  const validMessages = messages.filter(
    m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
  )

  if (!validMessages.length) {
    return res.status(400).json({ error: 'No valid messages provided' })
  }

  const model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash'

  const lastUserMessage =
    [...validMessages].reverse().find(m => m.role === 'user')?.content?.trim() ?? ''
  let dataContext = ''
  try {
    dataContext = await buildChatPerformanceContext(userClient, lastUserMessage)
  } catch (e) {
    console.warn('chat: performance context failed', e)
  }

  const systemContent = dataContext
    ? `${SYSTEM_PROMPT}\n\n---\n${dataContext}`
    : SYSTEM_PROMPT

  const openAiMessages = [
    { role: 'system', content: systemContent },
    ...validMessages,
  ]

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://uni-mission-control.vercel.app',
        'X-Title': 'UNI Mission Control',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: openAiMessages,
      }),
    })

    if (!orRes.ok) {
      const errText = await orRes.text()
      console.error('OpenRouter error:', orRes.status, errText)
      return res.status(502).json({ error: 'AI service error' })
    }

    const orData = await orRes.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const content = orData.choices?.[0]?.message?.content ?? ''

    // Save assistant message server-side using service role key (bypasses RLS)
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content,
        metadata: { model },
      })
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    } else {
      console.warn('chat: SUPABASE_SERVICE_ROLE_KEY or Supabase URL missing — assistant reply not persisted')
    }

    return res.status(200).json({ content })
  } catch (e) {
    console.error('chat handler error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
