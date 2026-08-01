import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { getNextPresetColor } from '@/lib/paletteColors'
import { GROUP_PURPOSE_LABELS } from '@/lib/groups/groupPurpose'
import type { Group, GroupPurpose } from '@/types'

const BASE_COLUMNS = 'id, event_id, name, color, created_at, updated_at'

interface InlineAddGroupProps {
  eventId: string
  usedColors?: string[]
  onAdded: (group: Group) => void
  onPlanLimit?: () => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
  /**
   * What the groups typed here are for (090). Undefined - every game without
   * the `group_purpose` flag - names no such column at all, so a database that
   * has not run the migration is untouched by this field.
   */
  purpose?: GroupPurpose
}

export function InlineAddGroup({ eventId, usedColors = [], onAdded, onPlanLimit, nameInputRef, purpose }: InlineAddGroupProps) {
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
      .insert({
        name: trimmed,
        event_id: eventId,
        color: getNextPresetColor(usedColors),
        ...(purpose ? { purpose } : {}),
      })
      .select(purpose ? `${BASE_COLUMNS}, purpose` : BASE_COLUMNS)
      .single()

    setSaving(false)

    if (error) {
      if (isPlanLimitError(error.message) && onPlanLimit) onPlanLimit()
      return
    }
    if (!data) return

    setName('')
    onAdded(data as unknown as Group)
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
      // Says which kind is being added where both can be - a game whose
      // competition is between individuals only ever adds the second.
      submitLabel={purpose === 'distribution' ? `הוסף ${GROUP_PURPOSE_LABELS.distribution}` : 'הוסף קבוצה'}
      inputRef={inputRef}
    />
  )
}
