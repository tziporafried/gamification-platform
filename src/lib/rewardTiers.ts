import { Crown, Gift, Sparkles, Trophy, type LucideIcon } from 'lucide-react'

export interface RewardTierConfig {
  Icon: LucideIcon
  gradient: string
  glow: string
  celebrationTitle: string
  confettiCount: number
}

export function getRewardTier(points: number): RewardTierConfig {
  if (points >= 2000) {
    return {
      Icon: Crown,
      gradient: 'gradient-reward-legendary',
      glow: '0 0 48px color-mix(in srgb, var(--color-primary) 55%, transparent), 0 0 64px color-mix(in srgb, var(--color-primary-hover) 25%, transparent)',
      celebrationTitle: '!פתיחה אגדית',
      confettiCount: 80,
    }
  }
  if (points >= 1000) {
    return {
      Icon: Trophy,
      gradient: 'gradient-reward-rich',
      glow: '0 0 36px color-mix(in srgb, var(--color-warning) 45%, transparent)',
      celebrationTitle: '!הישג נפתח',
      confettiCount: 60,
    }
  }
  if (points >= 500) {
    return {
      Icon: Sparkles,
      gradient: 'gradient-reward-medium',
      glow: '0 0 28px color-mix(in srgb, var(--color-secondary) 40%, transparent)',
      celebrationTitle: '!הישג חדש',
      confettiCount: 45,
    }
  }
  return {
    Icon: Gift,
    gradient: 'gradient-reward-starter',
    glow: '0 0 22px color-mix(in srgb, var(--color-success) 35%, transparent)',
    celebrationTitle: '!פרס חדש',
    confettiCount: 40,
  }
}
