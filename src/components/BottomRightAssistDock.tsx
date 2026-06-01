import FeedbackWidget from './FeedbackWidget'
import { AIChatWidget } from '../features/ai-chat'
import { useAuth } from '../contexts/AuthContext'
import { canAccessAIChat } from '../lib/rbac'

type Props = {
  showFeedback?: boolean
  showAIChat?: boolean
}

export default function BottomRightAssistDock({ showFeedback = true, showAIChat: showAIChatSetting = true }: Props) {
  const { appUser } = useAuth()
  const showAIChat = showAIChatSetting && canAccessAIChat(appUser?.role)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 items-end pointer-events-none">
      {showFeedback && (
        <div className="pointer-events-auto">
          <FeedbackWidget layout="dock" />
        </div>
      )}
      {showAIChat && (
        <div className="pointer-events-auto relative">
          <AIChatWidget />
        </div>
      )}
    </div>
  )
}
