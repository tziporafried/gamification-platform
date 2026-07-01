import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import type { Action } from '@/types'

interface InlineAddActionProps {
  eventId: string
  onAdded: (action: Action) => void
  onPlanLimit?: () => void
  existingNames?: string[]
  onFeedback?: (message: string, variant: 'success' | 'error') => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

export function InlineAddAction({
  eventId,
  onAdded,
  onPlanLimit,
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
    <InlineAddField
      value={name}
      onChange={setName}
      onKeyDown={handleNameKeyDown}
      placeholder="שם המשימה..."
      disabled={saving}
      onSubmit={addAction}
      submitLabel="הוסף פעילות"
      inputRef={nameRef}
      trailing={
        <input
          ref={pointsRef}
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          onKeyDown={handlePointsKeyDown}
          placeholder="נק׳"
          className={cn(
            'w-16 bg-transparent text-sm text-center text-success font-bold outline-none border-b border-border focus:border-secondary placeholder-muted',
            saving && 'opacity-50',
          )}
          disabled={saving}
        />
      }
    />
  )
}
