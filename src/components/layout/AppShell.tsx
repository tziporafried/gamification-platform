import { GlobalHeader } from './GlobalHeader'
import { HeaderSlotProvider } from '@/contexts/HeaderSlotContext'
import { AtmosphericBackground } from './AtmosphericBackground'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <HeaderSlotProvider>
      <div className="relative min-h-screen bg-[var(--color-background)] text-foreground">
        <AtmosphericBackground />
        <div className="relative z-10">
          <GlobalHeader />
          {children}
        </div>
      </div>
    </HeaderSlotProvider>
  )
}
