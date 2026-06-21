import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ColorPicker } from '@/components/ui/ColorPicker'
import type { Group } from '@/types'

interface GroupFormProps {
  eventId: string
  group?: Group
  isOpen: boolean
  onClose: () => void
  onSaved: (group: Group) => void
}

export function GroupForm({ eventId, group, isOpen, onClose, onSaved }: GroupFormProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [color, setColor] = useState(group?.color ?? '#6366f1')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!group

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('שם הקבוצה הוא שדה חובה.')
      return
    }

    setSaving(true)

    try {
      if (isEdit) {
        const { data, error: updateError } = await supabase
          .from('groups')
          .update({ name: name.trim(), color })
          .eq('id', group.id)
          .select()
          .single()

        if (updateError) throw updateError
        onSaved(data as Group)
      } else {
        const { data, error: insertError } = await supabase
          .from('groups')
          .insert({ event_id: eventId, name: name.trim(), color })
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
      setError(err instanceof Error ? err.message : 'משהו השתבש.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'עריכת קבוצה' : 'יצירת קבוצה'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
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

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'שמירת שינויים' : 'יצירת קבוצה'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  )
}
