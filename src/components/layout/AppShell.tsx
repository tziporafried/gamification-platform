import { GlobalHeader } from './GlobalHeader'
import { HeaderSlotProvider } from '@/contexts/HeaderSlotContext'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <HeaderSlotProvider>
      <div className="min-h-screen bg-app-radial text-foreground">
        <GlobalHeader />
        {children}
      </div>
    </HeaderSlotProvider>
  )
}
