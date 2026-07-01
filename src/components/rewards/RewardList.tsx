import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Lock, Plus, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
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
}

interface RewardGroupJoin {
  group_id: string
  groups: Group
}

function LockedRewardCard({ reward }: { reward: TemplateReward }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface opacity-50 select-none">
      <div className="flex flex-col items-center p-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated mb-3">
          <Lock size={22} className="text-muted" />
        </div>
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-muted">
          פרמיום
        </div>
        <p className="w-full truncate text-sm font-bold text-muted">{reward.name}</p>
        <div className="mt-3 inline-flex items-center rounded-full bg-surface-elevated px-3 py-1 text-xs font-bold text-muted">
          {reward.required_points.toLocaleString()} נק׳
        </div>
        <span className="mt-2 rounded-full border border-warning bg-surface-elevated px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
          שדרוג נדרש
        </span>
      </div>
    </div>
  )
}

function PremiumDivider() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Lock size={10} />
        פרמיום
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export function RewardList({ eventId, onCountChange }: RewardListProps) {
  const [rewards, setRewards] = useState<RewardWithGroups[]>([])
  const [lockedRewards, setLockedRewards] = useState<TemplateReward[]>([])
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
    return <CenteredLoader />
  }

  const hasLocked = lockedRewards.length > 0

  const lockedGrid = (
    <div className="grid gap-3 p-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {lockedRewards.map((reward) => (
        <LockedRewardCard key={reward.id} reward={reward} />
      ))}
    </div>
  )

  const addButton = (
    <div className="flex justify-center pt-1">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCreate}>
        <Plus size={16} className="shrink-0" strokeWidth={2.5} />
        {rewards.length === 0 ? 'הוספת פרס' : 'הוספת פרס נוסף'}
      </Button>
    </div>
  )

  const content = (
    <div>
      {error && <ErrorAlert message={error} className="mb-4" />}

      {rewards.length === 0 ? (
        hasLocked ? (
          <div className="space-y-3">
            <PremiumDivider />
            {lockedGrid}
            {addButton}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy size={32} strokeWidth={1.75} />}
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
          <div className="grid gap-3 p-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
          {hasLocked && (
            <>
              <PremiumDivider />
              {lockedGrid}
            </>
          )}
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
}
