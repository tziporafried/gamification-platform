import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import type { Participant } from '@/types'

interface InlineAddParticipantProps {
  eventId: string
  onAdded: (participant: Participant) => void
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
    const { data, error } = await supabase
      .from('participants')
      .insert({ name: trimmed, event_id: eventId })
      .select('id, event_id, external_id, name, created_at, updated_at')
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
      addParticipant()
    }
  }

  return (
    <InlineAddField
      value={name}
      onChange={setName}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={saving}
      onSubmit={addParticipant}
      inputRef={inputRef}
      autoFocus
    />
  )
}
