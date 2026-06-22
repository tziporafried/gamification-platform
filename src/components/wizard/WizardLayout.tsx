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
            {isFreePlan && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
                מסלול חינמי
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 size={14} className="ml-1" />
            שיתוף
          </Button>
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

      <ShareEventModal isOpen={shareOpen} onClose={() => setShareOpen(false)} eventId={event.id} />
    </div>
  )
}
