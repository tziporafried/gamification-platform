import { cn } from '@/lib/utils'

interface WizardStepPanelProps {
  active: boolean
  children: React.ReactNode
}

export function WizardStepPanel({ active, children }: WizardStepPanelProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', !active && 'hidden')}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}
