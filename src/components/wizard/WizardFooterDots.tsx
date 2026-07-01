import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/types'
import { useWizardChrome } from './WizardChromeContext'

interface WizardFooterDotsProps {
  currentStep: number
}

export function WizardFooterDots({ currentStep }: WizardFooterDotsProps) {
  const { hiddenSteps, onStepClick } = useWizardChrome()
  const visibleSteps = WIZARD_STEPS.filter((step) => !hiddenSteps.includes(step.step))

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Wizard progress">
      {visibleSteps.map((step) => {
        const isCurrent = step.step === currentStep

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.step)}
            className={cn(
              'rounded-full transition-all',
              isCurrent ? 'h-2 w-7 bg-primary' : 'h-2 w-2 bg-border hover:bg-muted/60',
            )}
            aria-label={step.label}
            aria-current={isCurrent ? 'step' : undefined}
          />
        )
      })}
    </nav>
  )
}
