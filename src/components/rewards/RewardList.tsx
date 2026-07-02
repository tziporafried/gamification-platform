import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Lock, Plus, Gift } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TruncatedTooltipText } from '@/components/ui/Tooltip'
import { UpgradeModal } from '@/components/UpgradeModal'
import { RewardForm } from './RewardForm'
import { RewardRow } from './RewardRow'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { RewardWithGroups, Reward, Group, TemplateReward } from '@/types'

interface RewardListProps {
  eventId: string
  onCountChange: (count: number) => void
  /** Wizard: refetch groups when the step becomes active again. */
  isActive?: boolean
  groupCount?: number
}

interface RewardGroupJoin {
  group_id: string
  groups: Group
}

function LockedRewardCard({ reward }: { reward: TemplateReward }) {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-surface opacity-50 select-none">
        <div className="pointer-events-none absolute top-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-xl bg-surface-elevated opacity-50 shadow-sm">
          <Lock size={14} className="text-muted" />
        </div>
        <div className="relative z-10 flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 px-4 py-4 pl-8 pr-10 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted">
            פרמיום
          </div>
          <TruncatedTooltipText
            text={reward.name}
            className="w-full min-w-0 truncate text-xl font-bold leading-9 text-muted"
          />
          <div className="inline-flex h-7 items-center justify-center rounded-full bg-surface-elevated px-3 text-xs font-bold text-muted">
            {reward.required_points.toLocaleString()} נק׳
          </div>
          <div className="flex justify-center">
            <span className="rounded-full border border-warning bg-surface-elevated px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              שדרוג נדרש
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RewardList({ eventId, onCountChange, isActive, groupCount }: RewardListProps) {
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [lockedRewards, setLockedRewards] = useState<TemplateReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const onCountChangeRef = useRef(onCountChange)
  const lastReportedCountRef = useRef<number | null>(null)
  onCountChangeRef.current = onCountChange

  useEffect(() => {
    function syncLocked() {
      setLockedRewards(getLockedTemplate(eventId)?.rewards ?? [])
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [eventId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [rewardsRes, groupsRes] = await Promise.all([
        supabase
          .from('rewards')
          .select('*, reward_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('required_points', { ascending: true }),
        supabase
          .from('groups')
          .select('*')
          .eq('event_id', eventId)
          .order('name'),
      ])

      if (cancelled) return

      if (rewardsRes.error) {
        setError(rewardsRes.error.message)
        setLoading(false)
        return
      }

      if (groupsRes.error) {
        setError(groupsRes.error.message)
        setLoading(false)
        return
      }

      const mapped: RewardWithGroups[] = (rewardsRes.data ?? []).map((r) => ({
        ...r,
        groups: ((r.reward_groups as unknown as RewardGroupJoin[]) ?? []).map((rg) => rg.groups),
      }))

      setRewards(mapped)
      setGroups(groupsRes.data ?? [])
      if (lastReportedCountRef.current !== mapped.length) {
        lastReportedCountRef.current = mapped.length
        onCountChangeRef.current(mapped.length)
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId])

  useEffect(() => {
    if (isActive === false) return

    let cancelled = false

    async function refreshGroups() {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('name')

      if (cancelled) return

      if (error) {
        setError(error.message)
        return
      }

      setGroups(data ?? [])
    }

    refreshGroups()
    return () => { cancelled = true }
  }, [eventId, isActive, groupCount])

  const handleSaved = useCallback((saved: Reward) => {
    setFormOpen(false)
    setRewards((prev) => {
      const next = [...prev, { ...saved, groups: [] }]
      lastReportedCountRef.current = next.length
      onCountChangeRef.current(next.length)
      return next
    })
  }, [])

  function handleCreate() {
    setFormOpen(true)
  }

  function handleUpdated(rewardId: string, patch: Partial<RewardWithGroups>) {
    setRewards((prev) => prev.map((r) => (
      r.id === rewardId ? { ...r, ...patch } : r
    )))
  }

  function handleGroupsChange(rewardId: string, nextGroups: Group[]) {
    setRewards((prev) => prev.map((r) => (
      r.id === rewardId ? { ...r, groups: nextGroups } : r
    )))
  }

  async function handleDelete(reward: RewardWithGroups) {
    const { error: deleteError } = await supabase
      .from('rewards')
      .delete()
      .eq('id', reward.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setRewards((prev) => {
      const next = prev.filter((r) => r.id !== reward.id)
      lastReportedCountRef.current = next.length
      onCountChangeRef.current(next.length)
      return next
    })
  }

  if (loading) {
    return <CenteredLoader />
  }

  const hasLocked = lockedRewards.length > 0

  const rewardGridClass = 'grid gap-4 px-1 py-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const lockedGrid = (
    <div className={rewardGridClass}>
      {lockedRewards.map((reward) => (
        <LockedRewardCard key={reward.id} reward={reward} />
      ))}
    </div>
  )

  const addButton = (
    <div className="flex justify-center pt-1">
      <Button size="sm" className="gap-1.5" onClick={handleCreate}>
        <Plus size={16} className="shrink-0" strokeWidth={2.5} />
        {rewards.length === 0 ? 'הוספת פרס' : 'הוספת פרס נוסף'}
      </Button>
    </div>
  )

  const content = (
    <div className="pb-2">
      {error && <ErrorAlert message={error} className="mb-4" />}

      {rewards.length === 0 ? (
        hasLocked ? (
          <div className="space-y-3">
            {lockedGrid}
            {addButton}
          </div>
        ) : (
          <EmptyState
            icon={<Gift size={32} strokeWidth={1.75} />}
            title="אין פרסים עדיין"
            description="צרו הפתעות שהשחקנים שלכם יוכלו לקבל."
            action={
              <Button size="sm" className="gap-1.5" onClick={handleCreate}>
                <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                הוספת פרס
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          <div className={rewardGridClass}>
            {rewards.map((reward) => (
              <RewardRow
                key={reward.id}
                reward={reward}
                groups={groups}
                siblingNames={rewards.filter((r) => r.id !== reward.id).map((r) => r.name)}
                onDelete={() => handleDelete(reward)}
                onUpdated={(patch) => handleUpdated(reward.id, patch)}
                onGroupsChange={(nextGroups) => handleGroupsChange(reward.id, nextGroups)}
                onError={setError}
              />
            ))}
          </div>
          {hasLocked && lockedGrid}
          {addButton}
        </div>
      )}
    </div>
  )

  return (
    <>
      {content}
      {formOpen && (
        <RewardForm
          eventId={eventId}
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
          onPlanLimit={() => setUpgradeOpen(true)}
        />
      )}
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />
    </>
  )
}
