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
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive ? 'border-secondary text-foreground' : cn('border-transparent', theme.textSubtle, theme.hoverText),
              )}
            >
              {tab.icon}
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
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              isActive ? 'bg-secondary text-foreground shadow-sm' : cn(theme.textMuted, theme.hoverSurface, theme.hoverText),
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
