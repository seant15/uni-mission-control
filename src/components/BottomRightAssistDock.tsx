import OpenClawChatWidget from './OpenClawChatWidget'
import FeedbackWidget from './FeedbackWidget'

/**
 * OpenClaw sits above the Feedback pill (stacked bottom-right).
 */
export default function BottomRightAssistDock() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 items-end pointer-events-none">
      <div className="pointer-events-auto">
        <FeedbackWidget layout="dock" />
      </div>
      <div className="pointer-events-auto">
        <OpenClawChatWidget layout="dock" />
      </div>
    </div>
  )
}
