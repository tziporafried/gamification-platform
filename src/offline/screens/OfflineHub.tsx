import { useMemo } from 'react'
import { Crown, ScanLine, Trophy, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { ControlActionCard, FloatingActionIcon } from '@/components/wizard/ControlActionCard'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import type { GamePack } from '@/lib/offline/types'

interface OfflineHubProps {
  pack: GamePack
  onScan: () => void
  onBoard: () => void
}

/**
 * Landing screen: the two ways into a running offline game.
 *
 * Deliberately mirrors the online control center — same background, title and
 * ControlActionCards — so the exported file opens on the screen the operator
 * already knows. The settings card and readiness checklist are left out: an
 * exported game can't be edited.
 */
export function OfflineHub({ pack, onScan, onBoard }: OfflineHubProps) {
  // Desynchronised animation phases, exactly as the control center does it, so
  // the two cards never float in lockstep.
  const cardAnim = useMemo(() => ({
    kioskFloat: Math.random(),
    displayFloat: Math.random(),
    scanLine: -3 * Math.random(),
    borderPulse: -3 * Math.random(),
    crown: -(2.2 + 2.5 * Math.random()),
    pulseGlow: -2.5 * Math.random(),
  }), [])

  return (
    <div className="relative min-h-screen overflow-y-auto bg-app-radial" dir="rtl">
      <FloatingIconsLayer />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-8">
        <motion.div className="mb-14 flex shrink-0 flex-col items-center text-center" initial={false}>
          {pack.event.logo_url && (
            <img
              src={pack.event.logo_url}
              alt={pack.event.name}
              className="mb-3 h-16 w-16 rounded-2xl border border-border object-cover shadow-card"
            />
          )}

          <h1
            className={
              'mb-1.5 bg-[length:250%_100%] bg-clip-text text-2xl font-black text-transparent sm:text-3xl ' +
              'animate-[shimmer_8s_ease-in-out_infinite] motion-reduce:animate-none ' +
              '[background-image:linear-gradient(110deg,var(--color-foreground)_0%,var(--color-foreground)_38%,color-mix(in_srgb,var(--color-primary)_85%,white)_50%,var(--color-foreground)_62%,var(--color-foreground)_100%)]'
            }
          >
            {pack.event.name}
          </h1>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 px-4 py-1.5 text-sm font-bold text-secondary">
            <WifiOff size={15} strokeWidth={2.5} />
            מצב לא מקוון
          </div>
        </motion.div>

        <div className="grid shrink-0 items-stretch gap-5 sm:grid-cols-2">
          {/* `contents` keeps the button itself the grid item; the wrapper only
              carries a stable hook for scripts/shoot.mjs and verify-offline-player.mjs. */}
          <div className="contents" data-hub-action="scan">
          <ControlActionCard
            onClick={onScan}
            gradient="gradient-reward-legendary"
            title="🔥 שחקו בלי להפסיק"
            description="סרקו משימות וצברו נקודות"
            cta="פתח ←"
            decoration={
              <motion.div
                className="pointer-events-none absolute left-6 right-6 z-10 h-[2px] bg-white/35"
                animate={{ top: ['18%', '82%', '18%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: cardAnim.scanLine }}
              />
            }
            icon={
              <FloatingActionIcon phase={cardAnim.kioskFloat} pulsePhase={cardAnim.pulseGlow} pulse>
                <ScanLine size={32} className="text-white" strokeWidth={2.25} />
              </FloatingActionIcon>
            }
          />
          </div>

          <div className="contents" data-hub-action="board">
          <ControlActionCard
            onClick={onBoard}
            gradient="gradient-reward-rich"
            title="שיאים"
            description="צפו בדירוג המתעדכן בזמן אמת"
            cta="צפו בדירוג ←"
            decoration={
              <motion.div
                className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/20"
                animate={{ boxShadow: [
                  '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  '0 0 0 6px color-mix(in srgb, white 14%, transparent)',
                  '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                ] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: cardAnim.borderPulse }}
              />
            }
            icon={
              <FloatingActionIcon phase={cardAnim.displayFloat} pulsePhase={cardAnim.pulseGlow} pulse>
                <div className="relative">
                  <Trophy size={32} className="text-white" strokeWidth={2.25} />
                  <motion.div
                    className="absolute -left-2 -top-2"
                    animate={{ rotate: [0, -12, 12, 0], y: [0, -3, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.5, delay: cardAnim.crown }}
                  >
                    <Crown size={18} className="text-white/90" strokeWidth={2.25} />
                  </motion.div>
                </div>
              </FloatingActionIcon>
            }
          />
          </div>
        </div>
      </main>
    </div>
  )
}
