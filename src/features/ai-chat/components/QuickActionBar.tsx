import { WORKFLOW_TEMPLATES } from '../workflows/templates'
import type { WorkflowType } from '../types/chat'

interface Props {
  onSelect: (template: string, workflowType: WorkflowType) => void
  disabled?: boolean
}

const ICONS: Record<WorkflowType, string> = {
  seo_content:     '🔍',
  seo_content_qa:  '🛡️',
  qa_review:       '✅',
  brand_workshop:  '🎯',
  brand_design:    '🎨',
}

export function QuickActionBar({ onSelect, disabled }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 px-3 pt-2 scrollbar-none flex-shrink-0">
      {WORKFLOW_TEMPLATES.map(tpl => (
        <button
          key={tpl.id}
          onClick={() => onSelect(tpl.template, tpl.id)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-stone-100 text-stone-700 hover:bg-[var(--brand-100)] hover:text-[var(--brand-700)] border border-stone-200 hover:border-[var(--brand-300)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <span>{ICONS[tpl.id]}</span>
          {tpl.label}
        </button>
      ))}
    </div>
  )
}
