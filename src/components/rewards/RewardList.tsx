import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { RewardForm } from './RewardForm'
import { RewardRow } from './RewardRow'
import { RewardGroupAssignment } from './RewardGroupAssignment'
import type { RewardWithGroups, Reward, Group } from '@/types'

interface RewardListProps {
  eventId: string
  onCountChange: (count: number) => void
}

interface RewardGroupJoin {
  group_id: string
  groups: Group
}

export function RewardList({ eventId, onCountChange }: RewardListProps) {
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [assigningReward, setAssigningReward] = useState<RewardWithGroups | null>(null)

  const fetchRewards = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('rewards')
      .select('*, reward_groups(group_id, groups(*))')
      .eq('event_id', eventId)
      .order('required_points', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const mapped: RewardWithGroups[] = (data ?? []).map((r) => ({
      ...r,
      groups: ((r.reward_groups as unknown as RewardGroupJoin[]) ?? []).map((rg) => rg.groups),
    }))

    setRewards(mapped)
    onCountChange(mapped.length)
    setLoading(false)
  }, [eventId, onCountChange])

  useEffect(() => { fetchRewards() }, [fetchRewards])

  function handleCreate() {
    setEditingReward(null)
    setFormOpen(true)
  }

  function handleEdit(reward: RewardWithGroups) {
    setEditingReward(reward)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingReward(null)
  }

  async function handleToggleActive(reward: RewardWithGroups) {
    const { error: updateError } = await supabase
      .from('rewards')
      .update({ is_active: !reward.is_active })
      .eq('id', reward.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    fetchRewards()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
            <Trophy size={18} className="text-brand-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Rewards</h2>
        </div>
        <Button size="sm" onClick={handleCreate}>Add Reward</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {rewards.length === 0 ? (
        <EmptyState
          title="No rewards yet"
          description="Create rewards that participants can earn by reaching point thresholds."
          action={<Button size="sm" onClick={handleCreate}>Add Reward</Button>}
        />
      ) : (
        <div className="space-y-2">
          {rewards.map((reward) => (
            <RewardRow
              key={reward.id}
              reward={reward}
              onEdit={() => handleEdit(reward)}
              onToggleActive={() => handleToggleActive(reward)}
              onManageGroups={() => setAssigningReward(reward)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <RewardForm
          eventId={eventId}
          reward={editingReward ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={() => { handleFormClose(); fetchRewards() }}
        />
      )}

      {assigningReward && (
        <RewardGroupAssignment
          eventId={eventId}
          rewardId={assigningReward.id}
          rewardName={assigningReward.name}
          isOpen={!!assigningReward}
          onClose={() => setAssigningReward(null)}
          onChanged={fetchRewards}
        />
      )}
    </div>
  )
}
