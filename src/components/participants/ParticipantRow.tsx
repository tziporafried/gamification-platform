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
    <div className="flex items-center gap-3 rounded-xl border border-game-border bg-game-card p-4 transition-all duration-200 hover:border-brand-700/50">
      <AvatarCircle
        name={participant.name}
        size="md"
        ringColor={primaryGroupColor}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-200 truncate">{participant.name}</p>
          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
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
        <Button variant="ghost" size="sm" onClick={onManageGroups}>קבוצות</Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>עריכה</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:bg-red-500/10 hover:text-red-300">מחיקה</Button>
      </div>
    </div>
  )
}
