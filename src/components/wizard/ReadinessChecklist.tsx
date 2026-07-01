import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PanelCard } from '@/components/ui/PanelCard'
import type { ReadinessCheck } from '@/types'
import { getFirstIncompleteStep } from '@/lib/wizard'

interface ReadinessChecklistProps {
  checks: ReadinessCheck[]
  eventId?: string
  onGoToStep?: (step: number) => void
}

export function ReadinessChecklist({ checks, eventId, onGoToStep }: ReadinessChecklistProps) {
  const navigate = useNavigate()
  const firstMissingStep = getFirstIncompleteStep(checks)

  function handleCompleteSetup() {
    if (firstMissingStep == null) return
    if (onGoToStep) {
      onGoToStep(firstMissingStep)
      return
    }
    if (eventId) {
      navigate(`/events/${eventId}/step/${firstMissingStep}`)
    }
  }

  return (
    <PanelCard size="sm" className="space-y-3 bg-game-card/50">
      <p className="text-sm font-medium text-white">כמעט מוכנים</p>
      <p className="text-xs text-gray-400">נשארו עוד כמה צעדים קטנים ואפשר לצאת לדרך</p>
      <div className="space-y-2 pt-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-3">
            {check.passed ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
            )}
            <span className={cn('text-sm', check.passed ? 'text-gray-500' : 'text-gray-200')}>
              {check.passed ? (check.wizardPassedLabel ?? check.label) : (check.wizardFailedLabel ?? check.label)}
            </span>
          </div>
        ))}
      </div>
      {firstMissingStep != null && (eventId || onGoToStep) && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={handleCompleteSetup}>
            עבור לשלב החסר
          </Button>
        </div>
      )}
    </PanelCard>
  )
}
