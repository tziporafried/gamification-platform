import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/types'
import type { WizardStepId } from '@/types'
import { useWizardChrome } from './WizardChromeContext'

export function WizardFooterDots() {
  const { hiddenSteps, currentStep, wizardState, onStepClick } = useWizardChrome()
  const visibleSteps = WIZARD_STEPS.filter((step) => !hiddenSteps.includes(step.step))

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Wizard progress">
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
              'rounded-full outline-none transition-all duration-300',
              'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus-visible:ring-offset-1',
              isCurrent &&
                'h-2 w-8 origin-center animate-wizard-step-pulse bg-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_18%,transparent)] motion-reduce:animate-none',
              !isCurrent && isCompleted && 'h-2 w-2 bg-primary/75 hover:bg-primary',
              !isCurrent &&
                !isCompleted &&
                'h-2 w-2 bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface-elevated))] hover:bg-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-surface-elevated))]',
            )}
            aria-label={step.label}
            aria-current={isCurrent ? 'step' : undefined}
          />
        )
      })}
    </nav>
  )
}
