import { Zap, Minus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { PointTransactionWithDetails } from '@/types'

interface TransactionRowProps {
  transaction: PointTransactionWithDetails
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const relativeTime = formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true, locale: he })
  const isPositive = transaction.points >= 0

  return (
    <div className="flex items-center gap-3 rounded-xl border border-game-border bg-game-card/80 px-4 py-3 transition-colors hover:bg-game-card">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
        )}
      >
        {isPositive ? <Zap size={16} /> : <Minus size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-200">
          <span className="font-medium text-white">{transaction.participant.name}</span>
          {' ביצע '}
          <span className="font-medium text-gray-300">{transaction.action.name}</span>
        </p>
        <p className="text-xs text-gray-500">
          {relativeTime}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold',
          isPositive
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-red-500/15 text-red-400',
        )}
      >
        {isPositive ? '+' : ''}{transaction.points}
      </span>
    </div>
  )
}
