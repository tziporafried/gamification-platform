import { WizardProgress } from './WizardProgress'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import type { WizardState, Event } from '@/types'

interface WizardLayoutProps {
  event: Event
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  hiddenSteps?: number[]
  headerSuffix?: string
  children: React.ReactNode
}

export function WizardLayout({
  event,
  currentStep,
  wizardState,
  onStepClick,
  hiddenSteps,
  headerSuffix,
  children,
}: WizardLayoutProps) {
  useEventHeaderBreadcrumb(event.name, headerSuffix)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="shrink-0 border-b border-game-border py-1.5">
        <div className="mx-auto max-w-3xl px-4">
          <WizardProgress
            currentStep={currentStep}
            wizardState={wizardState}
            onStepClick={onStepClick}
            hiddenSteps={hiddenSteps}
          />
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col px-4">
          {children}
        </div>
      </main>
    </div>
  )
}
