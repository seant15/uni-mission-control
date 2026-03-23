import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { db } from '../../lib/api'
import RuleBuilderModal from './RuleBuilderModal'
import type { AlertRule, AlertTemplateType, AlertSeverity } from '../../types/alerts'

const TEMPLATE_LABELS: Record<AlertTemplateType, string> = {
  spend_spike:              'Spend Spike (6h)',
  spend_dead_zone:          'Spend Dead Zone',
  ctr_cliff:                'CTR Cliff',
  impression_collapse:      'Impression Collapse',
  conversion_velocity_drop: 'Conversion Velocity Drop',
  zero_impressions_sustained: 'Zero Impressions',
  zero_spend:               'Zero Spend',
  budget_pacing:            'Budget Pacing',
  ctr_anomaly:              'CTR Anomaly',
  zero_conversions:         'Zero Conversions',
  custom:                   'Custom Rule',
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
}

interface RuleCardProps {
  rule: AlertRule
  onEdit: (rule: AlertRule) => void
  onDelete: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
}

function SortableRuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border-2 p-4 shadow-sm transition-all ${
        rule.is_active ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60'
      }`}
    >
      {/* Drag handle */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEVERITY_COLORS[rule.severity]}`}>
              {rule.severity}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {rule.platform === 'google_ads' ? 'Google' : rule.platform === 'meta_ads' ? 'Meta' : 'All'}
            </span>
            {!rule.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{rule.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{TEMPLATE_LABELS[rule.template_type] || rule.template_type}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onToggle(rule.id, !rule.is_active)}
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title={rule.is_active ? 'Deactivate' : 'Activate'}
        >
          {rule.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
        </button>
        <button
          onClick={() => onEdit(rule)}
          className="text-gray-400 hover:text-blue-600 transition-colors"
          title="Edit rule"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(rule.id)}
          className="text-gray-400 hover:text-red-500 transition-colors ml-auto"
          title="Delete rule"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

interface Props {
  currentUserId: string
}

export default function AlertRulesTab({ currentUserId }: Props) {
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingRule, setEditingRule]  = useState<AlertRule | undefined>()
  const queryClient = useQueryClient()

  const { data: rules, isLoading } = useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn:  () => db.getAlertRules(),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      db.updateAlertRule(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => db.deleteAlertRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => db.reorderAlertRules(orderedIds),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !rules) return
    const rulesList = rules as AlertRule[]
    const oldIndex = rulesList.findIndex((r: AlertRule) => r.id === active.id)
    const newIndex = rulesList.findIndex((r: AlertRule) => r.id === over.id)
    const reordered = arrayMove(rulesList, oldIndex, newIndex)
    // Optimistic update
    queryClient.setQueryData(['alert-rules'], reordered)
    reorderMutation.mutate(reordered.map((r: AlertRule) => r.id))
  }

  function handleEdit(rule: AlertRule) {
    setEditingRule(rule)
    setShowBuilder(true)
  }

  function handleClose() {
    setShowBuilder(false)
    setEditingRule(undefined)
  }

  if (isLoading) return (
    <div className="py-12 text-center text-gray-400">Loading rules…</div>
  )

  const sorted = [...((rules as AlertRule[]) ?? [])].sort((a: AlertRule, b: AlertRule) => a.display_order - b.display_order)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Alert Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {sorted.length} rule{sorted.length !== 1 ? 's' : ''} — drag to reorder
          </p>
        </div>
        <button
          onClick={() => { setEditingRule(undefined); setShowBuilder(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* Rule cards grid with drag-and-drop */}
      {sorted.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No rules yet. Create one to start monitoring.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(r => r.id)} strategy={horizontalListSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map(rule => (
                <SortableRuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={handleEdit}
                  onDelete={id => deleteMutation.mutate(id)}
                  onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Rule Builder Modal */}
      {showBuilder && (
        <RuleBuilderModal
          editRule={editingRule}
          currentUserId={currentUserId}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
