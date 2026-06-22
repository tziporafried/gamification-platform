import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WizardStepWrapper } from './WizardStepWrapper'
import { InlineAddParticipant } from '@/components/participants/InlineAddParticipant'
import { UpgradeModal } from '@/components/UpgradeModal'
import { UsageBar } from '@/components/ui/UsageBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import type { EventCounts, GroupType, ParticipantWithGroups, Group } from '@/types'

interface StepParticipantsProps {
  eventId: string
  counts: EventCounts
  groupType: GroupType | null
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

export function StepParticipants({ eventId, counts, groupType, onCountsRefresh, onNext, onBack }: StepParticipantsProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const planLimits = usePlanLimits(eventId)
  const refreshPlanLimits = planLimits.refresh

  const hasGroups = groupType === 'custom'

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [pRes, gRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, participant_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        hasGroups
          ? supabase.from('groups').select('*').eq('event_id', eventId).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const mapped: ParticipantWithGroups[] = (pRes.data ?? []).map((p) => ({
        ...p,
        groups: ((p.participant_groups as unknown as ParticipantGroupJoin[]) ?? []).map((pg) => pg.groups),
      }))

      setParticipants(mapped)
      setGroups((gRes.data as Group[]) ?? [])
      onCountsRefresh()
      refreshPlanLimits()
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId, hasGroups, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (participants.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = participants.length
  }, [participants.length])

  function triggerRefresh() {
    setRefreshKey(k => k + 1)
  }

  async function handleDelete(id: string) {
    await supabase.from('participants').delete().eq('id', id)
    triggerRefresh()
  }

  async function toggleGroup(participantId: string, groupId: string, isMember: boolean) {
    if (isMember) {
      await supabase.from('participant_groups').delete().eq('participant_id', participantId).eq('group_id', groupId)
    } else {
      await supabase.from('participant_groups').insert({ participant_id: participantId, group_id: groupId })
    }
    triggerRefresh()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <WizardStepWrapper
      title="משתתפים"
      subtitle="הוסף את כל מי שמשתתף באירוע"
      currentStep={3}
      canAdvance={participants.length > 0}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex h-full flex-col min-h-0">
        {/* Pinned top: counter + usage bar */}
        <div className="shrink-0 space-y-3 pb-3">
          {participants.length > 0 && (
            <p className="text-xs text-gray-500 text-center">
              {participants.length} משתתפים
            </p>
          )}
          {planLimits.isFreePlan && (
            <UsageBar info={planLimits.participants} entity="participants" />
          )}
        </div>

        {/* Scrollable list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-2 pb-2">
          {participants.length === 0 ? (
            <EmptyState
              title="אין משתתפים עדיין"
              description="הקלד שם למטה ולחץ Enter להוספה מהירה"
            />
          ) : (
            participants.map((p) => (
              <ParticipantInlineRow
                key={p.id}
                participant={p}
                groups={hasGroups ? groups : []}
                onDelete={() => handleDelete(p.id)}
                onToggleGroup={(groupId, isMember) => toggleGroup(p.id, groupId, isMember)}
              />
            ))
          )}
        </div>

        {/* Pinned bottom: add input */}
        <div className="shrink-0 pt-2">
          <InlineAddParticipant eventId={eventId} onAdded={triggerRefresh} onPlanLimit={() => setUpgradeOpen(true)} />
        </div>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </WizardStepWrapper>
  )
}

function ParticipantInlineRow({
  participant,
  groups,
  onDelete,
  onToggleGroup,
}: {
  participant: ParticipantWithGroups
  groups: Group[]
  onDelete: () => void
  onToggleGroup: (groupId: string, isMember: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(participant.name)

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === participant.name) {
      setName(participant.name)
      setEditing(false)
      return
    }
    await supabase.from('participants').update({ name: trimmed }).eq('id', participant.id)
    setEditing(false)
  }

  const memberGroupIds = new Set(participant.groups.map(g => g.id))

  return (
    <div className="flex items-center gap-3 rounded-xl border border-game-border bg-game-card p-3 transition-all hover:border-brand-700/50 group">
      <div className="min-w-0 flex-1" onClick={() => !editing && setEditing(true)} role="button" tabIndex={-1}>
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(participant.name); setEditing(false) } }}
            onBlur={saveName}
            autoFocus
            className="w-full bg-transparent text-sm font-medium text-white outline-none border-b border-brand-500 pb-0.5"
          />
        ) : (
          <span className="block w-full text-sm font-medium text-gray-200 hover:text-white transition-colors cursor-text truncate">
            {name}
          </span>
        )}

        {/* Inline group selector */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {groups.map((g) => {
              const isMember = memberGroupIds.has(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => onToggleGroup(g.id, isMember)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all border',
                    isMember
                      ? 'border-transparent text-white'
                      : 'border-dashed border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300',
                  )}
                  style={isMember ? { backgroundColor: g.color + '33', color: g.color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: isMember ? g.color : undefined }}
                  />
                  {g.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
