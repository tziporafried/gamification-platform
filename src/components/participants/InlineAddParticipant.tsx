import { useState, useRef, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'

interface InlineAddParticipantProps {
  eventId: string
  onAdded: () => void
  onPlanLimit?: () => void
  placeholder?: string
}

export function InlineAddParticipant({
  eventId,
  onAdded,
  onPlanLimit,
  placeholder = 'הקלד שם ולחץ Enter להוספה...',
}: InlineAddParticipantProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function addParticipant() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const { error } = await supabase
      .from('participants')
      .insert({ name: trimmed, event_id: eventId })

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      return
    }
    setName('')
    onAdded()
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addParticipant()
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
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none',
          saving && 'opacity-50',
        )}
        disabled={saving}
        autoFocus
      />
      {name.trim() && (
        <button
          onClick={addParticipant}
          disabled={saving}
          className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
        >
          הוסף
        </button>
      )}
    </div>
  )
}
