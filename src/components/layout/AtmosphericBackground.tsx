/** Fixed corner glow orbs — visible behind page chrome including the wizard footer. */
export function AtmosphericBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -right-24 -top-24 h-[min(72vw,30rem)] w-[min(72vw,30rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-top-right)' }}
      />
      <div
        className="absolute -left-24 -top-24 h-[min(68vw,28rem)] w-[min(68vw,28rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-top-left)' }}
      />
      <div
        className="absolute -bottom-20 -left-20 h-[min(78vw,32rem)] w-[min(78vw,32rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-bottom-left)' }}
      />
      <div
        className="absolute -bottom-20 -right-20 h-[min(78vw,32rem)] w-[min(78vw,32rem)] rounded-full blur-3xl"
        style={{ background: 'var(--atmosphere-orb-bottom-right)' }}
      />
    </div>
  )
}
