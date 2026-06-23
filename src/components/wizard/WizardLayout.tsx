import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WizardProgress } from './WizardProgress'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'
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
  const { setCenterSlot } = useHeaderSlot()

  useEffect(() => {
    setCenterSlot(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowRight size={14} />
          <span>האירועים שלי</span>
        </button>
        <span className="text-brand-400/60">/</span>
        <span className="text-xs font-medium text-white truncate max-w-[200px]">
          {event.name || 'אירוע חדש'}
        </span>
      </div>
    )
    return () => setCenterSlot(null)
  }, [event.name, navigate, setCenterSlot])

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
