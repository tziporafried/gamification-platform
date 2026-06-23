import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { ReadinessCheck } from '@/types'

interface ReadinessChecklistProps {
  checks: ReadinessCheck[]
  eventId?: string
}

export function ReadinessChecklist({ checks, eventId }: ReadinessChecklistProps) {
  const navigate = useNavigate()
  const firstMissing = checks.find(c => !c.passed && c.stepNumber)

  return (
    <div className="rounded-2xl border border-game-border bg-game-card p-5 space-y-3">
      <p className="text-sm font-medium text-white">האירוע עדיין לא מוכן</p>
      <p className="text-xs text-gray-400">השלם את הפריטים הבאים כדי לפתוח את הדפסת הכרטיסים ומרכז הבקרה:</p>
      <div className="space-y-2 pt-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-3">
            {check.passed ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
            )}
            <span className={cn('text-sm', check.passed ? 'text-gray-500' : 'text-gray-200')}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
      {firstMissing && eventId && (
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/events/${eventId}/step/${firstMissing.stepNumber}`)}
          >
            סיים הגדרה
          </Button>
        </div>
      )}
    </div>
  )
}
