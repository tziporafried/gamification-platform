import { useState, useRef, useEffect, useCallback, memo, KeyboardEvent } from 'react'
import { Trash2, Repeat, RotateCcw, Hash, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { ActionTimeSettings } from './ActionTimeSettings'
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

type ActionCopyVariant = 'default' | 'wizard'

interface ActionRowProps {
  action: ActionWithGroups
  groups: Group[]
  onEdit: () => void
  onDeleted?: () => void
  onUpdated?: (patch: Partial<ActionWithGroups>) => void
  onError?: (msg: string) => void
  variant?: ActionCopyVariant
  siblingNames?: string[]
}

export const ActionRow = memo(function ActionRow({
  action,
  groups,
  onEdit,
  onDeleted,
  onUpdated,
  onError,
  variant = 'default',
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

  const isPositive = parseInt(points, 10) >= 0
  const isWizard = variant === 'wizard'
  const pointsNum = parseInt(points, 10) || 0
  const pointsLabel = isWizard
    ? `${pointsNum < 0 ? '−' : ''}${Math.abs(pointsNum)} נק'`
    : `${isPositive ? '+' : ''}${points}`
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
              isWizard ? 'h-11 min-w-[3.25rem] px-2' : 'h-11 w-11',
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
          variant={variant}
        />

        {groups.length > 0 && (
          <div className="shrink-0">
            <GroupSelectDropdown
              groups={groups}
              selectedGroupIds={assignedGroupIds}
              isAllSelected={isAllGroups}
              tooltip={isWizard ? 'על אילו קבוצות חלה הפעילות' : 'על אילו קבוצות חלה המשימה'}
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

function TaskLimitSelect({
  limitMode,
  customLimit,
  editingLimit,
  limitRef,
  onSaveLimitMode,
  onSetEditingLimit,
  onSetCustomLimit,
  onResetLimit,
  variant = 'default',
}: {
  limitMode: LimitMode
  customLimit: number
  editingLimit: boolean
  limitRef: React.RefObject<HTMLInputElement>
  onSaveLimitMode: (mode: LimitMode, limit?: number) => void
  onSetEditingLimit: (v: boolean) => void
  onSetCustomLimit: (v: number) => void
  onResetLimit: () => void
  variant?: ActionCopyVariant
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeSelect = useCallback(() => { setOpen(false); onSetEditingLimit(false) }, [onSetEditingLimit])
  useClickOutside(ref, closeSelect)

  const isWizard = variant === 'wizard'
  const unlimitedLabel = isWizard ? 'ניתן לבצע ללא הגבלה' : 'ללא הגבלה'
  const limitTooltip = isWizard
    ? 'כמה פעמים כל משתתף יכול לבצע את הפעילות'
    : 'כמה פעמים כל משתתף יכול לבצע את המשימה'

  const label = limitMode === 'unlimited' ? unlimitedLabel
    : limitMode === 'once' ? 'פעם אחת'
    : `${customLimit} פעמים`

  const Icon = limitMode === 'unlimited' ? Repeat : limitMode === 'once' ? RotateCcw : Hash
  const colorClass = limitMode === 'unlimited'
    ? 'border-brand-500/30 text-brand-400 bg-brand-400/10 hover:bg-brand-400/15'
    : limitMode === 'once'
    ? 'border-amber-500/30 text-amber-400 bg-amber-400/10 hover:bg-amber-400/15'
    : 'border-cyan-500/30 text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/15'

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        title={limitTooltip}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all border max-w-[9rem]',
          colorClass,
        )}
      >
        <Icon size={10} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 right-0 w-52 rounded-xl border border-game-border bg-game-card shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[10px] text-gray-500">כמה פעמים כל משתתף יכול לבצע</div>
          <button
            onClick={() => { onSaveLimitMode('unlimited'); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
              limitMode === 'unlimited' ? 'text-brand-400' : 'text-gray-400',
            )}
          >
            <Repeat size={12} className="shrink-0" />
            <div className="text-right">
              <div>{unlimitedLabel}</div>
              <div className="text-[10px] font-normal text-gray-500">ניתן לבצע כמה פעמים שרוצים</div>
            </div>
          </button>
          <button
            onClick={() => { onSaveLimitMode('once'); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
              limitMode === 'once' ? 'text-amber-400' : 'text-gray-400',
            )}
          >
            <RotateCcw size={12} className="shrink-0" />
            <div className="text-right">
              <div>פעם אחת</div>
              <div className="text-[10px] font-normal text-gray-500">כל משתתף יכול לבצע פעם אחת בלבד</div>
            </div>
          </button>
          <div className="mx-2 my-1 border-t border-game-border" />
          {editingLimit ? (
            <div className="flex items-center gap-1.5 px-3 py-2">
              <Hash size={12} className="text-cyan-400 shrink-0" />
              <input
                ref={limitRef}
                type="number"
                min={2}
                value={customLimit}
                onChange={(e) => onSetCustomLimit(Math.max(2, parseInt(e.target.value, 10) || 2))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onSaveLimitMode('limited', Math.max(2, customLimit)); onSetEditingLimit(false); setOpen(false) }
                  if (e.key === 'Escape') { onSetEditingLimit(false); onResetLimit() }
                }}
                onBlur={() => { onSaveLimitMode('limited', Math.max(2, customLimit)); onSetEditingLimit(false) }}
                className="w-12 bg-game-dark rounded px-1.5 py-0.5 text-xs text-center text-white font-medium outline-none border border-brand-500"
                autoFocus
              />
              <span className="text-xs text-gray-400">פעמים</span>
            </div>
          ) : (
            <button
              onClick={() => { onSaveLimitMode('limited'); onSetEditingLimit(true) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
                limitMode === 'limited' ? 'text-cyan-400' : 'text-gray-400',
              )}
            >
              <Hash size={12} className="shrink-0" />
              <div className="text-right">
                <div>{limitMode === 'limited' ? `${customLimit} פעמים` : 'מוגבל...'}</div>
                <div className="text-[10px] font-normal text-gray-500">הגדר מספר מרבי של ביצועים</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
