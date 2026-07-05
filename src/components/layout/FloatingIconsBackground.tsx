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

type EntryMode = 'bottom' | 'left' | 'right'
type SizeTier = 'sm' | 'md' | 'lg' | 'xl'

interface FloatingMotion {
  x: (number | string)[]
  y: (number | string)[]
  rotate: number[]
  opacity: number[]
  times: number[]
}

interface FloatingSpec {
  Icon: LucideIcon
  size: number
  sizeTier: SizeTier
  duration: number
  delay: number
  phaseOffset: number
  entry: EntryMode
  originLeft?: number
  originTop?: number
  motion: FloatingMotion
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

function pickSize(index: number): { size: number; sizeTier: SizeTier } {
  const roll = index % 10
  if (roll <= 2) return { sizeTier: 'sm', size: 18 + (index % 4) * 3 }
  if (roll <= 5) return { sizeTier: 'md', size: 32 + (index % 3) * 5 }
  if (roll <= 8) return { sizeTier: 'lg', size: 54 + (index % 3) * 8 }
  return { sizeTier: 'xl', size: 76 + (index % 2) * 10 }
}

function buildBottomMotion(seed: number, driftSign: number): FloatingMotion {
  const sway = (14 + (seed % 6) * 9) * driftSign
  const rot = (seed % 2 === 0 ? 1 : -1) * (10 + (seed % 5) * 5)
  return {
    x: [0, sway, -sway * 0.85, sway * 0.65, -sway * 0.45, sway * 0.25],
    y: ['0vh', '-22vh', '-44vh', '-66vh', '-88vh', '-125vh'],
    rotate: [0, rot * 0.4, -rot * 0.55, rot * 0.45, -rot * 0.3, rot * 0.2],
    opacity: [0, 0.52, 0.46, 0.54, 0.42, 0],
    times: [0, 0.1, 0.28, 0.52, 0.78, 1],
  }
}

function buildSideMotion(seed: number, from: 'left' | 'right'): FloatingMotion {
  const inward = from === 'left' ? 1 : -1
  const sway = (18 + (seed % 5) * 10) * inward
  const wobble = (8 + (seed % 4) * 6) * -inward
  const rot = (from === 'left' ? 1 : -1) * (12 + (seed % 4) * 6)
  return {
    x: ['0vw', `${sway * 0.35}vw`, `${sway * 0.7}vw`, `${(sway + wobble) * 0.85}vw`, `${sway}vw`, `${sway + wobble * 0.5}vw`],
    y: ['0vh', '-18vh', '-38vh', '-58vh', '-82vh', '-112vh'],
    rotate: [0, rot * 0.35, -rot * 0.5, rot * 0.4, -rot * 0.25, rot * 0.15],
    opacity: [0, 0.5, 0.44, 0.52, 0.4, 0],
    times: [0, 0.12, 0.32, 0.55, 0.8, 1],
  }
}

function buildSpec(index: number): FloatingSpec {
  const seed = index + 1
  const entry: EntryMode =
    index % 7 === 0 ? 'left'
    : index % 7 === 1 ? 'right'
    : 'bottom'

  const isLeftSide = Math.random() > 0.5
  const bandOffset = ((index * 11) % 14) + (index % 3) * 2 + Math.random() * 6
  const { size, sizeTier } = pickSize(index)

  const duration = 10 + Math.random() * 10
  const delay = Math.random() * 3.5
  const phaseOffset = Math.random()

  const motion =
    entry === 'left' ? buildSideMotion(seed, 'left')
    : entry === 'right' ? buildSideMotion(seed, 'right')
    : buildBottomMotion(seed, isLeftSide ? 1 : -1)

  return {
    Icon: ICON_POOL[Math.floor(Math.random() * ICON_POOL.length)],
    size,
    sizeTier,
    duration,
    delay,
    phaseOffset,
    entry,
    originLeft: entry === 'bottom' ? (isLeftSide ? 2 + bandOffset : 72 + bandOffset) : undefined,
    originTop: entry !== 'bottom' ? 42 + Math.random() * 46 : undefined,
    motion,
  }
}

function strokeForTier(tier: SizeTier): number {
  switch (tier) {
    case 'sm': return 1.5
    case 'md': return 1.75
    case 'lg': return 2
    case 'xl': return 2.25
  }
}

function FloatingIcon({ item, reducedMotion }: { item: FloatingSpec; reducedMotion: boolean }) {
  const transition = {
    duration: item.duration,
    repeat: Infinity,
    ease: 'easeInOut' as const,
    delay: item.delay - item.duration * item.phaseOffset,
    times: item.motion.times,
  }

  const animate = reducedMotion
    ? { opacity: item.sizeTier === 'xl' || item.sizeTier === 'lg' ? 0.4 : 0.28 }
    : {
        x: item.motion.x,
        y: item.motion.y,
        rotate: item.motion.rotate,
        opacity: item.motion.opacity,
      }

  const originStyle =
    item.entry === 'left'
      ? { left: '-8%', top: `${item.originTop}%` }
      : item.entry === 'right'
        ? { right: '-8%', top: `${item.originTop}%` }
        : { left: `${item.originLeft}%`, bottom: '-12%' }

  return (
    <motion.div
      className="absolute text-white"
      style={originStyle}
      animate={animate}
      transition={reducedMotion ? undefined : transition}
    >
      <item.Icon size={item.size} strokeWidth={strokeForTier(item.sizeTier)} />
    </motion.div>
  )
}

export function FloatingIconsBackground() {
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

  const floats = useMemo(() => Array.from({ length: 20 }, (_, i) => buildSpec(i)), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {floats.map((item, i) => (
        <FloatingIcon key={i} item={item} reducedMotion={reducedMotion} />
      ))}
    </div>
  )
}
