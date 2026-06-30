import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Toast } from '@/components/ui/Toast'
import { UpgradeModal } from '@/components/UpgradeModal'
import { ActionForm } from './ActionForm'
import { ActionRow } from './ActionRow'
import { InlineAddAction } from './InlineAddAction'
import type { Action, ActionWithGroups, Group } from '@/types'

type ActionCopyVariant = 'default' | 'wizard'

interface ActionListProps {
  eventId: string
  onCountChange: (count: number) => void
  variant?: ActionCopyVariant
}

interface ActionGroupJoin {
  group_id: string
  groups: Group
}

export function ActionList({ eventId, onCountChange, variant = 'default' }: ActionListProps) {
  const [actions, setActions] = useState<ActionWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)

  const isWizard = variant === 'wizard'

  const triggerRefresh = useCallback(() => { setRefreshKey((k) => k + 1) }, [])

  const showFeedback = useCallback((message: string, feedbackVariant: 'success' | 'error') => {
    if (isWizard) setToast({ message, variant: feedbackVariant })
  }, [isWizard])

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
  }, [eventId, refreshKey])

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

  const handleWizardDeleted = useCallback((actionId: string) => {
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

  const handleInlineAdded = useCallback((action: Action) => {
    if (isWizard) {
      handleAdded(action)
    } else {
      triggerRefresh()
    }
  }, [isWizard, handleAdded, triggerRefresh])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  const existingNames = actions.map((a) => a.name)

  return (
    <div className="flex h-full flex-col">
      {!isWizard && (
        <div className="shrink-0 mb-4 flex items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
              <Zap size={18} className="text-brand-400" />
            </div>
            <h2 className="text-lg font-bold text-white">משימות</h2>
          </div>
        </div>
      )}

      {error && (
        <ErrorAlert message={error} className="shrink-0 mb-4" />
      )}

      {actions.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title={isWizard ? 'עדיין לא נוספו פעילויות' : 'אין משימות עדיין'}
            description={
              isWizard
                ? 'הוסיפו את הפעילות הראשונה שמעניקה נקודות למשתתפים'
                : 'הקלד שם משימה למטה ולחץ Enter'
            }
            action={
              isWizard ? (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.focus()}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                >
                  ➕ הוסף פעילות
                </button>
              ) : undefined
            }
          />
          <div className="shrink-0">
            <InlineAddAction
              eventId={eventId}
              onAdded={handleInlineAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              variant={variant}
              existingNames={existingNames}
              onFeedback={isWizard ? showFeedback : undefined}
              nameInputRef={addInputRef}
            />
          </div>
        </div>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                groups={groups}
                onEdit={triggerRefresh}
                onDeleted={isWizard ? () => handleWizardDeleted(action.id) : triggerRefresh}
                onUpdated={isWizard ? (patch) => handleActionPatched(action.id, patch) : undefined}
                onError={setError}
                variant={variant}
                siblingNames={existingNames.filter((n) => n !== action.name)}
              />
            ))}
          </div>
          <div className="shrink-0 pt-2">
            <InlineAddAction
              eventId={eventId}
              onAdded={handleInlineAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              variant={variant}
              existingNames={existingNames}
              onFeedback={isWizard ? showFeedback : undefined}
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
          onSaved={() => { handleFormClose(); triggerRefresh() }}
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
