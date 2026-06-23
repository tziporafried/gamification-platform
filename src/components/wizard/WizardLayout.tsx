import { WizardProgress } from './WizardProgress'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import type { WizardState, Event } from '@/types'

interface WizardLayoutProps {
  event: Event
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  children: React.ReactNode
}

export function WizardLayout({ event, currentStep, wizardState, onStepClick, children }: WizardLayoutProps) {
  useEventHeaderBreadcrumb(event.name)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Progress bar only */}
      <div className="shrink-0 border-b border-game-border px-4 py-2">
        <div className="mx-auto max-w-5xl">
          <WizardProgress
            currentStep={currentStep}
            wizardState={wizardState}
            onStepClick={onStepClick}
          />
        </div>
      </div>

      {/* Step content — fills remaining height */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-3xl px-4">
          {children}
        </div>
      </main>
    </div>
  )
}
