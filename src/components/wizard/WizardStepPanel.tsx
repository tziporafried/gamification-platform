import { cn } from '@/lib/utils'

interface WizardStepPanelProps {
  active: boolean
  children: React.ReactNode
}

export function WizardStepPanel({ active, children }: WizardStepPanelProps) {
  return (
    <div className={cn(!active && 'hidden')} aria-hidden={!active}>
      {children}
    </div>
  )
}
