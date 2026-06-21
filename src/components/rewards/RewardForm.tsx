import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Reward } from '@/types'

interface RewardFormProps {
  eventId: string
  reward?: Reward
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function RewardForm({ eventId, reward, isOpen, onClose, onSaved }: RewardFormProps) {
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
      setError('Name is required.')
      return
    }
    const pointsNum = parseInt(requiredPoints, 10)
    if (isNaN(pointsNum) || pointsNum <= 0) {
      setError('Required points must be a positive number.')
      return
    }

    setSaving(true)

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('rewards')
          .update({
            name: name.trim(),
            required_points: pointsNum,
            description: description.trim() || null,
            is_active: isActive,
          })
          .eq('id', reward.id)

        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error('A reward with this name already exists.')
          }
          throw updateError
        }
      } else {
        const { error: insertError } = await supabase
          .from('rewards')
          .insert({
            event_id: eventId,
            name: name.trim(),
            required_points: pointsNum,
            description: description.trim() || null,
          })

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('A reward with this name already exists.')
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Reward' : 'Create Reward'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
        )}

        <Input
          id="reward-name"
          label="Name"
          placeholder="Bronze Achievement"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          id="reward-points"
          label="Required Points"
          type="number"
          placeholder="100"
          value={requiredPoints}
          onChange={(e) => setRequiredPoints(e.target.value)}
        />

        <div className="w-full">
          <label htmlFor="reward-description" className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="reward-description"
            className="block w-full rounded-xl border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-brand-500 focus:ring-brand-500/30"
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
              className="h-4 w-4 rounded border-game-border bg-game-dark text-brand-600 focus:ring-brand-500"
            />
            Active
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Reward'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
