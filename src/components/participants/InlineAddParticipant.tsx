import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { parsePhone, phoneErrorLabel, PHONE_ERROR_LABELS } from '@/lib/phone'
import { isMissingPhoneColumnError, MISSING_PHONE_COLUMN_MESSAGE } from '@/lib/smsNotifications'
import type { Participant } from '@/types'

interface InlineAddParticipantProps {
  eventId: string
  onAdded: (participant: Participant) => void
  onPlanLimit?: () => void
  placeholder?: string
  nameInputRef?: React.RefObject<HTMLInputElement | null>
  /**
   * The game texts its participants, so a name alone is not enough: the phone
   * field appears beside it and nobody is added without a number we can send to.
   */
  collectPhone?: boolean
  onError?: (msg: string) => void
}

const SELECTED_COLUMNS = 'id, event_id, external_id, name, created_at, updated_at'

export function InlineAddParticipant({
  eventId,
  onAdded,
  onPlanLimit,
  placeholder = 'שם המשתתף...',
  nameInputRef,
  collectPhone = false,
  onError,
}: InlineAddParticipantProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [saving, setSaving] = useState(false)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = nameInputRef ?? internalInputRef
  const phoneRef = useRef<HTMLInputElement>(null)

  async function addParticipant() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    let e164: string | null = null
    if (collectPhone) {
      const parsed = parsePhone(phone)
      if (!parsed.e164) {
        setPhoneError(PHONE_ERROR_LABELS[parsed.error!])
        phoneRef.current?.focus()
        return
      }
      e164 = parsed.e164
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('participants')
      .insert(
        e164
          ? { name: trimmed, event_id: eventId, phone: e164 }
          : { name: trimmed, event_id: eventId },
      )
      .select(collectPhone ? `${SELECTED_COLUMNS}, phone` : SELECTED_COLUMNS)
      .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      else if (isMissingPhoneColumnError(error.message)) onError?.(MISSING_PHONE_COLUMN_MESSAGE)
      return
    }
    if (!data) return

    setName('')
    setPhone('')
    setPhoneError('')
    onAdded(data as unknown as Participant)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Enter on the name moves to the number rather than refusing to save for a
    // reason the typist has not been given a chance to fix yet.
    if (collectPhone && !phone.trim()) {
      phoneRef.current?.focus()
      return
    }
    addParticipant()
  }

  function handlePhoneKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    addParticipant()
  }

  const phoneField = collectPhone ? (
    <input
      ref={phoneRef}
      type="tel"
      inputMode="tel"
      dir="ltr"
      value={phone}
      onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
      onKeyDown={handlePhoneKeyDown}
      // Leaving the field empty is not yet a mistake - saving is where the
      // number becomes required. A number that is there but wrong says so now.
      onBlur={() => setPhoneError(phoneErrorLabel(phone))}
      placeholder="050-1234567"
      aria-label="מספר טלפון של המשתתף"
      aria-invalid={phoneError !== ''}
      disabled={saving}
      className={cn(
        'h-9 w-32 shrink-0 rounded-lg border bg-surface px-3 text-sm transition-colors',
        theme.text,
        theme.inputPlaceholder,
        theme.focusRing,
        phoneError ? 'border-danger' : 'border-border-strong focus:border-secondary-text',
        saving && 'opacity-50',
      )}
    />
  ) : undefined

  return (
    <div className="space-y-1">
      <InlineAddField
        value={name}
        onChange={setName}
        onKeyDown={handleNameKeyDown}
        placeholder={placeholder}
        disabled={saving}
        onSubmit={addParticipant}
        submitLabel="הוסף משתתף"
        inputRef={inputRef}
        trailing={phoneField}
        autoFocus
      />
      {phoneError && (
        <p role="alert" className="px-2 text-xs text-danger-text">{phoneError}</p>
      )}
    </div>
  )
}
