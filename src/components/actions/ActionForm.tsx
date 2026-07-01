import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { theme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { Action } from '@/types'

interface ActionFormProps {
  eventId: string
  action?: Action
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function ActionForm({ eventId, action, isOpen, onClose, onSaved }: ActionFormProps) {
  const [name, setName] = useState(action?.name ?? '')
  const [points, setPoints] = useState(action?.points?.toString() ?? '')
  const [description, setDescription] = useState(action?.description ?? '')
  const [isActive, setIsActive] = useState(action?.is_active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!action

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('שם הוא שדה חובה.')
      return
    }
    const pointsNum = parseInt(points, 10)
    if (isNaN(pointsNum)) {
      setError('ניקוד חייב להיות מספר.')
      return
    }

    setSaving(true)

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('actions')
          .update({
            name: name.trim(),
            points: pointsNum,
            description: description.trim() || null,
            is_active: isActive,
          })
          .eq('id', action.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('actions')
          .insert({
            event_id: eventId,
            name: name.trim(),
            points: pointsNum,
            description: description.trim() || null,
          })

        if (insertError) throw insertError
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'עריכת משימה' : 'יצירת משימה'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <ErrorAlert message={error} />
        )}

        <Input
          id="action-name"
          label="שם"
          placeholder="השלמת חידון"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          id="action-points"
          label="ניקוד"
          type="number"
          placeholder="10"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />

        <Textarea
          id="action-description"
          label="תיאור"
          rows={2}
          placeholder="תיאור אופציונלי"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-surface-elevated"
        />

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className={cn('h-4 w-4 rounded border-border bg-surface-elevated', theme.checkbox)}
            />
            פעיל
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'שמירת שינויים' : 'יצירת משימה'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  )
}
