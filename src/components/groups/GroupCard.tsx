import { Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { GroupWithCount } from '@/types'

interface GroupCardProps {
  group: GroupWithCount
  onEdit: () => void
  onDelete: () => void
}

export function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  return (
    <Card variant="interactive" className="overflow-hidden">
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(135deg, ${group.color}, ${group.color}cc)`,
        }}
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: group.color }}
            >
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-200">{group.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Users size={12} />
                <span>
                  {group.member_count} חברים
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>עריכה</Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:bg-red-500/10 hover:text-red-300">מחיקה</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
