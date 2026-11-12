import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { InlineAddPointsTrailing } from '@/components/ui/InlineAddPointsTrailing'
import { isMissingSecretColumnsError, MISSING_SECRET_COLUMNS_MESSAGE } from '@/lib/tasks/secretMissionsFlag'
import { SecretOwnerPicker, type SecretOwnerOption } from './SecretOwnerPicker'
import type { Action } from '@/types'

interface InlineAddActionProps {
  eventId: string
  onAdded: (action: Action) => void
  onPlanLimit?: () => void
  existingNames?: string[]
  onFeedback?: (message: string, variant: 'success' | 'error') => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
  /**
   * The roster. When given, this field makes a secret mission: it asks whose,
   * and saves it once-only, tied to that participant.
   */
  secretOwners?: SecretOwnerOption[]
}

export function InlineAddAction({
  eventId,
  onAdded,
  onPlanLimit,
  existingNames = [],
  onFeedback,
  nameInputRef,
  secretOwners,
}: InlineAddActionProps) {
  const secret = secretOwners !== undefined
  const [ownerId, setOwnerId] = useState<string | null>(null)
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
    if (secret && !ownerId) {
      onFeedback?.('בחרו של מי המשימה הסודית', 'error')
      return
    }

    setSaving(true)
    const { data, error } = secret
      ? await supabase
          .from('actions')
          // Once only, always - see canPerformAction.
          .insert({
            name: trimmed, event_id: eventId, points: pointsNum,
            is_secret: true, secret_participant_id: ownerId, max_completions: 1,
          })
          .select('*')
          .single()
      : await supabase
          .from('actions')
          .insert({ name: trimmed, event_id: eventId, points: pointsNum })
          .select('id, event_id, code, name, points, description, is_active, max_completions, daily_limit, daily_start_hour, daily_start_minute, daily_end_hour, daily_end_minute, created_at, updated_at')
          .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      else if (isMissingSecretColumnsError(error.message)) onFeedback?.(MISSING_SECRET_COLUMNS_MESSAGE, 'error')
      return
    }
    if (!data) return

    setName('')
    setPoints('10')
    setOwnerId(null)
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
      placeholder={secret
        ? 'המשימה הסודית של...'
        : 'שם המשימה - לדוגמה: פתרון חידה, ביקור בתחנה...'}
      disabled={saving}
      onSubmit={addAction}
      submitLabel="הוסף"
      inputRef={nameRef}
      trailing={
        <>
          {secret && (
            <SecretOwnerPicker
              tone="field"
              ownerId={ownerId}
              participants={secretOwners}
              disabled={saving}
              onPick={setOwnerId}
            />
          )}
          <InlineAddPointsTrailing
            value={points}
            onChange={setPoints}
            onKeyDown={handlePointsKeyDown}
            inputRef={pointsRef}
            disabled={saving}
          />
        </>
      }
    />
  )
}
