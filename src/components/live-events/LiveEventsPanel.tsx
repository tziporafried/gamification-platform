import { useMemo, useState } from 'react'
import { ArrowRight, Gift, Lock, Sparkles, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ControlActionCard, FloatingActionIcon } from '@/components/wizard/ControlActionCard'
import { cn } from '@/lib/utils'
import type { LiveEventKind } from './types'
import { LotteryConfigurationCard } from './lottery/LotteryConfigurationCard'

interface LiveEventsPanelProps {
  eventId: string
}

export function LiveEventsPanel({ eventId }: LiveEventsPanelProps) {
  const [activeKind, setActiveKind] = useState<LiveEventKind | null>(null)
  const cardAnim = useMemo(
    () => ({
      lotteryFloat: Math.random(),
      pulseGlow: -2.5 * Math.random(),
      gift: -(2 + 2.2 * Math.random()),
    }),
    [],
  )

  if (activeKind === 'lottery') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 font-semibold"
          onClick={() => setActiveKind(null)}
        >
          <ArrowRight size={16} />
          חזרה להפעלות בזמן אמת
        </Button>
        <LotteryConfigurationCard
          eventId={eventId}
          onStarted={() => setActiveKind(null)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col justify-center">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-text shadow-sm">
          <Zap size={28} strokeWidth={2.25} />
        </div>
        <h1
          className={cn(
            'mb-2 bg-[length:250%_100%] bg-clip-text text-2xl font-black text-transparent sm:text-3xl',
            'animate-[shimmer_8s_ease-in-out_infinite] motion-reduce:animate-none',
            '[background-image:linear-gradient(110deg,var(--color-foreground)_0%,var(--color-foreground)_38%,color-mix(in_srgb,var(--color-primary)_85%,white)_50%,var(--color-foreground)_62%,var(--color-foreground)_100%)]',
          )}
        >
          הפעלות בזמן אמת
        </h1>
        <p className="max-w-lg text-sm font-medium leading-relaxed text-muted sm:text-base">
          הפעילו הגרלות, בונוסים ואירועים מיוחדים במהלך המשחק.
        </p>
      </div>

      <div className="grid items-stretch gap-5 sm:grid-cols-3">
        <ControlActionCard
          onClick={() => setActiveKind('lottery')}
          gradient="gradient-reward-legendary"
          title="הגרלה"
          description="הגרלת פרס בין משתתפים זכאים — עם מצגת מסך מלא"
          cta="התחילו ←"
          decoration={
            <motion.div
              className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/15"
              animate={{ opacity: [0.35, 0.85, 0.35] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: cardAnim.gift }}
            />
          }
          icon={
            <FloatingActionIcon phase={cardAnim.lotteryFloat} pulsePhase={cardAnim.pulseGlow} pulse>
              <Gift size={32} className="text-white" strokeWidth={2.25} />
            </FloatingActionIcon>
          }
        />

        <ControlActionCard
          onClick={() => undefined}
          dimmed
          title="נקודות בונוס"
          description="העניקו נקודות בזמן אמת"
          cta="בקרוב"
          icon={
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 shadow-sm">
              <Zap size={28} className="text-neutral-500" strokeWidth={2.25} />
              <span className="absolute -start-1 -top-1 inline-flex items-center gap-0.5 rounded-full border border-neutral-300 bg-white px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">
                <Lock size={9} />
                בקרוב
              </span>
            </div>
          }
        />

        <ControlActionCard
          onClick={() => undefined}
          dimmed
          title="אתגר בזק"
          description="משימה מהירה לכל המשתתפים"
          cta="בקרוב"
          icon={
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 shadow-sm">
              <Sparkles size={28} className="text-neutral-500" strokeWidth={2.25} />
              <span className="absolute -start-1 -top-1 inline-flex items-center gap-0.5 rounded-full border border-neutral-300 bg-white px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">
                <Lock size={9} />
                בקרוב
              </span>
            </div>
          }
        />
      </div>
    </div>
  )
}
