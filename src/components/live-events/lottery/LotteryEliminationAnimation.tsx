import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EligibleParticipant } from '../types'
import { buildEliminationTargets, shuffleInPlace } from './lotteryUtils'

interface LotteryEliminationAnimationProps {
  participants: EligibleParticipant[]
  winnerId: string
  onComplete: () => void
}

interface VisibleName {
  id: string
  name: string
  x: number
  y: number
  size: number
}

function layoutNames(list: EligibleParticipant[]): VisibleName[] {
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    x: 6 + Math.random() * 88,
    y: 8 + Math.random() * 84,
    size: 0.85 + Math.random() * 1.1,
  }))
}

export function LotteryEliminationAnimation({
  participants,
  winnerId,
  onComplete,
}: LotteryEliminationAnimationProps) {
  const [visible, setVisible] = useState<VisibleName[]>(() => layoutNames(participants))
  const remainingRef = useRef<EligibleParticipant[]>([...participants])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const targets = useMemo(() => buildEliminationTargets(participants.length), [participants.length])

  useEffect(() => {
    remainingRef.current = [...participants]
    setVisible(layoutNames(participants))

    let cancelled = false
    let stepIndex = 0

    async function run() {
      for (const target of targets) {
        if (cancelled) return
        await shrinkTo(target)
        stepIndex += 1
        // Brief pause at each milestone for suspense.
        await wait(stepIndex < targets.length ? 280 : 0)
      }
      if (!cancelled) onCompleteRef.current()
    }

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
      })
    }

    async function shrinkTo(target: number) {
      while (remainingRef.current.length > target && !cancelled) {
        const pool = remainingRef.current.filter((p) => p.id !== winnerId)
        if (pool.length === 0) break

        // Remove a burst of names when the gap is large; single drops near the end.
        const gap = remainingRef.current.length - target
        const removeCount = gap > 40 ? Math.min(8, gap) : gap > 15 ? Math.min(3, gap) : 1
        const doomed = shuffleInPlace([...pool]).slice(0, removeCount)
        const doomedIds = new Set(doomed.map((d) => d.id))

        remainingRef.current = remainingRef.current.filter((p) => !doomedIds.has(p.id))
        setVisible(layoutNames(remainingRef.current))

        const delay = remainingRef.current.length <= 8 ? 420 : remainingRef.current.length <= 30 ? 260 : 160
        await wait(delay)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [participants, winnerId, targets])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {visible.map((n) => (
          <motion.span
            key={n.id}
            className="absolute whitespace-nowrap font-bold text-foreground"
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              fontSize: `${n.size}rem`,
            }}
            initial={{ opacity: 0.85, scale: 1 }}
            animate={{ opacity: 0.9, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.4,
              filter: 'blur(6px)',
              transition: { duration: 0.35 },
            }}
            layout
          >
            {n.name}
          </motion.span>
        ))}
      </AnimatePresence>

      <motion.div
        className="pointer-events-none absolute bottom-10 left-0 right-0 text-center"
        key={visible.length}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="text-3xl font-black text-muted sm:text-4xl">
          {visible.length.toLocaleString('he-IL')}
        </span>
      </motion.div>
    </div>
  )
}
