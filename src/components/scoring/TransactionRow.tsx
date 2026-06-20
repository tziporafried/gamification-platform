import { Zap, Minus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { PointTransactionWithDetails } from '@/types'

interface TransactionRowProps {
  transaction: PointTransactionWithDetails
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const relativeTime = formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })
  const isPositive = transaction.points >= 0

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-card transition-all duration-200 hover:shadow-card-hover">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isPositive ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500',
        )}
      >
        {isPositive ? <Zap size={16} /> : <Minus size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {transaction.participant.name}
          <span className="ml-1.5 font-mono text-xs text-gray-400">{transaction.participant.external_id}</span>
        </p>
        <p className="truncate text-xs text-gray-500">
          {transaction.action.name}
          <span className="mx-1.5 text-gray-300">&middot;</span>
          <span className="text-gray-400">{relativeTime}</span>
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold',
          isPositive
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-red-50 text-red-600',
        )}
      >
        {isPositive ? '+' : ''}{transaction.points}
      </span>
    </div>
  )
}
