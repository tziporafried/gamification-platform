import { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Toast } from '@/components/ui/Toast'
import { UpgradeModal } from '@/components/UpgradeModal'
import { ActionForm } from './ActionForm'
import { ActionRow } from './ActionRow'
import { InlineAddAction } from './InlineAddAction'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { Action, ActionWithGroups, Group, TemplateTask } from '@/types'

interface ActionListProps {
  eventId: string
  onCountChange: (count: number) => void
}

interface ActionGroupJoin {
  group_id: string
  groups: Group
}

function LockedActionRow({ task }: { task: TemplateTask }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 opacity-50 select-none">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
        <Lock size={13} className="text-muted" />
      </div>
      <span className="flex-1 truncate text-sm text-muted">{task.name}</span>
      <span className="shrink-0 text-sm font-semibold text-muted">+{task.points}</span>
      <span className="shrink-0 rounded-full border border-warning bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
        פרמיום
      </span>
    </div>
  )
}

export function ActionList({ eventId, onCountChange }: ActionListProps) {
  const [actions, setActions] = useState<ActionWithGroups[]>([])
  const [lockedTasks, setLockedTasks] = useState<TemplateTask[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (actions.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = actions.length
  }, [actions.length])

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
    showFeedback('הפעילות עודכנה', 'success')
  }, [showFeedback])

  if (loading) {
    return <CenteredLoader />
  }

  const existingNames = actions.map((a) => a.name)
  const hasLocked = lockedTasks.length > 0

  return (
    <div className="flex h-full flex-col">
      {error && <ErrorAlert message={error} className="shrink-0 mb-4" />}

      {actions.length === 0 && !hasLocked ? (
        <div className="space-y-4">
          <EmptyState
            title="עדיין לא נוספו פעילויות"
            description="הוסיפו את הפעילות הראשונה שמעניקה נקודות למשתתפים"
            action={
              <Button size="sm" className="gap-1.5" onClick={() => addInputRef.current?.focus()}>
                <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                הוסף פעילות
              </Button>
            }
          />
          <InlineAddAction
            eventId={eventId}
            onAdded={handleAdded}
            onPlanLimit={() => setUpgradeOpen(true)}
            existingNames={existingNames}
            onFeedback={showFeedback}
            nameInputRef={addInputRef}
          />
        </div>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                groups={groups}
                onEdit={() => {}}
                onDeleted={() => handleDeleted(action.id)}
                onUpdated={(patch) => handleActionPatched(action.id, patch)}
                onError={setError}
                siblingNames={existingNames.filter((n) => n !== action.name)}
              />
            ))}

            {hasLocked && (
              <>
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                    <Lock size={10} />
                    פרמיום
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {lockedTasks.map((task) => (
                  <LockedActionRow key={task.id} task={task} />
                ))}
              </>
            )}
          </div>
          <div className="shrink-0 pt-2">
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

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

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
