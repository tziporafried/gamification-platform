import { ReactNode } from 'react'

interface GameSceneBackgroundProps {
  children: ReactNode
  className?: string
}

export function GameSceneBackground({ children, className = '' }: GameSceneBackgroundProps) {
  return (
    <div className={`relative min-h-screen bg-game-radial ${className}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-[20%] -left-24 h-64 w-64 rounded-full bg-brand-500/12 blur-3xl" />
        <div className="absolute bottom-[15%] right-[5%] h-56 w-56 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-96 rounded-full bg-brand-400/6 blur-3xl" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
