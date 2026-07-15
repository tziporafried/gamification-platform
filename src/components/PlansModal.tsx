import { useState, useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import {
  trackSelectPlan,
  trackViewPlans,
  trackActivationOptionsViewed,
  trackContactFormOpen,
  type ActivationOptionsSource,
} from '@/lib/analytics'
import { ContactForm } from '@/components/ContactForm'
import type { ContactIntent } from '@/lib/contact'
import type { PlansOption } from '@/contexts/PlansModalContext'

type Option = PlansOption

const OPTIONS: Record<Option, string> = {
  independent: 'משחק עצמאי',
  full: 'חוויה מלאה',
  organizations: 'פתרון לארגונים',
}

const INTENT_FOR_OPTION: Record<Option, ContactIntent> = {
  independent: 'plan_independent',
  full: 'plan_lead',
  organizations: 'organization_lead',
}

const INDEPENDENT_INCLUDES = [
  'אפליקציית המשחק',
  'ניהול משתתפים',
  'ניהול קבוצות',
  'משימות וניקוד',
  'לוח תוצאות בזמן אמת',
]
const INDEPENDENT_EXCLUDES = ['סריקת QR', 'ציוד']

const FULL_EXTRAS = [
  'מערכת סריקה',
  'השאלת סורק QR ליום האירוע',
]

interface PlansModalProps {
  isOpen: boolean
  onClose: () => void
  eventId?: string | null
  source?: string | null
  initialPlan?: Option | null
}

export function PlansModal({
  isOpen,
  onClose,
  eventId = null,
  source = null,
  initialPlan = null,
}: PlansModalProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)

  const formSectionRef = useRef<HTMLDivElement>(null)
  const shouldScrollOnSelectRef = useRef(false)
  const sessionKeyRef = useRef(0)
  const restoredPlanRef = useRef(false)

  // Reset local UI each time the modal opens with a new context.
  useEffect(() => {
    if (!isOpen) return
    sessionKeyRef.current += 1
    restoredPlanRef.current = false
    setSelectedOption(null)
    setFormVisible(false)
    shouldScrollOnSelectRef.current = false
  }, [isOpen, eventId, source, initialPlan])

  useEffect(() => {
    if (!isOpen) return
    trackViewPlans(Boolean(eventId))
  }, [isOpen, eventId])

  useEffect(() => {
    if (!isOpen || !eventId || !source) return
    const known: ActivationOptionsSource[] = [
      'trial_scan_limit',
      'game_home_trial',
      'events_page_trial_badge',
      'wizard_trial_badge',
      'plan_limit_modal',
      'header',
      'post_wizard',
      'deep_link',
    ]
    if ((known as string[]).includes(source)) {
      trackActivationOptionsViewed(eventId, source as ActivationOptionsSource)
    }
  }, [isOpen, eventId, source])

  useEffect(() => {
    if (!isOpen) return
    if (!eventId) {
      setCurrentPlan(null)
      setEventName(null)
      return
    }
    let cancelled = false
    supabase
      .from('events')
      .select('plan, name')
      .eq('id', eventId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setCurrentPlan(data?.plan ?? null)
        setEventName(data?.name?.trim() || null)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, eventId])

  // Restore selected plan from open options (refresh / post-auth / post-wizard).
  useEffect(() => {
    if (!isOpen || restoredPlanRef.current) return
    if (initialPlan !== 'independent' && initialPlan !== 'full' && initialPlan !== 'organizations') {
      return
    }
    restoredPlanRef.current = true
    setSelectedOption(initialPlan)
    setFormVisible(true)
  }, [isOpen, initialPlan])

  useEffect(() => {
    if (!formVisible || !selectedOption || !shouldScrollOnSelectRef.current) return
    shouldScrollOnSelectRef.current = false
    const el = formSectionRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [formVisible, selectedOption])

  function openFormFor(option: Option) {
    shouldScrollOnSelectRef.current = true
    setSelectedOption(option)
    setFormVisible(true)
    trackSelectPlan(option, Boolean(eventId))
    trackContactFormOpen({
      contact_source: option === 'organizations' ? 'custom_solution' : option,
      cta_location: 'pricing',
    })
  }

  const title = eventName
    ? `איך תרצו להפעיל את ${eventName}?`
    : 'איך תרצו להפעיל את המשחק?'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleClassName="text-xl font-bold text-foreground leading-snug pe-2"
      dialogClassName="flex h-[85vh] w-[85vw] max-w-none flex-col"
      contentClassName="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6"
    >
      <div dir="rtl">
        <p className="mb-6 text-center text-sm leading-relaxed text-muted">
          בחרו את האפשרות שמתאימה לאירוע שלכם.
        </p>

        <div className="mb-8 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
          <OptionCard
            selected={selectedOption === 'independent' && formVisible}
            dimmed={currentPlan === 'independent'}
          >
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <span className="text-base font-bold text-foreground">משחק עצמאי</span>
                {currentPlan === 'independent' && (
                  <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-muted">
                    המסלול הנוכחי
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-2xl font-extrabold text-foreground">40</span>
                <span className="mb-0.5 text-sm text-muted">₪ לאירוע</span>
              </div>
              <p className="mt-1 text-xs text-muted">עד 70 משתתפים</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                מתאים למי שרוצה להפעיל את המשחק באופן עצמאי.
              </p>
            </div>

            <div className="mb-5 flex-1 space-y-2">
              {INDEPENDENT_INCLUDES.map((item) => (
                <FeatureRow key={item} included text={item} />
              ))}
              {INDEPENDENT_EXCLUDES.map((item) => (
                <FeatureRow key={item} included={false} text={item} />
              ))}
            </div>

            <Button
              variant={selectedOption === 'independent' && formVisible ? 'gradient' : 'outline'}
              size="md"
              className="w-full font-medium"
              onClick={() => openFormFor('independent')}
              disabled={currentPlan === 'independent'}
            >
              {currentPlan === 'independent' ? 'המסלול הנוכחי שלכם' : 'אני מעוניין במשחק עצמאי'}
            </Button>
          </OptionCard>

          <div className="relative pt-3">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                הכי פופולרי
              </span>
            </div>
            <OptionCard featured selected={selectedOption === 'full' && formVisible}>
              <div className="mb-4">
                <div className="mb-1 flex items-center gap-2 pt-1">
                  <span className="text-lg">⭐</span>
                  <span className="text-base font-bold text-foreground">חוויה מלאה</span>
                </div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-2xl font-extrabold text-foreground">150</span>
                  <span className="mb-0.5 text-sm text-muted">₪ לאירוע</span>
                </div>
                <p className="mt-1 text-xs text-muted">יום פעילות נוסף: 15 ₪</p>
                <p className="mt-1 text-xs text-muted">עד 70 משתתפים</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  הפתרון המלא להפעלת המשחק.
                </p>
              </div>

              <div className="mb-5 flex-1 space-y-2">
                {INDEPENDENT_INCLUDES.map((item) => (
                  <FeatureRow key={item} included text={item} />
                ))}
                {FULL_EXTRAS.map((item) => (
                  <FeatureRow key={item} included text={item} highlight />
                ))}
              </div>

              <Button
                variant="gradient"
                size="md"
                className="w-full font-medium"
                onClick={() => openFormFor('full')}
              >
                אני מעוניין בחוויה המלאה
              </Button>
            </OptionCard>
          </div>

          <OptionCard selected={selectedOption === 'organizations' && formVisible}>
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">🏫</span>
                <span className="text-base font-bold text-foreground">פתרון לארגונים</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                מתאים לבתי ספר, קייטנות, ישיבות, חברות, קהילות וארגונים.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                נשמח להתאים את המערכת בדיוק לצרכים שלכם.
              </p>
            </div>

            <div className="flex-1" />

            <Button
              variant={selectedOption === 'organizations' && formVisible ? 'gradient' : 'outline'}
              size="md"
              className="w-full font-medium"
              onClick={() => openFormFor('organizations')}
            >
              אני מעוניין בפתרון מותאם
            </Button>
          </OptionCard>
        </div>

        {formVisible && selectedOption && (
          <div
            ref={formSectionRef}
            className="mx-auto max-w-xl scroll-mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"
          >
            <ContactForm
              key={`${sessionKeyRef.current}-${selectedOption}-${eventId ?? 'none'}`}
              intent={INTENT_FOR_OPTION[selectedOption]}
              analyticsPlanName={selectedOption}
              eventId={eventId}
              eventName={eventName}
              pageSource="pricing"
              source={selectedOption === 'organizations' ? 'custom_solution' : undefined}
              selectedOptionLabel={OPTIONS[selectedOption]}
              eventPrefill={eventName ? { name: eventName } : null}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

function OptionCard({
  children,
  featured,
  selected,
  dimmed,
}: {
  children: React.ReactNode
  featured?: boolean
  selected?: boolean
  dimmed?: boolean
}) {
  return (
    <div
      className={[
        'flex flex-col rounded-2xl p-5 transition-all duration-200',
        featured
          ? 'border-2 border-primary bg-surface shadow-card'
          : 'border border-border bg-surface shadow-card',
        selected && !featured ? 'border-primary' : '',
        dimmed ? 'opacity-60' : '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function FeatureRow({
  included,
  text,
  highlight,
}: {
  included: boolean
  text: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {included ? (
        <Check size={13} className={`shrink-0 ${highlight ? 'text-primary' : 'text-success'}`} />
      ) : (
        <X size={13} className="shrink-0 text-muted" />
      )}
      <span
        className={`text-xs ${
          !included
            ? 'text-muted line-through'
            : highlight
              ? 'font-medium text-primary'
              : 'text-muted'
        }`}
      >
        {text}
      </span>
    </div>
  )
}
