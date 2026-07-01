import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { theme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { isPlanLimitError } from '@/lib/plans'
import type { Reward } from '@/types'

interface RewardFormProps {
  eventId: string
  reward?: Reward
  isOpen: boolean
  onClose: () => void
  onSaved: (reward: Reward) => void
  onPlanLimit?: () => void
}

export function RewardForm({ eventId, reward, isOpen, onClose, onSaved, onPlanLimit }: RewardFormProps) {
  const [name, setName] = useState(reward?.name ?? '')
  const [requiredPoints, setRequiredPoints] = useState(reward?.required_points?.toString() ?? '')
  const [description, setDescription] = useState(reward?.description ?? '')
  const [isActive, setIsActive] = useState(reward?.is_active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!reward

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
      if (isEdit) {
        const { data, error: updateError } = await supabase
          .from('rewards')
          .update({
            name: name.trim(),
            required_points: pointsNum,
            description: description.trim() || null,
            is_active: isActive,
          })
          .eq('id', reward.id)
          .select()
          .single()

        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error('פרס עם שם זה כבר קיים.')
          }
          throw updateError
        }
        onSaved(data as Reward)
      } else {
        const { data, error: insertError } = await supabase
          .from('rewards')
          .insert({
            event_id: eventId,
            name: name.trim(),
            required_points: pointsNum,
            description: description.trim() || null,
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
      }
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'עריכת פרס' : 'יצירת פרס'}>
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

        <Textarea
          id="reward-description"
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
            {isEdit ? 'שמירת שינויים' : 'יצירת פרס'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  )
}
