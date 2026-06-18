import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Action } from '@/types'

interface ActionRowProps {
  action: Action
  onEdit: () => void
  onToggleActive: () => void
}

export function ActionRow({ action, onEdit, onToggleActive }: ActionRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm',
        !action.is_active && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
          {action.code}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{action.name}</p>
          {action.description && (
            <p className="truncate text-xs text-gray-500">{action.description}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            action.points >= 0
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700',
          )}
        >
          {action.points >= 0 ? '+' : ''}{action.points}
        </span>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleActive}
          className={action.is_active ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700' : 'text-green-600 hover:bg-green-50 hover:text-green-700'}
        >
          {action.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}
