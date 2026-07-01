import { WizardProgress } from './WizardProgress'
import { WizardChromeContext } from './WizardChromeContext'
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
    <WizardChromeContext.Provider
      value={{ hiddenSteps: hiddenSteps ?? [], currentStep, wizardState, onStepClick: onStepClick }}
    >
      <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="hidden sm:block shrink-0 pb-[var(--wizard-chrome-gap-top)] pt-2">
          <div className="mx-auto w-full max-w-3xl px-4 md:min-w-[42rem]">
            <WizardProgress
              currentStep={currentStep}
              wizardState={wizardState}
              onStepClick={onStepClick}
              hiddenSteps={hiddenSteps}
            />
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4 pb-0 pt-0 md:min-w-[42rem]">
            {children}
          </div>
        </main>
      </div>
    </WizardChromeContext.Provider>
  )
}
