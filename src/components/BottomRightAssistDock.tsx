import OpenClawChatWidget from './OpenClawChatWidget'
import FeedbackWidget from './FeedbackWidget'

type Props = {
  showOpenclaw?: boolean
  showFeedback?: boolean
}

/**
 * OpenClaw sits above the Feedback pill (stacked bottom-right).
 * Visibility is org-controlled from Settings (super_admin) via `default_user` dashboard_settings.
 */
export default function BottomRightAssistDock({ showOpenclaw = true, showFeedback = true }: Props) {
  if (!showOpenclaw && !showFeedback) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 items-end pointer-events-none">
      {showFeedback && (
        <div className="pointer-events-auto">
          <FeedbackWidget layout="dock" />
        </div>
      )}
      {showOpenclaw && (
        <div className="pointer-events-auto">
          <OpenClawChatWidget layout="dock" />
        </div>
      )}
    </div>
  )
}
