import { cn } from '@/lib/utils'
import { GlobalHeader } from './GlobalHeader'
import { HeaderSlotProvider } from '@/contexts/HeaderSlotContext'
import { AtmosphericBackground } from './AtmosphericBackground'

interface AppShellProps {
  children: React.ReactNode
  atmosphere?: 'default' | 'wizard'
}

export function AppShell({ children, atmosphere = 'default' }: AppShellProps) {
  return (
    <HeaderSlotProvider>
      <div
        className={cn(
          'relative min-h-screen bg-[var(--color-background)] text-foreground',
          atmosphere === 'wizard' && 'atmosphere-wizard',
        )}
      >
        <AtmosphericBackground />
        {atmosphere === 'wizard' && (
          <div
            className="pointer-events-none fixed inset-0 z-[1] bg-surface/52"
            aria-hidden="true"
          />
        )}
        <div className="relative z-10">
          <GlobalHeader />
          {children}
        </div>
      </div>
    </HeaderSlotProvider>
  )
}
