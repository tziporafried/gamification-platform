import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { InlineAddPointsTrailing } from '@/components/ui/InlineAddPointsTrailing'
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
      .select('id, event_id, code, name, points, description, is_active, max_completions, daily_limit, daily_start_hour, daily_start_minute, daily_end_hour, daily_end_minute, created_at, updated_at')
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
      placeholder="שם המשימה - לדוגמה: פתרון חידה, ביקור בתחנה..."
      disabled={saving}
      onSubmit={addAction}
      submitLabel="הוסף פעילות"
      inputRef={nameRef}
      trailing={
        <InlineAddPointsTrailing
          value={points}
          onChange={setPoints}
          onKeyDown={handlePointsKeyDown}
          inputRef={pointsRef}
          disabled={saving}
        />
      }
    />
  )
}
