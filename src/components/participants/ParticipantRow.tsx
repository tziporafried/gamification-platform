import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import type { ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  onEdit: () => void
  onDelete: () => void
  onManageGroups: () => void
}

export function ParticipantRow({ participant, onEdit, onDelete, onManageGroups }: ParticipantRowProps) {
  const primaryGroupColor = participant.groups.length > 0 ? participant.groups[0].color : undefined

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-all duration-200 hover:shadow-card-hover">
      <AvatarCircle
        name={participant.name}
        size="md"
        ringColor={primaryGroupColor}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{participant.name}</p>
          <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
            {participant.external_id}
          </span>
        </div>
        {participant.groups.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
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
