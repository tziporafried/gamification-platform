import { ReactNode } from 'react'

interface GameSceneBackgroundProps {
  children: ReactNode
  className?: string
}

export function GameSceneBackground({ children, className = '' }: GameSceneBackgroundProps) {
  return (
    <div className={`relative min-h-screen bg-app-radial ${className}`}>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
