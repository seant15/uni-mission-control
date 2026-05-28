import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, User, ChevronRight, Bot, Clock, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Conversation, ChatMessage } from '../features/ai-chat/types/chat'

const WORKFLOW_LABELS: Record<string, string> = {
  seo_content:    'SEO Content',
  qa_review:      'QA Review',
  brand_workshop: 'Brand Workshop',
  brand_design:   'Brand Design',
}

async function fetchConversations(): Promise<Conversation[]> {
  // Fetch conversations joined with app_users for display names
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`
      *,
      app_users!inner (
        display_name,
        email,
        role
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    user_display_name: row.app_users?.display_name ?? 'Unknown',
    user_email: row.app_users?.email ?? '',
    user_role: row.app_users?.role ?? '',
  })) as Conversation[]
}

async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${isUser ? 'bg-[var(--brand-600)] text-white' : 'bg-slate-700 text-slate-200'}`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${isUser ? 'bg-[var(--brand-600)] text-white rounded-tr-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm'}`}>
        {msg.content}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-white/60 text-right' : 'text-stone-400'}`}>
          {new Date(msg.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          {msg.action_type && <span className="ml-2 opacity-70">[{WORKFLOW_LABELS[msg.action_type] ?? msg.action_type}]</span>}
        </div>
      </div>
    </div>
  )
}

export default function AIChatAdmin() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const {
    data: conversations = [],
    isLoading: convLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['ai-chat-admin-conversations'],
    queryFn: fetchConversations,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ['ai-chat-admin-messages', selectedId],
    queryFn: () => fetchMessages(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 8_000,
    staleTime: 5_000,
  })

  // Realtime: refresh conversation list on new messages
  useEffect(() => {
    const channel = supabase
      .channel('ai-admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_conversations' }, () => void refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_messages' }, () => void refetch())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [refetch])

  const selected = conversations.find(c => c.id === selectedId)
  return (
    <div className="flex h-[calc(100vh-10rem)] gap-0 rounded-xl overflow-hidden border border-stone-200 shadow-sm bg-white">
      {/* Sidebar: conversation list */}
      <aside className="w-72 flex-shrink-0 border-r border-stone-200 flex flex-col">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--brand-600)]" />
          <h2 className="font-semibold text-sm text-stone-900 flex-1">All Conversations</h2>
          <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">{conversations.length}</span>
          <button
            onClick={() => void refetch()}
            title="Refresh"
            className="p-1 text-stone-400 hover:text-stone-700 transition rounded"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {convLoading ? (
          <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-stone-400 p-6 text-center">
            <MessageSquare size={28} className="opacity-30" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-stone-100">
            {conversations.map(conv => (
              <li key={conv.id}>
                <button
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition flex items-start gap-3 ${selectedId === conv.id ? 'bg-[var(--brand-50,#fff7ed)] border-l-2 border-[var(--brand-500,#f97316)]' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={13} className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-stone-800 truncate">{conv.user_display_name}</span>
                      {conv.user_role && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 capitalize flex-shrink-0">
                          {conv.user_role.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 truncate">{conv.title ?? 'Untitled conversation'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {conv.workflow_type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--brand-100,#ffedd5)] text-[var(--brand-700,#c2410c)]">
                          {WORKFLOW_LABELS[conv.workflow_type] ?? conv.workflow_type}
                        </span>
                      )}
                      <span className="text-[9px] text-stone-400 flex items-center gap-0.5">
                        <Clock size={9} />
                        {new Date(conv.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-stone-300 flex-shrink-0 mt-1" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="px-4 py-2 border-t border-stone-100 text-[10px] text-stone-400">
          Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'} · Auto-refresh 15s
        </div>
      </aside>

      {/* Main: message thread */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-400">
            <MessageSquare size={40} className="opacity-20" />
            <p className="text-sm">Select a conversation to view</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-6 py-3 border-b border-stone-200 flex items-center gap-3 bg-stone-50">
              <div>
                <p className="text-sm font-semibold text-stone-800">{selected?.user_display_name}</p>
                <p className="text-xs text-stone-500">{selected?.user_email}</p>
              </div>
              {selected?.workflow_type && (
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--brand-100,#ffedd5)] text-[var(--brand-700,#c2410c)] font-medium">
                  {WORKFLOW_LABELS[selected.workflow_type] ?? selected.workflow_type}
                </span>
              )}
              <span className="ml-auto text-xs text-stone-400">
                Started {selected ? new Date(selected.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-stone-50">
              {msgLoading ? (
                <div className="flex justify-center py-10 text-stone-400 text-sm">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center py-10 text-stone-400 text-sm">No messages yet</div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </div>

            <div className="px-6 py-2 border-t border-stone-100 text-xs text-stone-400 bg-white">
              {messages.length} message{messages.length !== 1 ? 's' : ''} · Read-only admin view
            </div>
          </>
        )}
      </main>
    </div>
  )
}
