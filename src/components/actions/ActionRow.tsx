import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { AlertTriangle, Check, HelpCircle, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { TaskLimitSelect } from './TaskLimitSelect'
import { ACTION_CARD_GRADIENT, getActionIcon, getActionIconMotion, getActionIconPlacement } from '@/lib/actionTiers'
import { theme } from '@/lib/theme'
import { toLimitDbValues, toLimitMode, getDailyTimeWindow, isSameLimitDbValues, type DailyTimeWindow, type LimitMode } from '@/lib/taskLimit'
import { isTriviaAction } from '@/lib/tasks/triviaScan'
import type { ActionOption, ActionWithGroups, Group } from '@/types'

interface ActionRowProps {
  action: ActionWithGroups
  groups: Group[]
  onEdit: () => void
  onDeleted?: () => void
  onUpdated?: (patch: Partial<ActionWithGroups>) => void
  onError?: (msg: string) => void
  siblingNames?: string[]
  /** The answers, for a trivia task. Undefined for every standard one. */
  options?: ActionOption[]
  /** Opens the composer on this question. Only called for a trivia task. */
  onEditQuestion?: () => void
}

export const ActionRow = memo(function ActionRow({
  action,
  groups,
  onEdit,
  onDeleted,
  onUpdated,
  onError,
  siblingNames = [],
  options,
  onEditQuestion,
}: ActionRowProps) {
  const isTrivia = isTriviaAction(action)
  /**
   * A question that would print cards nobody can win on.
   *
   * The composer will not save one, but `updateTriviaQuestion` clears every
   * correct flag before setting the new one - so a write that fails halfway
   * leaves exactly this state. It is not printed (QrCardGenerator drops it), and
   * silently not printing is the one thing that must not happen quietly.
   */
  const missingCorrectAnswer =
    isTrivia && !!options && options.length > 0 && !options.some((o) => o.is_correct)
  const [editingName, setEditingName] = useState(false)
  const [editingPoints, setEditingPoints] = useState(false)
  const [name, setName] = useState(action.name)
  const [points, setPoints] = useState(action.points.toString())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  const [limitMode, setLimitMode] = useState<LimitMode>(toLimitMode(action))
  const [customLimit, setCustomLimit] = useState(action.max_completions && action.max_completions > 1 ? action.max_completions : 5)
  const [dailyWindow, setDailyWindow] = useState<DailyTimeWindow>(getDailyTimeWindow(action))
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

  useEffect(() => { setName(action.name) }, [action.name])
  useEffect(() => { setPoints(action.points.toString()) }, [action.points])
  useEffect(() => { setLocalGroups(action.groups) }, [action.groups])
  useEffect(() => {
    setLimitMode(toLimitMode(action))
    if (action.max_completions && action.max_completions > 1) setCustomLimit(action.max_completions)
    setDailyWindow(getDailyTimeWindow(action))
  }, [action.id])

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

  async function saveLimitMode(
    mode: LimitMode,
    options?: { limit?: number; dailyWindow?: DailyTimeWindow },
  ) {
    const nextCustomLimit = options?.limit ?? customLimit
    const nextDailyWindow = mode === 'daily'
      ? (options?.dailyWindow !== undefined ? options.dailyWindow : dailyWindow)
      : { start: null, end: null }
    const dbValues = toLimitDbValues(mode, nextCustomLimit, nextDailyWindow)
    const currentDbValues = toLimitDbValues(limitMode, customLimit, dailyWindow)

    if (isSameLimitDbValues(
      {
        max_completions: currentDbValues.max_completions,
        daily_limit: currentDbValues.daily_limit,
        daily_start_hour: currentDbValues.daily_start_hour,
        daily_start_minute: currentDbValues.daily_start_minute,
        daily_end_hour: currentDbValues.daily_end_hour,
        daily_end_minute: currentDbValues.daily_end_minute,
      },
      dbValues,
    )) {
      return
    }

    setLimitMode(mode)
    if (mode === 'limited' && options?.limit) setCustomLimit(options.limit)
    if (mode === 'daily') setDailyWindow(nextDailyWindow)

    const { error } = await supabase.from('actions').update(dbValues).eq('id', action.id)
    if (error) {
      resetLimit()
      onError?.('שגיאה בעדכון מגבלה')
      return
    }

    onUpdated?.(dbValues)
  }

  function resetLimit() {
    setLimitMode(toLimitMode(action))
    setDailyWindow(getDailyTimeWindow(action))
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
          'relative overflow-hidden rounded-xl text-white',
          theme.wizardListRowHover,
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
              size={30}
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

        <div className="relative z-10 flex flex-col gap-2 py-2 pl-9 pr-3">
          {/* A real button when idle - the old role="button" tabIndex={-1}
              wrapper announced a button that keyboard users could not reach.
              Mirrors the points field just below. */}
          {isTrivia && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold leading-none">
                <HelpCircle size={10} strokeWidth={2.5} aria-hidden />
                טריוויה
              </span>
              {missingCorrectAnswer && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold leading-none text-danger-text">
                  <AlertTriangle size={10} strokeWidth={2.5} aria-hidden />
                  חסרה תשובה נכונה - לא תודפס
                </span>
              )}
              {onEditQuestion && !!options?.length && (
                <button
                  type="button"
                  onClick={onEditQuestion}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <Pencil size={9} strokeWidth={2.5} aria-hidden />
                  עריכת התשובות
                </button>
              )}
            </div>
          )}

          <div className="flex min-w-0 items-start">
            {editingName ? (
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleNameKey}
                onBlur={saveName}
                className={cn(
                  'w-full min-w-0 bg-transparent text-sm font-semibold leading-snug text-white outline-none border-0 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.5)]',
                  saving && 'opacity-50',
                )}
                disabled={saving}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                aria-label={`עריכת שם המשימה: ${name}`}
                className="w-full min-w-0 border-0 bg-transparent p-0 text-right whitespace-normal break-words text-sm font-semibold leading-snug cursor-text hover:text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
              >
                {name}
              </button>
            )}
          </div>

          {isTrivia && options && options.length > 0 && (
            /* The only place in the app that says which answer is right. Not on
               the card, not at the kiosk, not in the scan log. */
            <ul className="flex flex-col gap-0.5">
              {[...options].sort((a, b) => a.sort_order - b.sort_order).map((option) => (
                <li
                  key={option.id}
                  className={cn(
                    'flex items-center gap-1 text-[11px] leading-tight',
                    option.is_correct ? 'font-bold text-white' : 'text-white/70',
                  )}
                >
                  {option.is_correct
                    ? <Check size={10} strokeWidth={3} className="shrink-0" aria-label="התשובה הנכונה" />
                    : <span className="w-2.5 shrink-0" aria-hidden />}
                  <span className="min-w-0 break-words">{option.label}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex shrink-0 items-center">
              {editingPoints ? (
                <input
                  ref={pointsRef}
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={handlePointsKey}
                  onBlur={savePoints}
                  className={cn(
                    'w-20 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-center text-xs font-bold leading-none text-white shadow-md outline-none',
                    saving && 'opacity-50',
                  )}
                  disabled={saving}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPoints(true)}
                  className="inline-flex min-w-[5rem] cursor-text items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-bold leading-none shadow-md transition-colors hover:bg-white/60"
                >
                  <span className="text-xs leading-none" aria-hidden>⭐</span>
                  <span className="truncate tabular-nums">{pointsLabel}</span>
                </button>
              )}
            </div>
            {isTrivia ? (
              /* Not a choice to offer. Any other limit lets a participant scan
                 the second and third answer cards after getting the first one
                 wrong, which is the whole game gone. */
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-bold leading-none"
                title="לשאלת טריוויה יש ניסיון אחד - אחרת אפשר לסרוק את שלושת הכרטיסים"
              >
                ניסיון אחד
              </span>
            ) : (
              <TaskLimitSelect
                limitMode={limitMode}
                customLimit={customLimit}
                dailyWindow={dailyWindow}
                editingLimit={editingLimit}
                limitRef={limitRef}
                onSaveLimitMode={saveLimitMode}
                onSetEditingLimit={setEditingLimit}
                onSetCustomLimit={setCustomLimit}
                onResetLimit={resetLimit}
                tone="onColor"
                size="compact"
              />
            )}

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
      </div>
    </div>
  )
})
