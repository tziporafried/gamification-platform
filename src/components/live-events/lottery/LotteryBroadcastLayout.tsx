import type { ReactNode } from 'react'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import { cn } from '@/lib/utils'

interface LotteryBroadcastLayoutProps {
  /** Audience-facing stage content (any future lottery state). */
  stage: ReactNode
  /** Organizer controls - docked at the bottom when visible. */
  dock?: ReactNode
  /** Hide the organizer dock (e.g. during the live lottery show). */
  hideDock?: boolean
  className?: string
}

/**
 * Lottery presentation chrome for the projector window.
 * Stage + optional organizer dock. Dock can hide during the live show.
 */
export function LotteryBroadcastLayout({
  stage,
  dock,
  hideDock = false,
  className,
}: LotteryBroadcastLayoutProps) {
  const showDock = !hideDock && dock != null

  return (
    <div
      className={cn(
        'relative flex h-[100dvh] w-full flex-col overflow-hidden',
        'bg-app-radial font-sans text-foreground atmosphere-control',
        className,
      )}
      dir="rtl"
    >
      <FloatingIconsLayer />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Presentation stage - visual focus for the audience */}
        <section
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10"
          aria-live="polite"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(69,207,107,0.1),transparent_58%)]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
            {stage}
          </div>
        </section>

        {showDock && (
          <section
            className={cn(
              'relative z-20 flex h-[176px] shrink-0 flex-col',
              'border-t border-white/50 bg-white/75',
              'shadow-[0_-12px_36px_rgba(46,34,30,0.1)] backdrop-blur-xl',
            )}
            aria-label="בקרת מארגן"
          >
            <div className="mx-auto flex h-full w-full max-w-6xl items-center px-3 sm:px-5">
              {dock}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
