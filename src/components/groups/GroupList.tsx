import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { GroupForm } from './GroupForm'
import { GroupCard } from './GroupCard'
import type { GroupWithCount } from '@/types'

interface GroupListProps {
  eventId: string
  onCountChange: (count: number) => void
}

export function GroupList({ eventId, onCountChange }: GroupListProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithCount | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<GroupWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchGroups = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('groups')
      .select('*, participant_groups(count)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const mapped: GroupWithCount[] = (data ?? []).map((g) => ({
      ...g,
      member_count: (g.participant_groups as unknown as { count: number }[])?.[0]?.count ?? 0,
    }))

    setGroups(mapped)
    onCountChange(mapped.length)
    setLoading(false)
  }, [eventId, onCountChange])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  function handleEdit(group: GroupWithCount) {
    setEditingGroup(group)
    setFormOpen(true)
  }

  function handleCreate() {
    setEditingGroup(null)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingGroup(null)
  }

  async function handleDelete() {
    if (!deletingGroup) return
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', deletingGroup.id)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingGroup(null)
      return
    }

    setDeletingGroup(null)
    fetchGroups()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
        <Button size="sm" onClick={handleCreate}>Add Group</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create groups to organize your participants."
          action={<Button size="sm" onClick={handleCreate}>Add Group</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={() => handleEdit(group)}
              onDelete={() => setDeletingGroup(group)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <GroupForm
          eventId={eventId}
          group={editingGroup ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={() => { handleFormClose(); fetchGroups() }}
        />
      )}

      <Modal
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        title="Delete Group"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deletingGroup?.name}</strong>?
          All participant assignments to this group will also be removed. This action cannot be undone.
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Delete
          </Button>
          <Button variant="outline" onClick={() => setDeletingGroup(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}
