import { cn } from '@/lib/utils'
import { GlobalHeader } from './GlobalHeader'
import { HeaderSlotProvider } from '@/contexts/HeaderSlotContext'
import { AtmosphericBackground } from './AtmosphericBackground'
import { FloatingIconsLayer } from './FloatingIconsLayer'

interface AppShellProps {
  children: React.ReactNode
  atmosphere?: 'default' | 'wizard' | 'dashboard' | 'control'
}

export function AppShell({ children, atmosphere = 'default' }: AppShellProps) {
  return (
    <HeaderSlotProvider>
      <div
        className={cn(
          'relative min-h-screen bg-[var(--color-background)] text-foreground',
          atmosphere === 'wizard' && 'atmosphere-wizard',
          atmosphere === 'dashboard' && 'atmosphere-dashboard bg-app-radial',
          atmosphere === 'control' && 'atmosphere-control bg-app-radial',
        )}
      >
        <AtmosphericBackground />
        <FloatingIconsLayer />
        {atmosphere === 'wizard' && (
          <div
            className="pointer-events-none fixed inset-0 z-[1]"
            style={{ background: 'var(--wizard-background-veil)' }}
            aria-hidden="true"
          />
        )}
        {/*
          Skip link (WCAG 2.4.1) - the header repeats on every route, so without
          this a keyboard user tabs through it before reaching page content.
          Off-screen until focused.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-on-primary)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          דילוג לתוכן הראשי
        </a>
        <div className="relative z-10">
          <GlobalHeader />
          {/* tabIndex={-1} so the skip link can move focus here, not just scroll. */}
          <div id="main-content" tabIndex={-1} className="focus:outline-none">
            {children}
          </div>
        </div>
      </div>
    </HeaderSlotProvider>
  )
}
