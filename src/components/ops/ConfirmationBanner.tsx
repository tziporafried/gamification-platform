import { motion } from 'framer-motion'
import { CheckCircle2, Flame } from 'lucide-react'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

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

export function ConfirmationBanner({ confirmation, accent }: Props) {
  if (!confirmation) return null

  const { name, points, bonus, mult } = confirmation
  const sign = points >= 0 ? '+' : ''

  return (
    <motion.div
      className="w-full max-w-sm rounded-2xl px-4 py-3 flex items-center gap-3"
      style={bonus
        ? {
          background: 'linear-gradient(135deg, rgba(30,12,0,0.95), rgba(20,8,0,0.95))',
          border: '1px solid rgba(249,115,22,0.5)',
          boxShadow: '0 0 20px rgba(249,115,22,0.2)',
        }
        : {
          background: `linear-gradient(135deg, rgba(0,20,10,0.95), rgba(0,15,8,0.95))`,
          border: `1px solid ${rgba(accent, 0.45)}`,
          boxShadow: `0 0 20px ${rgba(accent, 0.15)}`,
        }
      }
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0 }}
      transition={{ duration: 0.25 }}>

      {bonus
        ? <Flame size={20} className="shrink-0 text-orange-400" />
        : <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
      }

      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-black text-white truncate">
          {bonus ? `🔥 ${mult} בונוס! ` : ''}{sign}{points} נק׳ ל{name}
        </p>
        {bonus && (
          <p className="text-[11px] text-orange-300/80">נקודות בונוס נרשמו</p>
        )}
      </div>
    </motion.div>
  )
}
