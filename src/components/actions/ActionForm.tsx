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
  const [code, setCode] = useState(action?.code ?? '')
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

    if (!code.trim()) {
      setError('Code is required.')
      return
    }
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    const pointsNum = parseInt(points, 10)
    if (isNaN(pointsNum)) {
      setError('Points must be a number.')
      return
    }

    setSaving(true)

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('actions')
          .update({
            code: code.trim(),
            name: name.trim(),
            points: pointsNum,
            description: description.trim() || null,
            is_active: isActive,
          })
          .eq('id', action.id)

        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error('An action with this code already exists.')
          }
          throw updateError
        }
      } else {
        const { error: insertError } = await supabase
          .from('actions')
          .insert({
            event_id: eventId,
            code: code.trim(),
            name: name.trim(),
            points: pointsNum,
            description: description.trim() || null,
          })

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('An action with this code already exists.')
          }
          throw insertError
        }
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Action' : 'Create Action'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <Input
          id="action-code"
          label="Code"
          placeholder="QUIZ_COMPLETE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />

        <Input
          id="action-name"
          label="Name"
          placeholder="Complete a Quiz"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          id="action-points"
          label="Points"
          type="number"
          placeholder="10"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />

        <div className="w-full">
          <label htmlFor="action-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="action-description"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-indigo-500 focus:ring-indigo-500"
            rows={2}
            placeholder="Optional description"
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
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Action'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
