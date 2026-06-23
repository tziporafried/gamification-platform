import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Monitor, ArrowRight, AlertCircle, CheckCircle2, Share2, Link as LinkIcon, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ShareEventModal } from '@/components/ShareEventModal'
import { calculateReadiness, isEventReady } from '@/lib/wizard'
import { cn } from '@/lib/utils'
import type { Event, EventCounts } from '@/types'

interface ControlCenterProps {
  event: Event
  counts: EventCounts
}

const ACTIONS = [
  { id: 'scan', label: 'מצב סריקה', icon: QrCode, color: 'text-brand-400', route: 'scan' },
  { id: 'display', label: 'מסך תצוגה', icon: Monitor, color: 'text-blue-400', route: 'display' },
]

export function ControlCenter({ event, counts }: ControlCenterProps) {
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ready = isEventReady(event, counts)
  const checks = calculateReadiness(event, counts)

  function handleAction(route: string | null) {
    if (route) {
      navigate(`/events/${event.id}/${route}`)
    }
  }

  async function copyManagementLink() {
    if (!event.slug) return
    const url = `${window.location.origin}/e/${event.slug}/control`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Secondary nav */}
      <div className="border-b border-game-border">
        <div className="mx-auto flex h-10 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/events')}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowRight size={14} />
              <span className="hidden sm:inline">האירועים שלי</span>
            </button>
            <span className="text-game-border">/</span>
            <span className="text-xs font-medium text-white truncate max-w-[160px]">{event.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyManagementLink}>
              {copied ? <Check size={14} className="ml-1 text-emerald-400" /> : <LinkIcon size={14} className="ml-1" />}
              {copied ? 'הועתק!' : 'העתק קישור'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 size={14} className="ml-1" />
              שיתוף
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/events/${event.id}/step/1`)}
            >
              עריכת הגדרות
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">מרכז הבקרה</h2>
          <p className="text-gray-400 text-sm">
            {ready ? 'האירוע מוכן להתחלה!' : 'השלם את ההכנות כדי להתחיל'}
          </p>
        </div>

        {/* Readiness checklist (show when not ready) */}
        {!ready && (
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-300">רשימת מוכנות</h3>
            {checks.map((check) => (
              <div key={check.id} className="flex items-center gap-3">
                {check.passed ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-amber-400 shrink-0" />
                )}
                <span className={cn(
                  'text-sm',
                  check.passed ? 'text-gray-400' : 'text-gray-200',
                )}>
                  {check.label}
                </span>
              </div>
            ))}
          </Card>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-4">
          {ACTIONS.map(({ id, label, icon: Icon, color, route }) => {
            return (
              <button
                key={id}
                onClick={() => handleAction(route)}
                className="text-right"
              >
                <Card
                  variant="interactive"
                  className="p-6 flex flex-col items-center gap-3 text-center min-h-[140px] justify-center"
                >
                  <Icon size={32} className={color} />
                  <span className="text-sm font-medium text-white">{label}</span>
                </Card>
              </button>
            )
          })}
        </div>

      </main>

      <ShareEventModal isOpen={shareOpen} onClose={() => setShareOpen(false)} eventId={event.id} />
    </>
  )
}
