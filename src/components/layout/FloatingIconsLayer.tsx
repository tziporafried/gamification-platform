import { isFloatingIconsEnabled, type FloatingIconsPageId } from '@/lib/floatingIconsPages'
import { FloatingIconsBackground } from './FloatingIconsBackground'

interface FloatingIconsLayerProps {
  pageId: FloatingIconsPageId
  className?: string
}

export function FloatingIconsLayer({ pageId, className = 'fixed inset-0 z-[2]' }: FloatingIconsLayerProps) {
  if (!isFloatingIconsEnabled(pageId)) return null

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <FloatingIconsBackground />
    </div>
  )
}
