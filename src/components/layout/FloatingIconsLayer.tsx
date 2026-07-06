import { FloatingIconsBackground } from './FloatingIconsBackground'

interface FloatingIconsLayerProps {
  className?: string
}

export function FloatingIconsLayer({ className = 'fixed inset-0 z-[2]' }: FloatingIconsLayerProps) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <FloatingIconsBackground />
    </div>
  )
}
