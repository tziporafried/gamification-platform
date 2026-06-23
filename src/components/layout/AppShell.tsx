import { GlobalHeader } from './GlobalHeader'
import { HeaderSlotProvider } from '@/contexts/HeaderSlotContext'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <HeaderSlotProvider>
      <div className="min-h-screen bg-game-dark">
        <GlobalHeader />
        {children}
      </div>
    </HeaderSlotProvider>
  )
}
