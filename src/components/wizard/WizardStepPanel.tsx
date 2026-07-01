import { cn } from '@/lib/utils'

interface WizardStepPanelProps {
  active: boolean
  children: React.ReactNode
}

export function WizardStepPanel({ active, children }: WizardStepPanelProps) {
  return (
    <div className={cn('h-full', !active && 'hidden')} aria-hidden={!active}>
      {children}
    </div>
  )
}
