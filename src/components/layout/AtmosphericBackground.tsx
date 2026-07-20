import { cn } from '@/lib/utils'

/** Fixed atmospheric glow orbs - asymmetric; warm merged top wash, subtle bottom accents. */
export function AtmosphericBackground({ animated = false }: { animated?: boolean } = {}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className={cn(
          'absolute -right-8 -top-16 h-[min(70vw,36rem)] w-[min(88vw,36rem)] rounded-full blur-3xl',
          animated && 'landing-orb landing-orb-a',
        )}
        style={{ background: 'var(--atmosphere-orb-top-orange)' }}
      />
      <div
        className={cn(
          'absolute -top-28 -left-4 h-[min(54vw,26rem)] w-[min(62vw,30rem)] rounded-full blur-3xl',
          animated && 'landing-orb landing-orb-b',
        )}
        style={{ background: 'var(--atmosphere-orb-top-yellow)' }}
      />
      <div
        className={cn(
          'absolute -bottom-12 -left-8 h-[min(56vw,22rem)] w-[min(64vw,26rem)] rounded-full blur-3xl',
          animated && 'landing-orb landing-orb-c',
        )}
        style={{ background: 'var(--atmosphere-orb-bottom-left)' }}
      />
      <div
        className={cn(
          'absolute -bottom-20 right-[6%] h-[min(46vw,18rem)] w-[min(78vw,28rem)] rounded-full blur-3xl',
          animated && 'landing-orb landing-orb-d',
        )}
        style={{ background: 'var(--atmosphere-orb-bottom-right)' }}
      />
      <div
        className={cn(
          'absolute left-1/2 top-[54%] h-[min(58vw,22rem)] w-[min(72vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl',
          animated && 'landing-orb landing-orb-e',
        )}
        style={{ background: 'var(--atmosphere-orb-bottom-teal-wash)' }}
      />
    </div>
  )
}
