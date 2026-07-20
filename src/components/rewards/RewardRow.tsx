import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { RewardScopeSelect, rewardScopeToFields, type RewardScopeId } from '@/components/rewards/RewardSettingSelects'
import { cn } from '@/lib/utils'
import { getRewardTier } from '@/lib/rewardTiers'
import type { Group, RewardTargetType, RewardWinnerMode, RewardWithGroups } from '@/types'

function getRewardIconMotion(rewardId: string) {
  let hash = 0
  for (let i = 0; i < rewardId.length; i++) {
    hash = (hash * 31 + rewardId.charCodeAt(i)) >>> 0
  }

  return {
    animationDelay: `${(hash % 12) * 0.28}s`,
    animationDuration: `${2.6 + (hash % 8) * 0.15}s`,
  }
}

interface RewardRowProps {
  reward: RewardWithGroups
  groups: Group[]
  siblingNames: string[]
  onDelete: () => void
  onUpdated: (patch: Partial<RewardWithGroups>) => void
  onGroupsChange: (groups: Group[]) => void
  onError?: (message: string) => void
}

export function RewardRow({
  reward,
  groups,
  siblingNames,
  onDelete,
  onUpdated,
  onGroupsChange,
  onError,
}: RewardRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPoints, setEditingPoints] = useState(false)
  const [name, setName] = useState(reward.name)
  const [points, setPoints] = useState(reward.required_points.toString())
  const [saving, setSaving] = useState(false)
  const [localGroups, setLocalGroups] = useState(reward.groups)
  const [targetType, setTargetType] = useState<RewardTargetType>(reward.target_type ?? 'all')
  const [winnerMode, setWinnerMode] = useState<RewardWinnerMode>(reward.winner_mode ?? 'all')
  const nameRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLButtonElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  const pointsNum = parseInt(points, 10) || reward.required_points
  const tier = getRewardTier(pointsNum)
  const TierIcon = tier.Icon
  const iconMotion = getRewardIconMotion(reward.id)
  const assignedGroupIds = new Set(localGroups.map((g) => g.id))
  const isAllGroups = localGroups.length === 0
  const isNameTruncated = useIsTruncated(nameTextRef, name)

  useEffect(() => { setName(reward.name) }, [reward.name])
  useEffect(() => { setPoints(reward.required_points.toString()) }, [reward.required_points])
  useEffect(() => { setLocalGroups(reward.groups) }, [reward.groups])
  useEffect(() => { setTargetType(reward.target_type ?? 'all') }, [reward.target_type])
  useEffect(() => { setWinnerMode(reward.winner_mode ?? 'all') }, [reward.winner_mode])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  useEffect(() => {
    if (editingPoints) { pointsRef.current?.focus(); pointsRef.current?.select() }
  }, [editingPoints])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === reward.name) {
      setName(reward.name)
      setEditingName(false)
      return
    }
    if (siblingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setName(reward.name)
      setEditingName(false)
      onError?.('פרס עם שם זה כבר קיים.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('rewards').update({ name: trimmed }).eq('id', reward.id)
    setSaving(false)
    setEditingName(false)

    if (error) {
      if (error.code === '23505') onError?.('פרס עם שם זה כבר קיים.')
      else onError?.('שגיאה בשמירת השם.')
      setName(reward.name)
      return
    }
    onUpdated({ name: trimmed })
  }

  async function savePoints() {
    const num = parseInt(points, 10)
    if (isNaN(num) || num <= 0) {
      setPoints(reward.required_points.toString())
      setEditingPoints(false)
      onError?.('ניקוד נדרש חייב להיות מספר חיובי.')
      return
    }
    if (num === reward.required_points) {
      setPoints(reward.required_points.toString())
      setEditingPoints(false)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('rewards').update({ required_points: num }).eq('id', reward.id)
    setSaving(false)
    setEditingPoints(false)

    if (error) {
      onError?.('שגיאה בשמירת הניקוד.')
      setPoints(reward.required_points.toString())
      return
    }
    onUpdated({ required_points: num })
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveName() }
    if (e.key === 'Escape') { setName(reward.name); setEditingName(false) }
  }

  function handlePointsKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); savePoints() }
    if (e.key === 'Escape') { setPoints(reward.required_points.toString()); setEditingPoints(false) }
  }

  async function clearRewardGroups() {
    const { error } = await supabase.from('reward_groups').delete().eq('reward_id', reward.id)
    if (error) throw error
    setLocalGroups([])
    onGroupsChange([])
  }

  function selectAllGroups() {
    if (targetType !== 'groups') return
    setLocalGroups([])
    onGroupsChange([])
    supabase.from('reward_groups').delete().eq('reward_id', reward.id).then(({ error }) => {
      if (error) {
        onError?.('שגיאה בעדכון קבוצות. הנתונים רועננו.')
        setLocalGroups(reward.groups)
        onGroupsChange(reward.groups)
      }
    })
  }

  function toggleGroup(groupId: string) {
    if (targetType !== 'groups') return
    const isMember = assignedGroupIds.has(groupId)
    const next = isMember
      ? localGroups.filter((g) => g.id !== groupId)
      : [...localGroups, groups.find((g) => g.id === groupId)!]

    setLocalGroups(next)
    onGroupsChange(next)

    const mutation = isMember
      ? supabase.from('reward_groups').delete().eq('reward_id', reward.id).eq('group_id', groupId)
      : supabase.from('reward_groups').insert({ reward_id: reward.id, group_id: groupId })

    mutation.then(({ error }) => {
      if (error) {
        onError?.('שגיאה בעדכון קבוצה. הנתונים רועננו.')
        setLocalGroups(reward.groups)
        onGroupsChange(reward.groups)
      }
    })
  }

  async function saveTargeting(patch: {
    target_type?: RewardTargetType
    winner_mode?: RewardWinnerMode
  }) {
    const nextTargetType = patch.target_type ?? targetType
    const nextWinnerMode = patch.winner_mode ?? winnerMode

    const { error } = await supabase
      .from('rewards')
      .update({
        target_type: nextTargetType,
        winner_mode: nextWinnerMode,
        target_participant_id: null,
      })
      .eq('id', reward.id)

    if (error) {
      onError?.('שגיאה בעדכון הגדרות הפרס.')
      setTargetType(reward.target_type ?? 'all')
      setWinnerMode(reward.winner_mode ?? 'all')
      return
    }

    const updatedPatch: Partial<RewardWithGroups> = {
      target_type: nextTargetType,
      winner_mode: nextWinnerMode,
      target_participant_id: null,
    }

    if (nextTargetType !== 'groups' && reward.groups.length > 0) {
      try {
        await clearRewardGroups()
      } catch {
        onError?.('שגיאה בעדכון קבוצות. הנתונים רועננו.')
        return
      }
    }

    setTargetType(nextTargetType)
    setWinnerMode(nextWinnerMode)
    onUpdated(updatedPatch)
  }

  async function handleScopeChange(nextScope: RewardScopeId) {
    const { target_type: nextTargetType, winner_mode: nextWinnerMode } = rewardScopeToFields(nextScope)

    if (nextTargetType === targetType && nextWinnerMode === winnerMode) return

    if (nextTargetType === 'groups' && groups.length === 0) {
      onError?.('יש להוסיף קבוצות לפני הגדרת פרס לקבוצות.')
      return
    }

    await saveTargeting({
      target_type: nextTargetType,
      winner_mode: nextWinnerMode,
    })
  }

  const showGroupPicker = targetType === 'groups' && groups.length > 0

  return (
    <div className="group/card relative h-full">
      <div
        className={cn(
          'relative flex h-full min-h-[11.5rem] flex-col overflow-hidden rounded-2xl text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover hover:brightness-[1.03] motion-reduce:hover:transform-none motion-reduce:hover:brightness-100',
          tier.gradient,
        )}
      >
        <div className="relative z-10 flex flex-1 flex-col items-center px-4 py-5 text-center">
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <div className="flex w-full flex-col items-center gap-0.5">
            <TierIcon
              size={32}
              strokeWidth={2}
              className="pointer-events-none shrink-0 animate-reward-icon-float text-white transition-transform duration-300 ease-out group-hover/card:scale-110 motion-reduce:animate-none motion-reduce:group-hover/card:scale-100"
              style={{
                animationDelay: iconMotion.animationDelay,
                animationDuration: iconMotion.animationDuration,
              }}
            />
          <Tooltip
            content={name}
            hidden={editingName || !isNameTruncated}
            className="w-full"
          >
            {/* Real button when idle - see GroupCard for the same fix. */}
            <div className="flex h-9 w-full min-w-0 items-center justify-center">
              {editingName ? (
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleNameKey}
                  onBlur={saveName}
                  disabled={saving}
                  className={cn(
                    'h-full w-full min-w-0 bg-transparent text-center text-xl font-bold text-white outline-none border-0 border-b border-white/50',
                    saving && 'opacity-50',
                  )}
                />
              ) : (
                <button
                  ref={nameTextRef}
                  type="button"
                  onClick={() => setEditingName(true)}
                  aria-label={`עריכת שם הפרס: ${name}`}
                  className="w-full min-w-0 truncate border-0 bg-transparent p-0 text-xl font-bold leading-9 cursor-text hover:text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  {name}
                </button>
              )}
            </div>
          </Tooltip>
          </div>

          <div className="flex justify-center">
            {editingPoints ? (
              <input
                ref={pointsRef}
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                onKeyDown={handlePointsKey}
                onBlur={savePoints}
                disabled={saving}
                className={cn(
                  'h-7 w-24 rounded-full bg-white/25 text-center text-xs font-bold text-white outline-none border border-white/40',
                  saving && 'opacity-50',
                )}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingPoints(true)}
                className="inline-flex h-7 cursor-text items-center justify-center rounded-full bg-white/20 px-3 text-xs font-bold transition-colors hover:bg-white/30"
              >
                {pointsNum.toLocaleString()} נק׳
              </button>
            )}
          </div>
          </div>

          <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-1.5 pt-2">
            <RewardScopeSelect
              targetType={targetType}
              winnerMode={winnerMode}
              groupCount={groups.length}
              onChange={handleScopeChange}
            />
            <div className="flex h-7 items-center justify-center">
              {showGroupPicker ? (
                <GroupSelectDropdown
                  groups={groups}
                  selectedGroupIds={assignedGroupIds}
                  isAllSelected={isAllGroups}
                  allGroupsLabel="כל הקבוצות"
                  emptyLabel="בחרו קבוצות"
                  tooltip="על אילו קבוצות חל הפרס"
                  onSelectAll={selectAllGroups}
                  onToggleGroup={(groupId) => toggleGroup(groupId)}
                  tone="onColor"
                  size="compact"
                />
              ) : (
                <span className="h-7" aria-hidden />
              )}
            </div>
          </div>
        </div>

        <WizardDeleteButton variant="card" onClick={onDelete} />
      </div>
    </div>
  )
}
