import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import type { AccentRgb } from '@/lib/accentColor'

export interface ConfirmationData {
  name: string
  points: number
}

interface Props {
  confirmation: ConfirmationData | null
  accent: AccentRgb
}

export function ConfirmationBanner({ confirmation, accent: _accent }: Props) {
  if (!confirmation) return null

  const { name, points } = confirmation
  const sign = points >= 0 ? '+' : ''

  return (
    <motion.div
      className="w-full max-w-sm rounded-2xl px-4 py-3 flex items-center gap-3 border border-success bg-surface-elevated shadow-card"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0 }}
      transition={{ duration: 0.25 }}>

      <CheckCircle2 size={20} className="shrink-0 text-success" />

      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-black text-foreground truncate">
          {sign}{points} נק׳ ל{name}
        </p>
      </div>
    </motion.div>
  )
}
