import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/types'
import type { WizardState, WizardStepId } from '@/types'

interface WizardProgressProps {
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
}

export function WizardProgress({ currentStep, wizardState, onStepClick }: WizardProgressProps) {
  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <nav className="hidden sm:flex items-center justify-center gap-1" aria-label="Wizard progress">
        {WIZARD_STEPS.map((step, idx) => {
          const status = wizardState[step.id as WizardStepId]
          const isCurrent = step.step === currentStep
          const isCompleted = status === 'completed'

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => onStepClick(step.step)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all hover:bg-white/5',
                  isCurrent && 'bg-brand-600/20 text-white ring-1 ring-brand-500/50',
                  isCompleted && !isCurrent && 'text-emerald-400',
                  !isCompleted && !isCurrent && 'text-gray-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all',
                    isCurrent && 'bg-brand-600 text-white',
                    isCompleted && !isCurrent && 'bg-emerald-500/20 text-emerald-400',
                    !isCompleted && !isCurrent && 'bg-white/10 text-gray-500',
                  )}
                >
                  {isCompleted ? <Check size={14} /> : step.step}
                </span>
                <span className="hidden lg:inline">{step.label}</span>
              </button>

              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px w-6 transition-colors',
                    isCompleted ? 'bg-emerald-500/40' : 'bg-game-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </nav>

      {/* Mobile: compact dots */}
      <nav className="flex sm:hidden items-center justify-center gap-2 py-2" aria-label="Wizard progress">
        {WIZARD_STEPS.map((step) => {
          const status = wizardState[step.id as WizardStepId]
          const isCurrent = step.step === currentStep
          const isCompleted = status === 'completed'

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.step)}
              className={cn(
                'h-2.5 rounded-full transition-all',
                isCurrent && 'w-8 bg-brand-500',
                isCompleted && !isCurrent && 'w-2.5 bg-emerald-500',
                !isCompleted && !isCurrent && 'w-2.5 bg-gray-600',
              )}
              aria-label={step.label}
            />
          )
        })}
      </nav>

      {/* Mobile: current step label */}
      <p className="sm:hidden text-center text-sm text-gray-400 mt-1">
        {WIZARD_STEPS.find(s => s.step === currentStep)?.label}
      </p>
    </div>
  )
}
