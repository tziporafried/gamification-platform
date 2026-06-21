import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
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
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
        )}

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">קוד משימה</label>
            <p className="rounded-lg bg-game-dark border border-game-border rounded-xl px-3 py-2 text-sm font-mono text-gray-400">
              {action.code}
            </p>
          </div>
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

        <div className="w-full">
          <label htmlFor="action-description" className="block text-sm font-medium text-gray-300 mb-1">
            תיאור
          </label>
          <textarea
            id="action-description"
            className="block w-full rounded-xl border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-brand-500 focus:ring-brand-500/30"
            rows={2}
            placeholder="תיאור אופציונלי"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-game-border bg-game-dark text-brand-600 focus:ring-brand-500"
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
