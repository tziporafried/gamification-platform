import { GlobalHeader } from './GlobalHeader'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-game-dark">
      <GlobalHeader />
      {children}
    </div>
  )
}
