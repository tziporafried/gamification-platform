import { useState, useRef, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'

interface InlineAddActionProps {
  eventId: string
  onAdded: () => void
  onPlanLimit?: () => void
}

export function InlineAddAction({ eventId, onAdded, onPlanLimit }: InlineAddActionProps) {
  const [name, setName] = useState('')
  const [points, setPoints] = useState('10')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  async function addAction() {
    const trimmed = name.trim()
    const pointsNum = parseInt(points, 10)
    if (!trimmed || isNaN(pointsNum) || saving) return

    setSaving(true)
    const { error } = await supabase
      .from('actions')
      .insert({ name: trimmed, event_id: eventId, points: pointsNum })

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      return
    }
    setName('')
    setPoints('10')
    onAdded()
    nameRef.current?.focus()
  }

  function handleNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      pointsRef.current?.focus()
      pointsRef.current?.select()
    }
  }

  function handlePointsKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAction()
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-game-border bg-game-card/50 p-3 transition-colors focus-within:border-brand-500/50">
      <Plus size={18} className="shrink-0 text-gray-500" />
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleNameKeyDown}
        placeholder="שם המשימה..."
        className={cn(
          'flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none',
          saving && 'opacity-50',
        )}
        disabled={saving}
      />
      <input
        ref={pointsRef}
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        onKeyDown={handlePointsKeyDown}
        placeholder="נק׳"
        className={cn(
          'w-16 bg-transparent text-sm text-center text-emerald-400 font-bold placeholder-gray-500 outline-none border-b border-game-border focus:border-brand-500',
          saving && 'opacity-50',
        )}
        disabled={saving}
      />
      {name.trim() && (
        <button
          onClick={addAction}
          disabled={saving}
          className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
        >
          הוסף
        </button>
      )}
    </div>
  )
}
