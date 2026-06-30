import { useState, useRef, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'
import type { Group } from '@/types'

interface InlineAddGroupProps {
  eventId: string
  onAdded: (group: Group) => void
  onPlanLimit?: () => void
}

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

export function InlineAddGroup({ eventId, onAdded, onPlanLimit }: InlineAddGroupProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function getRandomColor() {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  }

  async function addGroup() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: trimmed, event_id: eventId, color: getRandomColor() })
      .select('id, event_id, name, color, created_at, updated_at')
      .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      return
    }
    if (!data) return

    setName('')
    onAdded(data)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addGroup()
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-game-border bg-game-card/50 p-3 transition-colors focus-within:border-brand-500/50">
      <Plus size={18} className="shrink-0 text-gray-500" />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="הקלד שם קבוצה ולחץ Enter..."
        className={cn(
          'flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none',
          saving && 'opacity-50',
        )}
        disabled={saving}
      />
      {name.trim() && (
        <button
          onClick={addGroup}
          disabled={saving}
          className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
        >
          הוסף
        </button>
      )}
    </div>
  )
}
