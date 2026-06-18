import { cn } from '@/lib/utils'
import type { PointTransactionWithDetails } from '@/types'

interface TransactionRowProps {
  transaction: PointTransactionWithDetails
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const time = new Date(transaction.created_at).toLocaleString()

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">
          {transaction.participant.name}
          <span className="ml-1 text-xs text-gray-500">({transaction.participant.external_id})</span>
        </p>
        <p className="truncate text-xs text-gray-500">
          {transaction.action.name}
          <span className="ml-1 font-mono">({transaction.action.code})</span>
          <span className="mx-1">&middot;</span>
          {time}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
          transaction.points >= 0
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700',
        )}
      >
        {transaction.points >= 0 ? '+' : ''}{transaction.points}
      </span>
    </div>
  )
}
