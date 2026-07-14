import { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Plus, CheckSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Toast } from '@/components/ui/Toast'
import { TruncatedTooltipText } from '@/components/ui/Tooltip'
import { UpgradeModal } from '@/components/UpgradeModal'
import { ActionForm } from './ActionForm'
import { ActionRow } from './ActionRow'
import { InlineAddAction } from './InlineAddAction'
import { ScrollableListLayout } from '@/components/ui/ScrollableListLayout'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { Action, ActionWithGroups, Group, GroupType, TemplateTask } from '@/types'

interface ActionListProps {
  eventId: string
  onCountChange: (count: number) => void
  /** Wizard step: list scrolls in parent; usage bar shares the same scroll width. */
  embedded?: boolean
  /** Wizard: hide group assignments when competition is individual. */
  groupType?: GroupType | null
  /** Wizard: refetch groups when the count changes (e.g. after deleting all groups). */
  groupCount?: number
}

interface ActionGroupJoin {
  group_id: string
  groups: Group
}

function LockedActionCard({ task }: { task: TemplateTask }) {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl bg-surface opacity-50 shadow-card select-none">
        <div className="relative z-10 flex flex-col gap-1 px-3 py-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <TruncatedTooltipText
              text={task.name}
              className="truncate text-sm font-semibold leading-tight text-muted"
            />
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated">
              <Lock size={11} className="text-muted" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[11px] font-bold leading-none text-muted">
              <span className="text-[11px] leading-none" aria-hidden>⭐</span>
              +{task.points.toLocaleString()} נק׳
            </span>
            <span className="inline-flex w-fit rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted">
              זמין באפשרויות הפעלה
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ActionList({ eventId, onCountChange, embedded = false, groupType, groupCount }: ActionListProps) {
  const [actions, setActions] = useState<ActionWithGroups[]>([])
  const [lockedTasks, setLockedTasks] = useState<TemplateTask[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputFocusRequest, setAddInputFocusRequest] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)

  function revealAddInput() {
    setShowAddInput(true)
    setAddInputFocusRequest((n) => n + 1)
  }

  const showFeedback = useCallback((message: string, feedbackVariant: 'success' | 'error') => {
    setToast({ message, variant: feedbackVariant })
  }, [])

  useEffect(() => {
    function syncLocked() {
      setLockedTasks(getLockedTemplate(eventId)?.tasks ?? [])
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [eventId])

  useEffect(() => {
    async function fetchActions() {
      const [actionsRes, groupsRes] = await Promise.all([
        supabase
          .from('actions')
          .select('*, action_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        supabase
          .from('groups')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
      ])

      let actionsData = actionsRes.data
      if (actionsRes.error) {
        const fallback = await supabase
          .from('actions')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
        actionsData = fallback.data
        if (fallback.error) {
          setError(fallback.error.message)
          setLoading(false)
          return
        }
      }

      const mapped: ActionWithGroups[] = (actionsData ?? []).map((a) => ({
        ...a,
        groups: ((a.action_groups as unknown as ActionGroupJoin[]) ?? []).map((ag) => ag.groups),
      }))

      setActions(mapped)
      setGroups((groupsRes.data as Group[]) ?? [])
      setError('')
      onCountChange(mapped.length)
      setLoading(false)
    }
    fetchActions()
  }, [eventId])

  const hasGroups = groupType !== 'none' && (groupCount ?? 1) > 0

  useEffect(() => {
    if (!hasGroups) {
      setGroups([])
      setActions((prev) => prev.map((a) => (a.groups.length > 0 ? { ...a, groups: [] } : a)))
      return
    }

    let cancelled = false

    async function refreshGroups() {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (!cancelled) setGroups((data as Group[]) ?? [])
    }

    refreshGroups()
    return () => { cancelled = true }
  }, [eventId, hasGroups, groupCount])

  useEffect(() => {
    if (actions.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = actions.length
  }, [actions.length])

  useEffect(() => {
    if (actions.length === 0) {
      setShowAddInput(false)
    }
  }, [actions.length])

  useEffect(() => {
    if (showAddInput) {
      addInputRef.current?.focus()
    }
  }, [showAddInput, addInputFocusRequest])

  const handleFormClose = useCallback(() => {
    setFormOpen(false)
    setEditingAction(null)
  }, [])

  const handleAdded = useCallback((action: Action) => {
    setActions((prev) => {
      const next = [...prev, { ...action, groups: [] }]
      onCountChange(next.length)
      return next
    })
  }, [onCountChange])

  const handleDeleted = useCallback((actionId: string) => {
    setActions((prev) => {
      const next = prev.filter((a) => a.id !== actionId)
      onCountChange(next.length)
      return next
    })
  }, [onCountChange])

  const handleActionPatched = useCallback((actionId: string, patch: Partial<ActionWithGroups>) => {
    setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, ...patch } : a)))
  }, [])

  if (loading) {
    return <CenteredLoader />
  }

  const existingNames = actions.map((a) => a.name)
  const hasLocked = lockedTasks.length > 0

  const actionList = actions.length > 0 && (
    <div className="space-y-1 px-1 py-0.5">
      {actions.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          groups={hasGroups ? groups : []}
          onEdit={() => {}}
          onDeleted={() => handleDeleted(action.id)}
          onUpdated={(patch) => handleActionPatched(action.id, patch)}
          onError={setError}
          siblingNames={existingNames.filter((n) => n !== action.name)}
        />
      ))}
    </div>
  )

  const lockedList = hasLocked && (
    <div className="space-y-1 px-1 py-0.5">
      {lockedTasks.map((task) => (
        <LockedActionCard key={task.id} task={task} />
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {error && <ErrorAlert message={error} className="shrink-0 mb-4" />}

      {actions.length === 0 && !hasLocked ? (
        embedded ? (
          <ScrollableListLayout
            className="flex-1 min-h-0"
            listRef={listRef}
            footer={
              showAddInput ? (
                <InlineAddAction
                  eventId={eventId}
                  onAdded={handleAdded}
                  onPlanLimit={() => setUpgradeOpen(true)}
                  existingNames={existingNames}
                  onFeedback={showFeedback}
                  nameInputRef={addInputRef}
                />
              ) : undefined
            }
          >
            <EmptyState
              icon={<CheckSquare size={32} strokeWidth={1.75} />}
              title="עדיין לא הוספתם פעילויות"
              description="כל פעילות שתיצרו היא דרך נוספת עבור המשתתפים לצבור נקודות ולהתקדם במשחק."
              action={
                <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
                  <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                  הוסף פעילות
                </Button>
              }
            />
          </ScrollableListLayout>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
              <EmptyState
                icon={<CheckSquare size={32} strokeWidth={1.75} />}
                title="עדיין לא הוספתם פעילויות"
                description="כל פעילות שתיצרו היא דרך נוספת עבור המשתתפים לצבור נקודות ולהתקדם במשחק."
                action={
                  <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
                    <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                    הוסף פעילות
                  </Button>
                }
              />
            </div>
            {showAddInput && (
              <div className="shrink-0">
                <InlineAddAction
                  eventId={eventId}
                  onAdded={handleAdded}
                  onPlanLimit={() => setUpgradeOpen(true)}
                  existingNames={existingNames}
                  onFeedback={showFeedback}
                  nameInputRef={addInputRef}
                />
              </div>
            )}
          </div>
        )
      ) : embedded ? (
        <ScrollableListLayout
          className="flex-1 min-h-0"
          listRef={listRef}
          listClassName="space-y-1"
          footer={
            <InlineAddAction
              eventId={eventId}
              onAdded={handleAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              existingNames={existingNames}
              onFeedback={showFeedback}
              nameInputRef={addInputRef}
            />
          }
        >
          {actionList}
          {lockedList}
        </ScrollableListLayout>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {actionList}
            {lockedList}
          </div>
          <div className="shrink-0">
            <InlineAddAction
              eventId={eventId}
              onAdded={handleAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              existingNames={existingNames}
              onFeedback={showFeedback}
              nameInputRef={addInputRef}
            />
          </div>
        </>
      )}

      {formOpen && (
        <ActionForm
          eventId={eventId}
          action={editingAction ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={handleFormClose}
        />
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
