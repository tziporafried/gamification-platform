import { useState, useRef, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'

import type { Action } from '@/types'

type ActionCopyVariant = 'default' | 'wizard'

interface InlineAddActionProps {
  eventId: string
  onAdded: (action: Action) => void
  onPlanLimit?: () => void
  variant?: ActionCopyVariant
  existingNames?: string[]
  onFeedback?: (message: string, variant: 'success' | 'error') => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

export function InlineAddAction({
  eventId,
  onAdded,
  onPlanLimit,
  variant = 'default',
  existingNames = [],
  onFeedback,
  nameInputRef,
}: InlineAddActionProps) {
  const [name, setName] = useState('')
  const [points, setPoints] = useState('10')
  const [saving, setSaving] = useState(false)
  const internalNameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)
  const nameRef = nameInputRef ?? internalNameRef

  const isWizard = variant === 'wizard'
  const placeholder = 'שם המשימה...'
  const addLabel = isWizard ? 'הוסף פעילות' : 'הוסף'

  async function addAction() {
    const trimmed = name.trim()
    const pointsNum = parseInt(points, 10)
    if (saving) return

    if (!trimmed) {
      onFeedback?.('יש להזין שם לפעילות', 'error')
      return
    }
    if (isNaN(pointsNum)) {
      onFeedback?.('יש לבחור מספר נקודות', 'error')
      return
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      onFeedback?.('כבר קיימת פעילות בשם זה', 'error')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('actions')
      .insert({ name: trimmed, event_id: eventId, points: pointsNum })
      .select('id, event_id, code, name, points, description, is_active, max_completions, created_at, updated_at, time_enabled, start_at, end_at, duration_minutes, speed_bonus_enabled, speed_bonus_minutes, speed_bonus_flat_points, speed_multiplier')
      .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      return
    }
    if (!data) return

    setName('')
    setPoints('10')
    onAdded(data)
    setTimeout(() => nameRef.current?.focus(), 0)
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
        ref={nameRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleNameKeyDown}
        placeholder={placeholder}
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
          {addLabel}
        </button>
      )}
    </div>
  )
}
