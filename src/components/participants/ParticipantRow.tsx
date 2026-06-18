import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  onEdit: () => void
  onDelete: () => void
  onManageGroups: () => void
}

export function ParticipantRow({ participant, onEdit, onDelete, onManageGroups }: ParticipantRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{participant.name}</p>
          <span className="shrink-0 text-xs text-gray-400">{participant.external_id}</span>
        </div>
        {participant.email && (
          <p className="mt-0.5 text-sm text-gray-500 truncate">{participant.email}</p>
        )}
        {participant.groups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {participant.groups.map((g) => (
              <Badge key={g.id} label={g.name} color={g.color} />
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={onManageGroups}>Groups</Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>
      </div>
    </div>
  )
}
