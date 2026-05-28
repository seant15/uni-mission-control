import FeedbackWidget from './FeedbackWidget'
import { AIChatWidget } from '../features/ai-chat'

type Props = {
  showFeedback?: boolean
}

export default function BottomRightAssistDock({ showFeedback = true }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 items-end pointer-events-none">
      {showFeedback && (
        <div className="pointer-events-auto">
          <FeedbackWidget layout="dock" />
        </div>
      )}
      <div className="pointer-events-auto relative">
        <AIChatWidget />
      </div>
    </div>
  )
}
