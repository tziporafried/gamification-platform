import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { ReadinessCheck } from '@/types'
import { getFirstIncompleteStep } from '@/lib/wizard'

interface ReadinessChecklistProps {
  checks: ReadinessCheck[]
  eventId?: string
  variant?: 'default' | 'wizard'
  onGoToStep?: (step: number) => void
}

export function ReadinessChecklist({ checks, eventId, variant = 'default', onGoToStep }: ReadinessChecklistProps) {
  const navigate = useNavigate()
  const firstMissingStep = getFirstIncompleteStep(checks)
  const isWizard = variant === 'wizard'

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
    <div className="rounded-2xl border border-game-border bg-game-card p-5 space-y-3">
      <p className="text-sm font-medium text-white">
        {isWizard ? 'כמעט מוכנים' : 'האירוע עדיין לא מוכן'}
      </p>
      <p className="text-xs text-gray-400">
        {isWizard
          ? 'נשארו עוד כמה צעדים קטנים ואפשר לצאת לדרך'
          : 'השלם את הפריטים הבאים כדי לפתוח את הדפסת הכרטיסים ומרכז הבקרה:'}
      </p>
      <div className="space-y-2 pt-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-3">
            {check.passed ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
            )}
            <span className={cn('text-sm', check.passed ? 'text-gray-500' : 'text-gray-200')}>
              {getCheckLabel(check, isWizard)}
            </span>
          </div>
        ))}
      </div>
      {firstMissingStep != null && (eventId || onGoToStep) && (
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCompleteSetup}
          >
            {isWizard ? 'עבור לשלב החסר' : 'סיים הגדרה'}
          </Button>
        </div>
      )}
    </div>
  )
}

function getCheckLabel(check: ReadinessCheck, isWizard: boolean): string {
  if (!isWizard) return check.label
  return check.passed
    ? (check.wizardPassedLabel ?? check.label)
    : (check.wizardFailedLabel ?? check.label)
}
