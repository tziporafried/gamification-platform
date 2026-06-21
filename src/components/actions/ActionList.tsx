import { useState, useEffect, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ActionForm } from './ActionForm'
import { ActionRow } from './ActionRow'
import { CsvImportActionsModal } from './CsvImportActionsModal'
import type { Action } from '@/types'

interface ActionListProps {
  eventId: string
  onCountChange: (count: number) => void
}

export function ActionList({ eventId, onCountChange }: ActionListProps) {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const fetchActions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('actions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const result = (data ?? []) as Action[]
    setActions(result)
    onCountChange(result.length)
    setLoading(false)
  }, [eventId, onCountChange])

  useEffect(() => { fetchActions() }, [fetchActions])

  function handleEdit(action: Action) {
    setEditingAction(action)
    setFormOpen(true)
  }

  function handleCreate() {
    setEditingAction(null)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingAction(null)
  }

  async function handleToggleActive(action: Action) {
    const { error: updateError } = await supabase
      .from('actions')
      .update({ is_active: !action.is_active })
      .eq('id', action.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    fetchActions()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <Zap size={18} className="text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Actions</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCsvImportOpen(true)}>Import CSV</Button>
          <Button size="sm" onClick={handleCreate}>Add Action</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
      )}

      {actions.length === 0 ? (
        <EmptyState
          title="No actions yet"
          description="Create actions to define scoring rules for your event."
          action={<Button size="sm" onClick={handleCreate}>Add Action</Button>}
        />
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <ActionRow
              key={action.id}
              action={action}
              onEdit={() => handleEdit(action)}
              onToggleActive={() => handleToggleActive(action)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <ActionForm
          eventId={eventId}
          action={editingAction ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={() => { handleFormClose(); fetchActions() }}
        />
      )}

      {csvImportOpen && (
        <CsvImportActionsModal
          eventId={eventId}
          isOpen={csvImportOpen}
          onClose={() => setCsvImportOpen(false)}
          onImported={fetchActions}
        />
      )}
    </div>
  )
}
