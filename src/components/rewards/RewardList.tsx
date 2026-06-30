import { useState, useEffect, useRef, useCallback } from 'react'
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
  variant?: 'default' | 'wizard'
}

interface RewardGroupJoin {
  group_id: string
  groups: Group
}

export function RewardList({ eventId, onCountChange, variant = 'default' }: RewardListProps) {
  const isWizard = variant === 'wizard'
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [assigningReward, setAssigningReward] = useState<RewardWithGroups | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const onCountChangeRef = useRef(onCountChange)
  const lastReportedCountRef = useRef<number | null>(null)
  onCountChangeRef.current = onCountChange

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('rewards')
        .select('*, reward_groups(group_id, groups(*))')
        .eq('event_id', eventId)
        .order('required_points', { ascending: true })

      if (cancelled) return

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
      if (lastReportedCountRef.current !== mapped.length) {
        lastReportedCountRef.current = mapped.length
        onCountChangeRef.current(mapped.length)
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId])

  const handleSaved = useCallback((saved: Reward) => {
    handleFormClose()
    setRewards((prev) => {
      const exists = prev.some((r) => r.id === saved.id)
      if (exists) {
        return prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r))
      }
      const next = [...prev, { ...saved, groups: [] }]
      lastReportedCountRef.current = next.length
      onCountChangeRef.current(next.length)
      return next
    })
  }, [])

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
    const nextActive = !reward.is_active
    const { error: updateError } = await supabase
      .from('rewards')
      .update({ is_active: nextActive })
      .eq('id', reward.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setRewards((prev) => prev.map((r) => (
      r.id === reward.id ? { ...r, is_active: nextActive } : r
    )))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

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

      {rewards.length === 0 ? (
        <div className="rounded-2xl border border-game-border bg-game-card/50 px-6 py-12 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-medium text-gray-400">אין פרסים עדיין</p>
          <p className="mt-1 text-xs text-gray-500">צרו הפתעות שהשחקנים שלכם יוכלו לקבל.</p>
          <div className="mt-4">
            <Button size="sm" variant="gradient" onClick={handleCreate}>הוספת פרס</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
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
          {isWizard && (
            <div className="flex justify-center pt-1">
              <Button size="sm" variant="outline" onClick={handleCreate}>הוספת פרס נוסף</Button>
            </div>
          )}
        </div>
      )}
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
          onSaved={handleSaved}
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
        />
      )}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
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
