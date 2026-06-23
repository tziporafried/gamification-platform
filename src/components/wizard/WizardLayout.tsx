import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WizardProgress } from './WizardProgress'
import type { WizardState, Event } from '@/types'

interface WizardLayoutProps {
  event: Event
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  children: React.ReactNode
}

export function WizardLayout({ event, currentStep, wizardState, onStepClick, children }: WizardLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Secondary nav: breadcrumb + progress */}
      <div className="shrink-0 border-b border-game-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/events')}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowRight size={14} />
              <span className="hidden sm:inline">האירועים שלי</span>
            </button>
            <span className="text-game-border">/</span>
            <span className="text-xs font-medium text-white truncate max-w-[160px]">
              {event.name || 'אירוע חדש'}
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-2">
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
