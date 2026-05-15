import FeedbackWidget from './FeedbackWidget'

type Props = {
  showFeedback?: boolean
}

/** Bottom-right Feedback launcher only (OpenClaw embed removed). */
export default function BottomRightAssistDock({ showFeedback = true }: Props) {
  if (!showFeedback) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 items-end pointer-events-none">
      <div className="pointer-events-auto">
        <FeedbackWidget layout="dock" />
      </div>
    </div>
  )
}
