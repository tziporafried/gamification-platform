import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LOTTERY_PRE_DRAW_TIMING } from './lotteryTiming'

type Beat = '3' | '2' | '1'

interface LotteryCountdownProps {
  onNumber?: () => void
  onComplete: () => void
}

const BEATS: Beat[] = ['3', '2', '1']
const HOLD_MS = LOTTERY_PRE_DRAW_TIMING.countdown

/**
 * Large cinematic 3-2-1 countdown (before the rules summary).
 */
export function LotteryCountdown({ onNumber, onComplete }: LotteryCountdownProps) {
  const [index, setIndex] = useState(0)
  const beat = BEATS[index]!
  const onNumberRef = useRef(onNumber)
  const onCompleteRef = useRef(onComplete)
  onNumberRef.current = onNumber
  onCompleteRef.current = onComplete

  useEffect(() => {
    onNumberRef.current?.()

    const t = window.setTimeout(() => {
      if (index >= BEATS.length - 1) {
        onCompleteRef.current()
        return
      }
      setIndex((i) => i + 1)
    }, HOLD_MS)

    return () => window.clearTimeout(t)
  }, [beat, index])

  return (
    <div className="flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={beat}
          className="font-black tabular-nums text-foreground"
          style={{
            fontSize: 'clamp(5.5rem, 20vw, 11rem)',
            textShadow: '0 0 48px rgba(69,207,107,0.4)',
          }}
          initial={{ opacity: 0, scale: 0.45 }}
          animate={{ opacity: 1, scale: [0.45, 1.12, 1] }}
          exit={{ opacity: 0, scale: 1.25 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        >
          {beat}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
