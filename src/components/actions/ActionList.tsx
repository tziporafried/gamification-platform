import { useState, useEffect, useRef } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui/EmptyState'
import { UpgradeModal } from '@/components/UpgradeModal'
import { ActionForm } from './ActionForm'
import { ActionRow } from './ActionRow'
import { InlineAddAction } from './InlineAddAction'
import type { Action, ActionWithGroups, Group } from '@/types'

interface ActionListProps {
  eventId: string
  onCountChange: (count: number) => void
}

interface ActionGroupJoin {
  group_id: string
  groups: Group
}

export function ActionList({ eventId, onCountChange }: ActionListProps) {
  const [actions, setActions] = useState<ActionWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  function triggerRefresh() { setRefreshKey((k) => k + 1) }

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

  function handleEdit(action: Action) {
    setEditingAction(action)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingAction(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 mb-4 flex items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <Zap size={18} className="text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-white">משימות</h2>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mb-4 rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
      )}

      {actions.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="אין משימות עדיין"
            description="הקלד שם משימה למטה ולחץ Enter"
          />
          <div className="shrink-0">
            <InlineAddAction eventId={eventId} onAdded={triggerRefresh} onPlanLimit={() => setUpgradeOpen(true)} />
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
                onEdit={() => handleEdit(action)}
                onDeleted={triggerRefresh}
              />
            ))}
          </div>
          <div className="shrink-0 pt-2">
            <InlineAddAction eventId={eventId} onAdded={triggerRefresh} onPlanLimit={() => setUpgradeOpen(true)} />
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
    </div>
  )
}
