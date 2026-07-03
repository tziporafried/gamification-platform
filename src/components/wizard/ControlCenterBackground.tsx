import { useMemo, useState, useEffect } from 'react'
import {
  ScanLine,
  QrCode,
  Trophy,
  Crown,
  Star,
  Zap,
  Medal,
  Target,
  Sparkles,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface FloatingSpec {
  Icon: LucideIcon
  left: number
  top: number
  size: number
  duration: number
  delay: number
  path: {
    x: number[]
    y: number[]
    rotate: number[]
    opacity: number[]
  }
}

const ICON_POOL: LucideIcon[] = [
  ScanLine,
  QrCode,
  Trophy,
  Crown,
  Star,
  Zap,
  Medal,
  Target,
  Sparkles,
  BarChart3,
]

function sideBiasedPosition(index: number): { left: number; top: number } {
  const isLeft = index % 2 === 0
  const bandOffset = ((index * 11) % 16) + (index % 3) * 2
  const left = isLeft ? 2 + bandOffset : 80 + bandOffset
  const top = 5 + ((index * 19) % 78)
  return { left, top }
}

function buildPath(seed: number, onLeft: boolean) {
  const a = (seed % 5) + 1
  const b = ((seed * 3) % 7) + 1
  const drift = onLeft ? 1 : -1
  return {
    x: [0, (10 + a * 3) * drift, (-8 - b) * drift, 6 * drift, 0],
    y: [0, -24 - a * 3, -10 + b * 2, -30 - b, 0],
    rotate: [0, 12 + a, -10 - b, 6, 0],
    opacity: [0.22, 0.45, 0.32, 0.5, 0.22],
  }
}

export function ControlCenterBackground() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    function onChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const floats = useMemo<FloatingSpec[]>(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const { left, top } = sideBiasedPosition(i)
        const onLeft = i % 2 === 0
        return {
          Icon: ICON_POOL[i % ICON_POOL.length],
          left,
          top,
          size: 28 + (i % 4) * 10,
          duration: 11 + (i % 5) * 2.5,
          delay: (i % 6) * 0.7,
          path: buildPath(i + 1, onLeft),
        }
      }),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {floats.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-white"
          style={{ left: `${item.left}%`, top: `${item.top}%` }}
          animate={
            reducedMotion
              ? { opacity: 0.35 }
              : {
                  x: item.path.x,
                  y: item.path.y,
                  rotate: item.path.rotate,
                  opacity: item.path.opacity,
                }
          }
          transition={
            reducedMotion
              ? undefined
              : {
                  duration: item.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: item.delay,
                }
          }
        >
          <item.Icon size={item.size} strokeWidth={1.75} />
        </motion.div>
      ))}
    </div>
  )
}
