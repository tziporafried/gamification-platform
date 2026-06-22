import { useState } from 'react'
import { ArrowRight, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WizardProgress } from './WizardProgress'
import { ShareEventModal } from '@/components/ShareEventModal'
import { Button } from '@/components/ui/Button'
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

  return (
    <div className="min-h-screen bg-game-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-game-border bg-game-dark/95 backdrop-blur-sm">
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

      {/* Step content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>

      <ShareEventModal isOpen={shareOpen} onClose={() => setShareOpen(false)} eventId={event.id} />
    </div>
  )
}
