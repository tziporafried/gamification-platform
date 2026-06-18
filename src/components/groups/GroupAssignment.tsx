import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import type { Group } from '@/types'

interface GroupAssignmentProps {
  eventId: string
  participantId: string
  participantName: string
  isOpen: boolean
  onClose: () => void
  onChanged: () => void
}

export function GroupAssignment({ eventId, participantId, participantName, isOpen, onClose, onChanged }: GroupAssignmentProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [groupsRes, assignmentsRes] = await Promise.all([
      supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('name'),
      supabase
        .from('participant_groups')
        .select('group_id')
        .eq('participant_id', participantId),
    ])

    setGroups(groupsRes.data ?? [])
    setAssignedIds(new Set((assignmentsRes.data ?? []).map((a) => a.group_id)))
    setLoading(false)
  }, [eventId, participantId])

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchData()
    }
  }, [isOpen, fetchData])

  async function toggle(groupId: string) {
    const isAssigned = assignedIds.has(groupId)
    setToggling(groupId)

    const next = new Set(assignedIds)
    if (isAssigned) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    setAssignedIds(next)

    const { error } = isAssigned
      ? await supabase
          .from('participant_groups')
          .delete()
          .eq('participant_id', participantId)
          .eq('group_id', groupId)
      : await supabase
          .from('participant_groups')
          .insert({ participant_id: participantId, group_id: groupId })

    if (error) {
      // rollback
      if (isAssigned) {
        next.add(groupId)
      } else {
        next.delete(groupId)
      }
      setAssignedIds(new Set(next))
    } else {
      onChanged()
    }

    setToggling(null)
  }

  function handleClose() {
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Groups for ${participantName}`}>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          No groups created yet. Create groups first to assign participants.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={assignedIds.has(group.id)}
                onChange={() => toggle(group.id)}
                disabled={toggling === group.id}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-sm font-medium text-gray-900">{group.name}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  )
}
