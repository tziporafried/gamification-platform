import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { UpgradeModal } from '@/components/UpgradeModal'
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
  const [upgradeOpen, setUpgradeOpen] = useState(false)

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
    <div className="-mx-4 -mt-6 md:-mt-8">
      <div className="bg-game-radial px-4 pt-6 pb-6 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Trophy size={22} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ארון הפרסים</h2>
                <p className="text-xs text-gray-400">הישגים לאיסוף</p>
              </div>
            </div>
            <Button size="sm" variant="gradient" onClick={handleCreate}>הוספת פרס</Button>
          </div>

          {error && (
            <ErrorAlert message={error} className="mb-4" />
          )}

          {rewards.length === 0 ? (
            <div className="rounded-2xl border border-game-border bg-game-card/50 px-6 py-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm font-medium text-gray-400">אין פרסים עדיין</p>
              <p className="mt-1 text-xs text-gray-500">צרו הישגים שהשחקנים שלכם יוכלו לפתוח.</p>
              <div className="mt-4">
                <Button size="sm" variant="gradient" onClick={handleCreate}>הוספת פרס</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
        </div>
      </div>

      {formOpen && (
        <RewardForm
          eventId={eventId}
          reward={editingReward ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={() => { handleFormClose(); fetchRewards() }}
          onPlanLimit={() => setUpgradeOpen(true)}
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

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} limitType="rewards" />
    </div>
  )
}
