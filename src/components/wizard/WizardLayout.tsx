import { WizardProgress } from './WizardProgress'
import { WizardChromeContext, useWizardIntroTracking } from './WizardChromeContext'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { cn } from '@/lib/utils'
import type { WizardState, Event } from '@/types'

interface WizardLayoutProps {
  event: Event
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  hiddenSteps?: number[]
  headerSuffix?: string
  /** Embed in a modal/panel — skip global header chrome and fill parent height. */
  embedded?: boolean
  children: React.ReactNode
}

export function WizardLayout({
  event,
  currentStep,
  wizardState,
  onStepClick,
  hiddenSteps,
  headerSuffix,
  embedded = false,
  children,
}: WizardLayoutProps) {
  useEventHeaderBreadcrumb(event.name, headerSuffix, event.plan, event.id, {
    showTrialBadge: true,
    enabled: !embedded,
  })
  const { hasIntroPlayed, markIntroPlayed } = useWizardIntroTracking()

  return (
    <WizardChromeContext.Provider
      value={{
        hiddenSteps: hiddenSteps ?? [],
        currentStep,
        wizardState,
        onStepClick,
        hasIntroPlayed,
        markIntroPlayed,
      }}
    >
      <div
        className="flex flex-col"
        style={embedded ? { height: '100%' } : { height: 'calc(100vh - 56px)' }}
      >
        <div
          className={cn(
            'shrink-0 pb-[var(--wizard-chrome-gap-top)] pt-2',
            embedded ? 'block' : 'hidden sm:block',
          )}
        >
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
          <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4 pb-0 pt-[var(--wizard-chrome-gap-top)] sm:pt-0 md:min-w-[42rem]">
            {children}
          </div>
        </main>
      </div>
    </WizardChromeContext.Provider>
  )
}
