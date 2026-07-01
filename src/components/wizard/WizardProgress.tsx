import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/types'
import type { WizardState, WizardStepId } from '@/types'

interface WizardProgressProps {
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  hiddenSteps?: number[]
}

export function WizardProgress({ currentStep, wizardState, onStepClick, hiddenSteps = [] }: WizardProgressProps) {
  const visibleSteps = WIZARD_STEPS.filter((step) => !hiddenSteps.includes(step.step))

  return (
    <nav className="hidden w-full items-start sm:flex" aria-label="Wizard progress">
      {visibleSteps.map((step) => {
        const status = wizardState[step.id as WizardStepId]
        const isCurrent = step.step === currentStep
        const isCompleted = status === 'completed'

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.step)}
            aria-current={isCurrent ? 'step' : undefined}
            title={step.label}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center rounded-xl px-0.5 py-1.5 text-primary outline-none transition-all duration-200',
              'focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] focus-visible:ring-offset-1',
              isCurrent ? 'hover:opacity-100' : 'hover:opacity-80',
            )}
          >
            <span className="flex min-h-[4rem] w-full items-center justify-center">
              <span
                className={cn(
                  'flex flex-col items-center gap-2',
                  isCurrent && 'origin-center animate-wizard-step-pulse motion-reduce:animate-none',
                )}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-200',
                    isCompleted &&
                      !isCurrent &&
                      'h-7 w-7 bg-primary text-primary-foreground shadow-[0_1px_5px_rgba(171,53,0,0.18)]',
                    isCurrent &&
                      'h-8 w-8 bg-primary text-sm text-primary-foreground shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_16%,transparent),0_2px_10px_rgba(171,53,0,0.28)]',
                    !isCompleted &&
                      !isCurrent &&
                      'h-7 w-7 border border-border/70 bg-surface text-[11px] text-muted/75',
                  )}
                >
                  {isCompleted && !isCurrent ? <Check size={12} strokeWidth={3} /> : step.step}
                </span>
                <span
                  className={cn(
                    'line-clamp-2 w-full text-center leading-snug text-primary transition-opacity duration-200',
                    isCurrent
                      ? 'text-xs font-bold sm:text-sm'
                      : isCompleted
                        ? 'text-[10px] font-semibold opacity-80 sm:text-[11px]'
                        : 'text-[10px] font-semibold opacity-50 sm:text-[11px]',
                  )}
                >
                  {step.label}
                </span>
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
