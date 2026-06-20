import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ParticipantForm } from './ParticipantForm'
import { ParticipantRow } from './ParticipantRow'
import { CsvImportParticipantsModal } from './CsvImportParticipantsModal'
import { GroupAssignment } from '@/components/groups/GroupAssignment'
import type { ParticipantWithGroups, Participant, Group } from '@/types'

interface ParticipantListProps {
  eventId: string
  onCountChange: (count: number) => void
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

export function ParticipantList({ eventId, onCountChange }: ParticipantListProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [deletingParticipant, setDeletingParticipant] = useState<ParticipantWithGroups | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assigningParticipant, setAssigningParticipant] = useState<ParticipantWithGroups | null>(null)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const fetchParticipants = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('participants')
      .select('*, participant_groups(group_id, groups(*))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const mapped: ParticipantWithGroups[] = (data ?? []).map((p) => ({
      ...p,
      groups: ((p.participant_groups as unknown as ParticipantGroupJoin[]) ?? []).map((pg) => pg.groups),
    }))

    setParticipants(mapped)
    onCountChange(mapped.length)
    setLoading(false)
  }, [eventId, onCountChange])

  useEffect(() => { fetchParticipants() }, [fetchParticipants])

  function handleCreate() {
    setEditingParticipant(null)
    setFormOpen(true)
  }

  function handleEdit(participant: ParticipantWithGroups) {
    setEditingParticipant(participant)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingParticipant(null)
  }

  async function handleDelete() {
    if (!deletingParticipant) return
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('participants')
      .delete()
      .eq('id', deletingParticipant.id)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingParticipant(null)
      return
    }

    setDeletingParticipant(null)
    fetchParticipants()
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
        <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCsvImportOpen(true)}>Import CSV</Button>
          <Button size="sm" onClick={handleCreate}>Add Participant</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {participants.length === 0 ? (
        <EmptyState
          title="No participants yet"
          description="Add participants to your event to get started."
          action={<Button size="sm" onClick={handleCreate}>Add Participant</Button>}
        />
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              onEdit={() => handleEdit(p)}
              onDelete={() => setDeletingParticipant(p)}
              onManageGroups={() => setAssigningParticipant(p)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <ParticipantForm
          eventId={eventId}
          participant={editingParticipant ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={() => { handleFormClose(); fetchParticipants() }}
        />
      )}

      <Modal
        isOpen={!!deletingParticipant}
        onClose={() => setDeletingParticipant(null)}
        title="Delete Participant"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{deletingParticipant?.name}</strong>?
          All group assignments for this participant will also be removed. This action cannot be undone.
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Delete
          </Button>
          <Button variant="outline" onClick={() => setDeletingParticipant(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {csvImportOpen && (
        <CsvImportParticipantsModal
          eventId={eventId}
          isOpen={csvImportOpen}
          onClose={() => setCsvImportOpen(false)}
          onImported={fetchParticipants}
        />
      )}

      {assigningParticipant && (
        <GroupAssignment
          eventId={eventId}
          participantId={assigningParticipant.id}
          participantName={assigningParticipant.name}
          isOpen={!!assigningParticipant}
          onClose={() => setAssigningParticipant(null)}
          onChanged={fetchParticipants}
        />
      )}
    </div>
  )
}
