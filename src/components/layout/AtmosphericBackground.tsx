/** Fixed atmospheric glow orbs — asymmetric; warm merged top wash, subtle bottom accents. */
export function AtmosphericBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -top-32 left-1/2 h-[min(58vw,30rem)] w-[min(145vw,58rem)] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-top-wash)' }}
      />
      <div
        className="absolute -bottom-12 -left-8 h-[min(56vw,22rem)] w-[min(64vw,26rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-bottom-left)' }}
      />
      <div
        className="absolute -bottom-20 -right-4 h-[min(44vw,17rem)] w-[min(44vw,17rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-bottom-right)' }}
      />
    </div>
  )
}
