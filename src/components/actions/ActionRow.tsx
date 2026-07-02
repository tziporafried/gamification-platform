import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { TaskLimitSelect } from './TaskLimitSelect'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { ACTION_CARD_GRADIENT, getActionIcon, getActionIconMotion, getActionIconPlacement } from '@/lib/actionTiers'
import type { ActionWithGroups, Group } from '@/types'

type LimitMode = 'unlimited' | 'once' | 'limited'

function toLimitMode(max: number | null): LimitMode {
  if (max === null) return 'unlimited'
  if (max === 1) return 'once'
  return 'limited'
}

function toMaxCompletions(mode: LimitMode, customLimit: number): number | null {
  if (mode === 'unlimited') return null
  if (mode === 'once') return 1
  return customLimit
}

interface ActionRowProps {
  action: ActionWithGroups
  groups: Group[]
  onEdit: () => void
  onDeleted?: () => void
  onUpdated?: (patch: Partial<ActionWithGroups>) => void
  onError?: (msg: string) => void
  siblingNames?: string[]
}

export const ActionRow = memo(function ActionRow({
  action,
  groups,
  onEdit,
  onDeleted,
  onUpdated,
  onError,
  siblingNames = [],
}: ActionRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPoints, setEditingPoints] = useState(false)
  const [name, setName] = useState(action.name)
  const [points, setPoints] = useState(action.points.toString())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLParagraphElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  const [limitMode, setLimitMode] = useState<LimitMode>(toLimitMode(action.max_completions))
  const [customLimit, setCustomLimit] = useState(action.max_completions && action.max_completions > 1 ? action.max_completions : 5)
  const [editingLimit, setEditingLimit] = useState(false)
  const limitRef = useRef<HTMLInputElement>(null)

  const [localGroups, setLocalGroups] = useState(action.groups)

  const pointsNum = parseInt(points, 10) || 0
  const ActionIcon = getActionIcon(action.id)
  const iconMotion = getActionIconMotion(action.id)
  const iconPlacement = getActionIconPlacement(action.id)
  const pointsLabel = `${pointsNum < 0 ? '−' : ''}${Math.abs(pointsNum).toLocaleString()} נק׳`
  const assignedGroupIds = new Set(localGroups.map(g => g.id))
  const isAllGroups = localGroups.length === 0
  const isNameTruncated = useIsTruncated(nameTextRef, name)

  useEffect(() => { setName(action.name) }, [action.name])
  useEffect(() => { setPoints(action.points.toString()) }, [action.points])
  useEffect(() => { setLocalGroups(action.groups) }, [action.groups])
  useEffect(() => {
    setLimitMode(toLimitMode(action.max_completions))
    if (action.max_completions && action.max_completions > 1) setCustomLimit(action.max_completions)
  }, [action.max_completions])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  useEffect(() => {
    if (editingPoints) { pointsRef.current?.focus(); pointsRef.current?.select() }
  }, [editingPoints])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === action.name) {
      setName(action.name)
      setEditingName(false)
      return
    }
    if (siblingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setName(action.name)
      setEditingName(false)
      onError?.('כבר קיימת פעילות בשם זה')
      return
    }
    setSaving(true)
    await supabase.from('actions').update({ name: trimmed }).eq('id', action.id)
    setSaving(false)
    setEditingName(false)
    onUpdated?.({ name: trimmed })
  }

  async function savePoints() {
    const num = parseInt(points, 10)
    if (isNaN(num)) {
      setPoints(action.points.toString())
      setEditingPoints(false)
      onError?.('יש לבחור מספר נקודות')
      return
    }
    if (num === action.points) {
      setPoints(action.points.toString())
      setEditingPoints(false)
      return
    }
    setSaving(true)
    await supabase.from('actions').update({ points: num }).eq('id', action.id)
    setSaving(false)
    setEditingPoints(false)
    onUpdated?.({ points: num })
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveName() }
    if (e.key === 'Escape') { setName(action.name); setEditingName(false) }
  }

  function handlePointsKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); savePoints() }
    if (e.key === 'Escape') { setPoints(action.points.toString()); setEditingPoints(false) }
  }

  async function saveLimitMode(mode: LimitMode, limit?: number) {
    const val = toMaxCompletions(mode, limit ?? customLimit)
    setLimitMode(mode)
    if (mode === 'limited' && limit) setCustomLimit(limit)
    await supabase.from('actions').update({ max_completions: val }).eq('id', action.id)
    if (onUpdated) onUpdated({ max_completions: val })
    else onEdit()
  }

  async function handleDelete() {
    if (!onDeleted) return
    await supabase.from('actions').delete().eq('id', action.id)
    onDeleted()
  }

  function selectAllGroups() {
    setLocalGroups([])
    supabase.from('action_groups').delete().eq('action_id', action.id)
      .then(({ error: err }) => {
        if (err) {
          if (onError) onError('שגיאה בעדכון קבוצות. הנתונים רועננו.')
          onEdit()
        }
      })
  }

  function toggleGroup(groupId: string) {
    const isMember = assignedGroupIds.has(groupId)
    setLocalGroups(prev =>
      isMember
        ? prev.filter(g => g.id !== groupId)
        : [...prev, groups.find(g => g.id === groupId)!]
    )

    const mutation = isMember
      ? supabase.from('action_groups').delete().eq('action_id', action.id).eq('group_id', groupId)
      : supabase.from('action_groups').insert({ action_id: action.id, group_id: groupId })

    mutation.then(({ error: err }) => {
      if (err) {
        if (onError) onError('שגיאה בעדכון קבוצה. הנתונים רועננו.')
        onEdit()
      }
    })
  }

  return (
    <div className="group/card relative">
      <div
        className={cn(
          'relative overflow-hidden rounded-xl text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover hover:brightness-[1.03] motion-reduce:hover:transform-none motion-reduce:hover:brightness-100',
          ACTION_CARD_GRADIENT,
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl" aria-hidden>
          <div
            className="absolute top-1/2"
            style={{
              left: iconPlacement.left,
              transform: `translateY(-50%) translateX(${iconPlacement.translateX})`,
            }}
          >
            <ActionIcon
              size={48}
              strokeWidth={1.5}
              className="text-white/[0.1] animate-action-icon-float motion-reduce:animate-none"
              style={{
                animationDelay: iconMotion.animationDelay,
                animationDuration: iconMotion.animationDuration,
              }}
            />
          </div>
        </div>

        <WizardDeleteButton
          variant="card"
          containerClassName="absolute left-2 top-1/2 z-20 -translate-y-1/2"
          fixedSize
          onClick={handleDelete}
        />

        <div className="relative z-10 flex min-h-[3.25rem] items-center gap-2 py-2 pl-10 pr-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Tooltip
              content={name}
              hidden={editingName || !isNameTruncated}
              className="min-w-0"
            >
              <div
                className="flex h-5 min-w-0 items-center"
                onClick={() => !editingName && setEditingName(true)}
                role="button"
                tabIndex={-1}
              >
                {editingName ? (
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleNameKey}
                    onBlur={saveName}
                    className={cn(
                      'h-full w-full min-w-0 bg-transparent text-sm font-semibold leading-5 text-white outline-none border-0 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.5)]',
                      saving && 'opacity-50',
                    )}
                    disabled={saving}
                  />
                ) : (
                  <p
                    ref={nameTextRef}
                    className="h-full w-full min-w-0 truncate text-sm font-semibold leading-5 cursor-text hover:text-white/90 transition-colors"
                  >
                    {name}
                  </p>
                )}
              </div>
            </Tooltip>

            <div className="flex min-h-[1.375rem] flex-wrap items-center gap-1">
              <TaskLimitSelect
                limitMode={limitMode}
                customLimit={customLimit}
                editingLimit={editingLimit}
                limitRef={limitRef}
                onSaveLimitMode={saveLimitMode}
                onSetEditingLimit={setEditingLimit}
                onSetCustomLimit={setCustomLimit}
                onResetLimit={() => setLimitMode(toLimitMode(action.max_completions))}
                tone="onColor"
                size="compact"
              />

              {groups.length > 0 && (
                <GroupSelectDropdown
                  groups={groups}
                  selectedGroupIds={assignedGroupIds}
                  isAllSelected={isAllGroups}
                  tooltip="על אילו קבוצות חלה הפעילות"
                  onSelectAll={selectAllGroups}
                  onToggleGroup={(groupId) => toggleGroup(groupId)}
                  tone="onColor"
                  size="compact"
                />
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <div className="h-7 w-24 shrink-0">
              {editingPoints ? (
                <input
                  ref={pointsRef}
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={handlePointsKey}
                  onBlur={savePoints}
                  className={cn(
                    'h-full w-full rounded-full bg-white/25 text-center text-xs font-bold leading-none text-white outline-none border border-white/40',
                    saving && 'opacity-50',
                  )}
                  disabled={saving}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPoints(true)}
                  className="inline-flex h-full w-full min-w-0 cursor-text items-center justify-center rounded-full bg-white/20 px-1 text-xs font-bold leading-none transition-colors hover:bg-white/30"
                >
                  <span className="truncate">{pointsLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
