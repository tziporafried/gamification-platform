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
  const [externalId, setExternalId] = useState(participant?.external_id ?? '')
  const [email, setEmail] = useState(participant?.email ?? '')
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
    if (!externalId.trim()) {
      setError('External ID is required.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: name.trim(),
        external_id: externalId.trim(),
        email: email.trim() || null,
      }

      if (isEdit) {
        const { error: updateError } = await supabase
          .from('participants')
          .update(payload)
          .eq('id', participant.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('participants')
          .insert({ ...payload, event_id: eventId })

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('A participant with this External ID already exists in this event.')
          }
          throw insertError
        }
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
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <Input
          id="participant-name"
          label="Name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          id="external-id"
          label="External ID"
          placeholder="EXT-001"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
        />

        <Input
          id="participant-email"
          label="Email (optional)"
          type="email"
          placeholder="jane@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
