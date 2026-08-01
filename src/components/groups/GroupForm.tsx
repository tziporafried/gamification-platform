import { useState, FormEvent, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { getNextPresetColor } from '@/lib/paletteColors'
import { useGroupPurpose } from '@/lib/groups/groupPurposeFlag'
import {
  GROUP_PURPOSE_DESCRIPTIONS,
  GROUP_PURPOSE_LABELS,
  groupPurpose,
  isMissingGroupPurposeError,
  MISSING_GROUP_PURPOSE_MESSAGE,
} from '@/lib/groups/groupPurpose'
import { cn } from '@/lib/utils'
import type { Group, GroupPurpose } from '@/types'

const PURPOSE_OPTIONS: GroupPurpose[] = ['competition', 'distribution']

interface GroupFormProps {
  eventId: string
  group?: Group
  usedColors?: string[]
  isOpen: boolean
  onClose: () => void
  onSaved: (group: Group) => void
}

export function GroupForm({ eventId, group, usedColors = [], isOpen, onClose, onSaved }: GroupFormProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [color, setColor] = useState(group?.color ?? getNextPresetColor(usedColors))
  const [purpose, setPurpose] = useState<GroupPurpose>(groupPurpose(group))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Without the flag the choice is not offered and nothing writes the column.
  const canChoosePurpose = useGroupPurpose()

  const isEdit = !!group

  useEffect(() => {
    if (!isOpen) return
    setName(group?.name ?? '')
    setColor(group?.color ?? getNextPresetColor(usedColors))
    setPurpose(groupPurpose(group))
    setError('')
  }, [isOpen, group?.id, group?.name, group?.color, group?.purpose, usedColors])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('שם הקבוצה הוא שדה חובה.')
      return
    }

    setSaving(true)

    // Named only when the game can choose: a database without 090 has no such
    // column, and a game without the flag has nothing to say about it either.
    const fields = canChoosePurpose
      ? { name: name.trim(), color, purpose }
      : { name: name.trim(), color }

    try {
      if (isEdit) {
        const { data, error: updateError } = await supabase
          .from('groups')
          .update(fields)
          .eq('id', group.id)
          .select()
          .single()

        if (updateError) throw updateError
        onSaved(data as Group)
      } else {
        const { data, error: insertError } = await supabase
          .from('groups')
          .insert({ event_id: eventId, ...fields })
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('קבוצה עם שם זה כבר קיימת.')
          }
          throw insertError
        }
        onSaved(data as Group)
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'משהו השתבש.'
      setError(isMissingGroupPurposeError(message) ? MISSING_GROUP_PURPOSE_MESSAGE : message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'עריכת קבוצה' : 'יצירת קבוצה'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <ErrorAlert message={error} />
        )}

        <Input
          id="group-name"
          label="שם הקבוצה"
          placeholder="קבוצה א׳"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <ColorPicker
          label="צבע"
          value={color}
          onChange={setColor}
        />

        {canChoosePurpose && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">מה תפקיד הקבוצה?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PURPOSE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPurpose(option)}
                  aria-pressed={purpose === option}
                  className={cn(
                    'rounded-xl border p-3 text-right transition-colors',
                    purpose === option
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface hover:bg-surface-elevated',
                  )}
                >
                  <span className="block text-sm font-bold text-foreground">
                    {GROUP_PURPOSE_LABELS[option]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">
                    {GROUP_PURPOSE_DESCRIPTIONS[option]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <ModalActions>
          <Button type="submit" loading={saving}>
            {isEdit ? 'שמירת שינויים' : 'יצירת קבוצה'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
