import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { UpgradeModal } from '@/components/UpgradeModal'
import { RewardForm } from './RewardForm'
import { RewardRow } from './RewardRow'
import { RewardGroupAssignment } from './RewardGroupAssignment'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { RewardWithGroups, Reward, Group, TemplateReward } from '@/types'

interface RewardListProps {
  eventId: string
  onCountChange: (count: number) => void
  variant?: 'default' | 'wizard'
}

interface RewardGroupJoin {
  group_id: string
  groups: Group
}

function LockedRewardCard({ reward }: { reward: TemplateReward }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-game-card/50 opacity-50 select-none">
      <div className="flex flex-col items-center p-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 mb-3">
          <Lock size={22} className="text-zinc-600" />
        </div>
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          פרמיום
        </div>
        <p className="w-full truncate text-sm font-bold text-zinc-500">{reward.name}</p>
        <div className="mt-3 inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-600">
          {reward.required_points.toLocaleString()} נק׳
        </div>
        <span className="mt-2 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500/60">
          שדרוג נדרש
        </span>
      </div>
    </div>
  )
}

export function RewardList({ eventId, onCountChange, variant = 'default' }: RewardListProps) {
  const isWizard = variant === 'wizard'
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [lockedRewards, setLockedRewards] = useState<TemplateReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [assigningReward, setAssigningReward] = useState<RewardWithGroups | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    function syncLocked() {
      setLockedRewards(getLockedTemplate(eventId)?.rewards ?? [])
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [eventId])

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

  const hasLocked = lockedRewards.length > 0

  const rewardGrid = (
    <div className="space-y-3">
      {rewards.length > 0 && (
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

      {hasLocked && (
        <>
          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <Lock size={10} />
              פרמיום
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {lockedRewards.map((reward) => (
              <LockedRewardCard key={reward.id} reward={reward} />
            ))}
          </div>
        </>
      )}

      {isWizard && (
        <div className="flex justify-center pt-1">
          <Button size="sm" variant="outline" onClick={handleCreate}>הוספת פרס נוסף</Button>
        </div>
      )}
    </div>
  )

  const emptyState = (
    <div className="space-y-3">
      {!hasLocked && (
        <div className="rounded-2xl border border-game-border bg-game-card/50 px-6 py-12 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-medium text-gray-400">אין פרסים עדיין</p>
          <p className="mt-1 text-xs text-gray-500">צרו הפתעות שהשחקנים שלכם יוכלו לקבל.</p>
          <div className="mt-4">
            <Button size="sm" variant="gradient" onClick={handleCreate}>הוספת פרס</Button>
          </div>
        </div>
      )}
      {hasLocked && (
        <>
          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <Lock size={10} />
              פרמיום
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {lockedRewards.map((reward) => (
              <LockedRewardCard key={reward.id} reward={reward} />
            ))}
          </div>
          {isWizard && (
            <div className="flex justify-center pt-1">
              <Button size="sm" variant="outline" onClick={handleCreate}>הוספת פרס</Button>
            </div>
          )}
        </>
      )}
    </div>
  )

  const content = (
    <div className={isWizard ? '' : 'mx-auto max-w-5xl'}>
      {!isWizard && (
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
      )}

      {error && <ErrorAlert message={error} className="mb-4" />}

      {rewards.length === 0 ? emptyState : rewardGrid}
    </div>
  )

  const modals = (
    <>
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
    </>
  )

  if (isWizard) {
    return (
      <>
        {content}
        {modals}
      </>
    )
  }

  return (
    <div className="-mx-4 -mt-6 md:-mt-8">
      <div className="bg-game-radial px-4 pt-6 pb-6 md:pt-8">
        {content}
      </div>
      {modals}
    </div>
  )
}
