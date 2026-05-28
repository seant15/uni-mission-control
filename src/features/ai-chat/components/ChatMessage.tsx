import type { ChatMessage as ChatMessageType } from '../types/chat'

interface Props {
  message: ChatMessageType
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-[var(--brand-600)] text-white'
            : 'bg-slate-700 text-slate-200'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-[var(--brand-600)] text-white rounded-tr-sm'
            : 'bg-white text-stone-800 border border-stone-200 rounded-tl-sm shadow-sm'
        }`}
      >
        {message.content}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-white/60 text-right' : 'text-stone-400'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
