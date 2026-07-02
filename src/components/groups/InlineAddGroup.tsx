import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { getNextPresetColor } from '@/lib/paletteColors'
import type { Group } from '@/types'

interface InlineAddGroupProps {
  eventId: string
  usedColors?: string[]
  onAdded: (group: Group) => void
  onPlanLimit?: () => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

export function InlineAddGroup({ eventId, usedColors = [], onAdded, onPlanLimit, nameInputRef }: InlineAddGroupProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = nameInputRef ?? internalInputRef

  async function addGroup() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: trimmed, event_id: eventId, color: getNextPresetColor(usedColors) })
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
    <InlineAddField
      value={name}
      onChange={setName}
      onKeyDown={handleKeyDown}
      placeholder="שם הקבוצה..."
      disabled={saving}
      onSubmit={addGroup}
      submitLabel="הוסף קבוצה"
      inputRef={inputRef}
    />
  )
}
