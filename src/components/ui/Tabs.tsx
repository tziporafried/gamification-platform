import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  variant?: 'pill' | 'underline'
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, variant = 'pill', className }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-1 border-b mb-6', theme.border, className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              // Selected state was conveyed by colour alone. aria-pressed suits a
              // group of toggle buttons; a full role="tablist" would also need
              // aria-controls and a matching role="tabpanel", which the panels
              // these drive do not have.
              aria-pressed={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                theme.focusRing,
                isActive ? 'border-secondary text-foreground' : cn('border-transparent', theme.textSubtle, theme.hoverText),
              )}
            >
              <span aria-hidden="true" className="contents">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-1 rounded-xl border p-1 bg-surface/50', theme.border, className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              theme.focusRing,
              isActive ? 'bg-secondary text-foreground shadow-sm' : cn(theme.textMuted, theme.hoverSurface, theme.hoverText),
            )}
          >
            <span aria-hidden="true" className="contents">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
