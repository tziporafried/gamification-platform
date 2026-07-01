import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { ActionTimeSettings } from './ActionTimeSettings'
import { TaskLimitSelect } from './TaskLimitSelect'
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
  const pointsRef = useRef<HTMLInputElement>(null)

  const [limitMode, setLimitMode] = useState<LimitMode>(toLimitMode(action.max_completions))
  const [customLimit, setCustomLimit] = useState(action.max_completions && action.max_completions > 1 ? action.max_completions : 5)
  const [editingLimit, setEditingLimit] = useState(false)
  const limitRef = useRef<HTMLInputElement>(null)

  const [localGroups, setLocalGroups] = useState(action.groups)

  const pointsNum = parseInt(points, 10) || 0
  const isPositive = pointsNum >= 0
  const pointsLabel = `${pointsNum < 0 ? '−' : ''}${Math.abs(pointsNum)} נק'`
  const assignedGroupIds = new Set(localGroups.map(g => g.id))
  const isAllGroups = localGroups.length === 0

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
    <div
      className={cn(
        'rounded-xl border bg-game-card transition-all duration-200 hover:border-brand-700/50 group/row',
        isPositive ? 'border-game-border' : 'border-red-500/20',
      )}
    >
      <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Points badge */}
        {editingPoints ? (
          <input
            ref={pointsRef}
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            onKeyDown={handlePointsKey}
            onBlur={savePoints}
            className={cn(
              'h-11 w-11 rounded-xl text-center text-sm font-bold outline-none border border-brand-500 bg-game-dark text-white',
              saving && 'opacity-50',
            )}
            disabled={saving}
          />
        ) : (
          <button
            onClick={() => setEditingPoints(true)}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl text-sm font-bold cursor-text transition-colors',
              'h-11 min-w-[3.25rem] px-2',
              isPositive
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
            )}
          >
            {pointsLabel}
          </button>
        )}

        {/* Name */}
        <div className="min-w-0 flex-1" onClick={() => !editingName && setEditingName(true)} role="button" tabIndex={-1}>
          {editingName ? (
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleNameKey}
              onBlur={saveName}
              className={cn(
                'w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-brand-500 pb-0.5',
                saving && 'opacity-50',
              )}
              disabled={saving}
            />
          ) : (
            <span className="block w-full text-sm font-semibold text-gray-200 hover:text-white transition-colors cursor-text truncate">
              {name}
            </span>
          )}
        </div>

        {/* Task limit dropdown */}
        <TaskLimitSelect
          limitMode={limitMode}
          customLimit={customLimit}
          editingLimit={editingLimit}
          limitRef={limitRef}
          onSaveLimitMode={saveLimitMode}
          onSetEditingLimit={setEditingLimit}
          onSetCustomLimit={setCustomLimit}
          onResetLimit={() => setLimitMode(toLimitMode(action.max_completions))}
        />

        {groups.length > 0 && (
          <div className="shrink-0">
            <GroupSelectDropdown
              groups={groups}
              selectedGroupIds={assignedGroupIds}
              isAllSelected={isAllGroups}
              tooltip="על אילו קבוצות חלה הפעילות"
              onSelectAll={selectAllGroups}
              onToggleGroup={(groupId) => toggleGroup(groupId)}
            />
          </div>
        )}

        <button
          onClick={handleDelete}
          className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="מחיקה"
        >
          <Trash2 size={16} />
        </button>
      </div>
      </div>
      <ActionTimeSettings
        action={action}
        onUpdated={(patch) => (onUpdated ? onUpdated(patch) : onEdit())}
      />
    </div>
  )
})
