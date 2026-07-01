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
    <div className="w-full">
      <nav className="hidden sm:flex items-center justify-between" aria-label="Wizard progress">
        {visibleSteps.map((step, idx) => {
          const status = wizardState[step.id as WizardStepId]
          const isCurrent = step.step === currentStep
          const isCompleted = status === 'completed'

          return (
            <div key={step.id} className="flex items-center">
              {isCompleted ? (
                <button
                  onClick={() => onStepClick(step.step)}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check size={9} />
                  </span>
                  {step.label}
                </button>
              ) : isCurrent ? (
                <button
                  onClick={() => onStepClick(step.step)}
                  className="flex items-center gap-1.5 rounded-full bg-brand-600/20 px-3 py-1 text-xs font-semibold text-white ring-1 ring-brand-500/40"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold">
                    {step.step}
                  </span>
                  {step.label}
                </button>
              ) : (
                <button
                  onClick={() => onStepClick(step.step)}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:text-gray-400"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold">
                    {step.step}
                  </span>
                  {step.label}
                </button>
              )}

              {idx < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px w-3 shrink-0 transition-colors',
                    isCompleted ? 'bg-emerald-500/30' : 'bg-white/10',
                  )}
                />
              )}
            </div>
          )
        })}
      </nav>

      <nav className="flex sm:hidden items-center justify-center gap-1.5 py-1" aria-label="Wizard progress">
        {visibleSteps.map((step) => {
          const status = wizardState[step.id as WizardStepId]
          const isCurrent = step.step === currentStep
          const isCompleted = status === 'completed'

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.step)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                isCurrent && 'w-6 bg-brand-500',
                isCompleted && !isCurrent && 'w-1.5 bg-white/30',
                !isCompleted && !isCurrent && 'w-1.5 bg-white/10',
              )}
              aria-label={step.label}
            />
          )
        })}
      </nav>

      <p className="sm:hidden text-center text-xs text-gray-500 mt-0.5">
        {visibleSteps.find(s => s.step === currentStep)?.label ?? WIZARD_STEPS.find(s => s.step === currentStep)?.label}
      </p>
    </div>
  )
}
