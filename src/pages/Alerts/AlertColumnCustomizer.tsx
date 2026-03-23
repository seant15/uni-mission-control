import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Settings2 } from 'lucide-react'
import type { AlertColumnDef } from '../../types/alerts'

interface SortableItemProps {
  col: AlertColumnDef
  onToggle: (key: string) => void
}

function SortableItem({ col, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={col.visible}
          disabled={col.pinned}
          onChange={() => !col.pinned && onToggle(col.key)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className={`text-sm ${col.pinned ? 'text-gray-400' : 'text-gray-700'}`}>
          {col.label}
          {col.pinned && <span className="ml-1 text-xs text-gray-400">(always visible)</span>}
        </span>
      </label>
    </div>
  )
}

interface Props {
  columns: AlertColumnDef[]
  onChange: (columns: AlertColumnDef[]) => void
}

export default function AlertColumnCustomizer({ columns, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = columns.findIndex(c => c.key === active.id)
    const newIndex = columns.findIndex(c => c.key === over.id)
    onChange(arrayMove(columns, oldIndex, newIndex))
  }

  function handleToggle(key: string) {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        title="Customize columns"
      >
        <Settings2 size={14} /> Columns
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />

          {/* Popover */}
          <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-56 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Columns</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={columns.map(c => c.key)}
                strategy={verticalListSortingStrategy}
              >
                {columns.map(col => (
                  <SortableItem key={col.key} col={col} onToggle={handleToggle} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </>
      )}
    </div>
  )
}
