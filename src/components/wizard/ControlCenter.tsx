import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Monitor, Link as LinkIcon, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ReadinessChecklist } from './ReadinessChecklist'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { calculateReadiness, isEventReady } from '@/lib/wizard'
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
  const [copied, setCopied] = useState(false)
  useEventHeaderBreadcrumb(event.name)
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
      {/* Actions bar */}
      <div className="border-b border-game-border">
        <div className="mx-auto flex h-10 max-w-5xl items-center justify-end gap-2 px-4">
          <Button variant="ghost" size="sm" onClick={copyManagementLink}>
            {copied ? <Check size={14} className="ml-1 text-emerald-400" /> : <LinkIcon size={14} className="ml-1" />}
            {copied ? 'הועתק!' : 'העתק קישור'}
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

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">מרכז הבקרה</h2>
          <p className="text-gray-400 text-sm">
            {ready ? 'האירוע מוכן להתחלה!' : 'השלם את ההכנות כדי להתחיל'}
          </p>
        </div>

        {/* Readiness checklist (show when not ready) */}
        {!ready && <ReadinessChecklist checks={checks} eventId={event.id} />}

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

    </>
  )
}
