import { useState, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlanLimitError } from '@/lib/plans'
import { InlineAddField } from '@/components/ui/InlineAddField'
import type { Group } from '@/types'

interface InlineAddGroupProps {
  eventId: string
  onAdded: (group: Group) => void
  onPlanLimit?: () => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

export function InlineAddGroup({ eventId, onAdded, onPlanLimit, nameInputRef }: InlineAddGroupProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = nameInputRef ?? internalInputRef

  function getRandomColor() {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  }

  async function addGroup() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: trimmed, event_id: eventId, color: getRandomColor() })
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
      placeholder="הקלד שם קבוצה ולחץ Enter..."
      disabled={saving}
      onSubmit={addGroup}
      inputRef={inputRef}
    />
  )
}
