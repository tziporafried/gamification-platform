import { useState, FormEvent, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { isPlanLimitError } from '@/lib/plans'
import type { Reward } from '@/types'

interface RewardFormProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
  onSaved: (reward: Reward) => void
  onPlanLimit?: () => void
}

export function RewardForm({ eventId, isOpen, onClose, onSaved, onPlanLimit }: RewardFormProps) {
  const [name, setName] = useState('')
  const [requiredPoints, setRequiredPoints] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setRequiredPoints('')
      setError('')
    }
  }, [isOpen])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('שם הוא שדה חובה.')
      return
    }
    const pointsNum = parseInt(requiredPoints, 10)
    if (isNaN(pointsNum) || pointsNum <= 0) {
      setError('ניקוד נדרש חייב להיות מספר חיובי.')
      return
    }

    setSaving(true)

    try {
      const { data, error: insertError } = await supabase
        .from('rewards')
        .insert({
          event_id: eventId,
          name: name.trim(),
          required_points: pointsNum,
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('פרס עם שם זה כבר קיים.')
        }
        throw insertError
      }
      onSaved(data as Reward)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string }).message ?? 'משהו השתבש.'
      if (isPlanLimitError(msg) && onPlanLimit) {
        onClose()
        onPlanLimit()
        return
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="יצירת פרס">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <ErrorAlert message={error} />
        )}

        <Input
          id="reward-name"
          label="שם"
          placeholder=""
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          id="reward-points"
          label="ניקוד נדרש"
          type="number"
          placeholder="100"
          value={requiredPoints}
          onChange={(e) => setRequiredPoints(e.target.value)}
        />

        <ModalActions>
          <Button type="submit" loading={saving}>
            יצירת פרס
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
