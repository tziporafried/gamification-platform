import { motion } from 'framer-motion'
import { useCountUp } from '@/hooks/useCountUp'

interface ParticipantCounterProps {
  count: number
  duration?: number
}

export function ParticipantCounter({ count, duration = 1800 }: ParticipantCounterProps) {
  const display = useCountUp(count, duration)

  return (
    <motion.div
      className="flex flex-col items-center gap-3 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <motion.p
        className="text-6xl font-black tracking-tight text-foreground sm:text-7xl md:text-8xl"
        style={{ textShadow: '0 0 40px rgba(255, 184, 0, 0.35)' }}
      >
        {display.toLocaleString('he-IL')}
      </motion.p>
      <p className="text-xl font-bold text-muted sm:text-2xl">משתתפים</p>
    </motion.div>
  )
}
