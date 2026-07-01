import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import type { Group } from '@/types'

interface RewardGroupAssignmentProps {
  eventId: string
  rewardId: string
  rewardName: string
  isOpen: boolean
  onClose: () => void
}

export function RewardGroupAssignment({ eventId, rewardId, rewardName, isOpen, onClose }: RewardGroupAssignmentProps) {
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
        .from('reward_groups')
        .select('group_id')
        .eq('reward_id', rewardId),
    ])

    setGroups(groupsRes.data ?? [])
    setAssignedIds(new Set((assignmentsRes.data ?? []).map((a) => a.group_id)))
    setLoading(false)
  }, [eventId, rewardId])

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
          .from('reward_groups')
          .delete()
          .eq('reward_id', rewardId)
          .eq('group_id', groupId)
      : await supabase
          .from('reward_groups')
          .insert({ reward_id: rewardId, group_id: groupId })

    if (error) {
      if (isAssigned) {
        next.add(groupId)
      } else {
        next.delete(groupId)
      }
      setAssignedIds(new Set(next))
    }

    setToggling(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`קבוצות עבור ${rewardName}`}>
      <p className="mb-3 text-xs text-gray-500">
        השאירו ריק כדי להפוך פרס זה לזמין לכל המשתתפים.
      </p>
      {loading ? (
        <CenteredLoader className="py-6" size="sm" />
      ) : groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          עדיין לא נוצרו קבוצות. פרס זה יהיה זמין לכל המשתתפים.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-game-border p-3 transition-colors hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={assignedIds.has(group.id)}
                onChange={() => toggle(group.id)}
                disabled={toggling === group.id}
                className="h-4 w-4 rounded border-game-border bg-game-dark text-brand-600 focus:ring-brand-500"
              />
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-sm font-medium text-gray-200">{group.name}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  )
}
