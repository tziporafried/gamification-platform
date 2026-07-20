import {
  Award,
  CheckSquare,
  Flag,
  Flame,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Single task-card hue - palette secondary turquoise */
export const ACTION_CARD_GRADIENT = 'gradient-action-card'

const ACTION_ICONS: LucideIcon[] = [
  CheckSquare,
  Zap,
  Star,
  Sparkles,
  Target,
  Trophy,
  Flag,
  Rocket,
  Award,
  Flame,
]

export function getActionIcon(actionId: string): LucideIcon {
  let hash = 0
  for (let i = 0; i < actionId.length; i++) {
    hash = (hash * 31 + actionId.charCodeAt(i)) >>> 0
  }
  return ACTION_ICONS[hash % ACTION_ICONS.length]
}

export function getActionIconMotion(actionId: string) {
  let hash = 0
  for (let i = 0; i < actionId.length; i++) {
    hash = (hash * 31 + actionId.charCodeAt(i)) >>> 0
  }

  return {
    animationDelay: `${(hash % 10) * 0.38}s`,
    animationDuration: `${3.5 + (hash % 6) * 0.3}s`,
  }
}

/** Per-card horizontal placement - left edge, small px jitter, slight outward clip */
export function getActionIconPlacement(actionId: string) {
  let hash = 0
  for (let i = 0; i < actionId.length; i++) {
    hash = (hash * 31 + actionId.charCodeAt(i)) >>> 0
  }

  const leftPx = 10 + (hash % 5) * 2
  const bleedPx = hash % 3 === 0 ? -(8 + (hash % 4) * 3) : 0

  return {
    left: `${leftPx}px`,
    translateX: `${bleedPx}px`,
  }
}
