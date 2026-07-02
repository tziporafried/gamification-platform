import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import type { Reward } from '@/types'

interface InlineAddRewardProps {
  eventId: string
  onAdded: (reward: Reward) => void
  onPlanLimit?: () => void
  existingNames?: string[]
  onFeedback?: (message: string, variant: 'success' | 'error') => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

export function InlineAddReward({
  eventId,
  onAdded,
  onPlanLimit,
  existingNames = [],
  onFeedback,
  nameInputRef,
}: InlineAddRewardProps) {
  const [name, setName] = useState('')
  const [points, setPoints] = useState('100')
  const [saving, setSaving] = useState(false)
  const internalNameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)
  const nameRef = nameInputRef ?? internalNameRef

  async function addReward() {
    const trimmed = name.trim()
    const pointsNum = parseInt(points, 10)
    if (saving) return

    if (!trimmed) {
      onFeedback?.('יש להזין שם לפרס', 'error')
      return
    }
    if (isNaN(pointsNum) || pointsNum <= 0) {
      onFeedback?.('יש לבחור מספר נקודות חיובי', 'error')
      return
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      onFeedback?.('כבר קיים פרס בשם זה', 'error')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        event_id: eventId,
        name: trimmed,
        required_points: pointsNum,
      })
      .select('id, event_id, name, required_points, is_active, created_at, updated_at')
      .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      else onFeedback?.(error.message, 'error')
      return
    }
    if (!data) return

    setName('')
    setPoints('100')
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
      addReward()
    }
  }

  return (
    <InlineAddField
      value={name}
      onChange={setName}
      onKeyDown={handleNameKeyDown}
      placeholder="שם הפרס..."
      disabled={saving}
      onSubmit={addReward}
      submitLabel="הוסף פרס"
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
