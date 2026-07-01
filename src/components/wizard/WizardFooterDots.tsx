import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/types'
import type { WizardStepId } from '@/types'
import { useWizardChrome } from './WizardChromeContext'

export function WizardFooterDots() {
  const { hiddenSteps, currentStep, wizardState, onStepClick } = useWizardChrome()
  const visibleSteps = WIZARD_STEPS.filter((step) => !hiddenSteps.includes(step.step))

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Wizard progress">
      {visibleSteps.map((step) => {
        const status = wizardState[step.id as WizardStepId]
        const isCurrent = step.step === currentStep
        const isCompleted = status === 'completed'

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.step)}
            className={cn(
              'flex items-center justify-center outline-none',
              'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus-visible:ring-offset-1',
              isCurrent ? 'h-2.5 w-7' : 'h-2.5 w-2.5',
              !isCurrent && isCompleted && 'rounded-full bg-primary',
              !isCurrent && !isCompleted && 'rounded-full bg-border hover:bg-muted/60',
            )}
            aria-label={step.label}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {isCurrent && (
              <span className="block h-2 w-7 origin-center animate-wizard-step-pulse rounded-full bg-primary motion-reduce:animate-none" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
