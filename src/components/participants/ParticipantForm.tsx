import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
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
      setError('שם הוא שדה חובה.')
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
      setError(err instanceof Error ? err.message : 'משהו השתבש.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'עריכת משתתף' : 'הוספת משתתף'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <ErrorAlert message={error} />
        )}

        <Input
          id="participant-name"
          label="שם"
          placeholder="ישראל ישראלי"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'שמירת שינויים' : 'הוספת משתתף'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  )
}
