import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { EligibleParticipant } from '../types'

interface NameCloudProps {
  participants: EligibleParticipant[]
}

interface CloudName {
  id: string
  name: string
  x: number
  y: number
  size: number
  opacity: number
  rotate: number
  duration: number
  delay: number
  driftX: number
  driftY: number
  color: string
}

const NAME_COLORS = ['#2E221E', '#AB3500', '#007D7D', '#916900', '#D42F00', '#388882']

function buildCloud(participants: EligibleParticipant[]): CloudName[] {
  const pool = participants.length <= 80
    ? participants
    : participants.filter((_, i) => i % Math.ceil(participants.length / 80) === 0).slice(0, 80)

  return pool.map((p, i) => ({
    id: p.id,
    name: p.name,
    x: 4 + Math.random() * 92,
    y: 6 + Math.random() * 88,
    size: 0.75 + Math.random() * 1.35,
    opacity: 0.4 + Math.random() * 0.5,
    rotate: -18 + Math.random() * 36,
    duration: 6 + Math.random() * 5,
    delay: (i % 12) * 0.12,
    driftX: -18 + Math.random() * 36,
    driftY: -22 + Math.random() * 44,
    color: NAME_COLORS[i % NAME_COLORS.length]!,
  }))
}

export function NameCloud({ participants }: NameCloudProps) {
  const names = useMemo(() => buildCloud(participants), [participants])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {names.map((n) => (
        <motion.span
          key={n.id}
          className="absolute whitespace-nowrap font-bold"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            fontSize: `${n.size}rem`,
            color: n.color,
            opacity: n.opacity,
          }}
          initial={{ opacity: 0, scale: 0.6, rotate: n.rotate }}
          animate={{
            opacity: [n.opacity * 0.5, n.opacity, n.opacity * 0.7, n.opacity],
            x: [0, n.driftX, -n.driftX * 0.5, 0],
            y: [0, n.driftY, n.driftY * 0.4, 0],
            rotate: [n.rotate, n.rotate + 6, n.rotate - 4, n.rotate],
            scale: [1, 1.04, 0.98, 1],
          }}
          transition={{
            duration: n.duration,
            delay: n.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {n.name}
        </motion.span>
      ))}
    </div>
  )
}
