import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Action } from '@/types'

interface ActionRowProps {
  action: Action
  onEdit: () => void
  onToggleActive: () => void
}

export function ActionRow({ action, onEdit, onToggleActive }: ActionRowProps) {
  const isPositive = action.points >= 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-game-card px-4 py-3 transition-all duration-200 hover:border-brand-700/50',
        !action.is_active && 'opacity-50',
        isPositive ? 'border-game-border' : 'border-red-500/20',
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
          isPositive
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-red-500/15 text-red-400',
        )}
      >
        {isPositive ? '+' : ''}{action.points}
      </div>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-200">{action.name}</p>
            <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
              {action.code}
            </span>
            {!action.is_active && (
              <span className="shrink-0 rounded-full bg-gray-600/50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                Inactive
              </span>
            )}
          </div>
          {action.description && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{action.description}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleActive}
          className={action.is_active ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300' : 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'}
        >
          {action.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}
