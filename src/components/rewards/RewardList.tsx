import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Lock, Plus, Gift } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ScrollableListLayout } from '@/components/ui/ScrollableListLayout'
import { Toast } from '@/components/ui/Toast'
import { TruncatedTooltipText } from '@/components/ui/Tooltip'
import { UpgradeModal } from '@/components/UpgradeModal'
import { InlineAddReward } from './InlineAddReward'
import { RewardRow } from './RewardRow'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { RewardWithGroups, Reward, Group, TemplateReward } from '@/types'

interface RewardListProps {
  eventId: string
  onCountChange: (count: number) => void
  /** Wizard step: list scrolls in parent; add field pinned at bottom. */
  embedded?: boolean
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
    <div className="relative h-full">
      <div className="relative h-full overflow-hidden rounded-2xl bg-surface opacity-50 select-none">
        <div className="relative z-10 flex h-full min-h-[11.5rem] flex-col items-center justify-center gap-2 px-4 py-5 text-center">
          <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated opacity-50 shadow-sm">
            <Lock size={16} className="text-muted" />
          </div>
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

export function RewardList({ eventId, onCountChange, embedded = false, isActive, groupCount }: RewardListProps) {
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [lockedRewards, setLockedRewards] = useState<TemplateReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputFocusRequest, setAddInputFocusRequest] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)
  const onCountChangeRef = useRef(onCountChange)
  const lastReportedCountRef = useRef<number | null>(null)
  onCountChangeRef.current = onCountChange

  function revealAddInput() {
    setShowAddInput(true)
    setAddInputFocusRequest((n) => n + 1)
  }

  const showFeedback = useCallback((message: string, feedbackVariant: 'success' | 'error') => {
    setToast({ message, variant: feedbackVariant })
  }, [])

  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 0)
    }
  }, [showAddInput, addInputFocusRequest])

  useEffect(() => {
    if (rewards.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = rewards.length
  }, [rewards.length])

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

      const legacyParticipantIds = (rewardsRes.data ?? [])
        .filter((r) => r.target_type === 'participant')
        .map((r) => r.id as string)

      if (legacyParticipantIds.length > 0) {
        await supabase
          .from('rewards')
          .update({ target_type: 'all', target_participant_id: null, winner_mode: 'all' })
          .in('id', legacyParticipantIds)
      }

      const mapped: RewardWithGroups[] = (rewardsRes.data ?? []).map((r) => ({
        ...r,
        target_type: r.target_type === 'participant' ? 'all' : (r.target_type ?? 'all'),
        winner_mode: r.target_type === 'participant' ? 'all' : (r.winner_mode ?? 'all'),
        target_participant_id: null,
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
    if (groupCount === 0) {
      setGroups([])
      setRewards((prev) => prev.map((r) => (r.groups.length > 0 ? { ...r, groups: [] } : r)))
    }

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

  const handleAdded = useCallback((saved: Reward) => {
    setRewards((prev) => {
      const next = [...prev, {
        ...saved,
        target_type: saved.target_type ?? 'all',
        winner_mode: saved.winner_mode ?? 'all',
        target_participant_id: saved.target_participant_id ?? null,
        groups: [],
      }]
      lastReportedCountRef.current = next.length
      onCountChangeRef.current(next.length)
      return next
    })
  }, [])

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

  const existingNames = rewards.map((r) => r.name)
  const hasLocked = lockedRewards.length > 0

  const rewardGridClass = 'grid items-stretch gap-4 px-1 py-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const inlineAdd = (
    <InlineAddReward
      eventId={eventId}
      onAdded={handleAdded}
      onPlanLimit={() => setUpgradeOpen(true)}
      existingNames={existingNames}
      onFeedback={showFeedback}
      nameInputRef={addInputRef}
    />
  )

  const emptyState = (
    <EmptyState
      icon={<Gift size={32} strokeWidth={1.75} />}
      title="עדיין לא הוספתם פרסים"
      description="כל פרס הוא יעד נוסף שהמשתתפים יוכלו להגיע אליו במהלך המשחק."
      action={
        <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
          <Plus size={16} className="shrink-0" strokeWidth={2.5} />
          הוספת פרס
        </Button>
      }
    />
  )

  const rewardGrid = rewards.length > 0 && (
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
  )

  const lockedGrid = hasLocked && (
    <div className={rewardGridClass}>
      {lockedRewards.map((reward) => (
        <LockedRewardCard key={reward.id} reward={reward} />
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {error && <ErrorAlert message={error} className="shrink-0 mb-4" />}

      {rewards.length === 0 && !hasLocked ? (
        embedded ? (
          <ScrollableListLayout
            className="flex-1 min-h-0"
            listRef={listRef}
            footer={showAddInput ? inlineAdd : undefined}
          >
            {emptyState}
          </ScrollableListLayout>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
              {emptyState}
            </div>
            {showAddInput && (
              <div className="shrink-0">
                {inlineAdd}
              </div>
            )}
          </div>
        )
      ) : embedded ? (
        <ScrollableListLayout
          className="flex-1 min-h-0"
          listRef={listRef}
          listClassName="space-y-3"
          footer={inlineAdd}
        >
          {rewardGrid}
          {lockedGrid}
        </ScrollableListLayout>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-3">
            {rewardGrid}
            {lockedGrid}
          </div>
          <div className="shrink-0">
            {inlineAdd}
          </div>
        </>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          autoDismissMs={3000}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
