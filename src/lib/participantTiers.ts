import {
  Contact,
  User,
  UserCircle,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** Participant card hue — translucent warning gold from palette */
export const PARTICIPANT_CARD_GRADIENT = 'gradient-participant-card'

const PARTICIPANT_ICONS: LucideIcon[] = [
  Users,
  User,
  UserCircle,
  UserPlus,
  Contact,
]

export function getParticipantIcon(participantId: string): LucideIcon {
  let hash = 0
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) >>> 0
  }
  return PARTICIPANT_ICONS[hash % PARTICIPANT_ICONS.length]
}

export function getParticipantIconMotion(participantId: string) {
  let hash = 0
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) >>> 0
  }

  return {
    animationDelay: `${(hash % 10) * 0.14}s`,
    animationDuration: `${2.6 + (hash % 6) * 0.15}s`,
  }
}
