import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Participant } from '@/types'

interface ParticipantFormProps {
  eventId: string
  participant?: Participant
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function ParticipantForm({ eventId, participant, isOpen, onClose, onSaved }: ParticipantFormProps) {
  const [name, setName] = useState(participant?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!participant

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    setSaving(true)

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('participants')
          .update({ name: name.trim() })
          .eq('id', participant.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('participants')
          .insert({ name: name.trim(), event_id: eventId })

        if (insertError) throw insertError
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Participant' : 'Add Participant'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
        )}

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Participant Code</label>
            <p className="rounded-lg bg-game-dark border border-game-border rounded-xl px-3 py-2 text-sm font-mono text-gray-400">
              {participant.external_id}
            </p>
          </div>
        )}

        <Input
          id="participant-name"
          label="Name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Add Participant'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
