import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are an AI assistant embedded in UNI Mission Control, a marketing performance dashboard for UNI Marketing Agency. You help marketing team members and clients with:
- SEO content creation and optimisation
- Team QA reviews of marketing content
- Brand strategy workshops
- Brand design direction

Be direct, concise, and actionable. Use bullet points over long paragraphs. Respond in the same language the user writes in. When the user provides a template with [BRACKETED PLACEHOLDERS], help them fill it out or ask for the missing information.`

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  conversationId: string
  messages: ApiMessage[]
  assistantContent?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' })
  }

  const { conversationId, messages } = req.body as RequestBody

  if (!conversationId || !messages?.length) {
    return res.status(400).json({ error: 'conversationId and messages are required' })
  }

  const validMessages = messages.filter(
    m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
  )

  if (!validMessages.length) {
    return res.status(400).json({ error: 'No valid messages provided' })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: validMessages,
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, errText)
      return res.status(502).json({ error: 'AI service error' })
    }

    const anthropicData = await anthropicRes.json() as {
      content: Array<{ type: string; text: string }>
    }

    const content = anthropicData.content.find(b => b.type === 'text')?.text ?? ''

    // Save assistant message server-side using service role key (bypasses RLS)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content,
      })
      // Bump updated_at on conversation
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return res.status(200).json({ content })
  } catch (e) {
    console.error('chat handler error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
