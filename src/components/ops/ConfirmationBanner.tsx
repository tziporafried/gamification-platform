import { motion } from 'framer-motion'
import { CheckCircle2, Flame } from 'lucide-react'
import type { AccentRgb } from '@/lib/accentColor'
import { cn } from '@/lib/utils'

export interface ConfirmationData {
  name: string
  points: number
  bonus: boolean
  mult: string
}

interface Props {
  confirmation: ConfirmationData | null
  accent: AccentRgb
}

export function ConfirmationBanner({ confirmation, accent: _accent }: Props) {
  if (!confirmation) return null

  const { name, points, bonus, mult } = confirmation
  const sign = points >= 0 ? '+' : ''

  return (
    <motion.div
      className={cn(
        'w-full max-w-sm rounded-2xl px-4 py-3 flex items-center gap-3 border bg-surface-elevated shadow-card',
        bonus ? 'border-warning' : 'border-success',
      )}
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0 }}
      transition={{ duration: 0.25 }}>

      {bonus
        ? <Flame size={20} className="shrink-0 text-warning" />
        : <CheckCircle2 size={20} className="shrink-0 text-success" />
      }

      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-black text-foreground truncate">
          {bonus ? `🔥 ${mult} בונוס! ` : ''}{sign}{points} נק׳ ל{name}
        </p>
        {bonus && (
          <p className="text-[11px] text-warning">נקודות בונוס נרשמו</p>
        )}
      </div>
    </motion.div>
  )
}
