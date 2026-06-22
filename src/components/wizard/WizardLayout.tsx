import { useState } from 'react'
import { ArrowRight, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WizardProgress } from './WizardProgress'
import { ShareEventModal } from '@/components/ShareEventModal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
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
  const [shareOpen, setShareOpen] = useState(false)
  const { isFreePlan } = useAuth()

  return (
    <div className="flex h-screen flex-col bg-game-dark">
      {/* Header */}
      <header className="shrink-0 border-b border-game-border bg-game-dark/95 backdrop-blur-sm z-30">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/events')}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowRight size={16} />
              <span className="hidden sm:inline">האירועים שלי</span>
            </button>
            <span className="text-game-border">/</span>
            <h1 className="text-sm font-bold text-white truncate max-w-[200px]">
              {event.name || 'אירוע חדש'}
            </h1>
            {isFreePlan && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
                מסלול חינמי
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 size={16} className="ml-1" />
            שיתוף
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <WizardProgress
            currentStep={currentStep}
            wizardState={wizardState}
            onStepClick={onStepClick}
          />
        </div>
      </header>

      {/* Step content — fills remaining height */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-3xl px-4">
          {children}
        </div>
      </main>

      <ShareEventModal isOpen={shareOpen} onClose={() => setShareOpen(false)} eventId={event.id} />
    </div>
  )
}
