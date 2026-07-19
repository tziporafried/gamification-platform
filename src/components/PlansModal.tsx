import { useState, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
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
import { cn } from '@/lib/utils'

type Option = PlansOption

const OPTIONS: Record<Option, string> = {
  independent: 'משחק בסיסי',
  full: 'משחק מלא',
  organizations: 'פתרון לארגונים',
  offline: 'חוויה בלי חיבור לאינטרנט',
}

const INTENT_FOR_OPTION: Record<Option, ContactIntent> = {
  independent: 'plan_independent',
  full: 'plan_lead',
  organizations: 'organization_lead',
  offline: 'plan_offline',
}

const BASIC_INCLUDES = [
  'מערכת המשחק',
  'ניהול משתתפים',
  'ניהול קבוצות',
  'משימות וניקוד',
  'לוח תוצאות בזמן אמת',
  'הזנת סריקות ידנית',
]

const FULL_INCLUDES = [
  'מערכת המשחק',
  'ניהול משתתפים',
  'ניהול קבוצות',
  'משימות וניקוד',
  'לוח תוצאות בזמן אמת',
]

const FULL_SPECIALS = ['מסך סריקה ייעודי', 'סורק לשימוש באירוע']

/** The full plan's extras, plus the one reason to pick offline over it. */
const OFFLINE_SPECIALS = [
  'מסך סריקה ייעודי',
  'סורק לשימוש באירוע',
  'משחק וסריקה ללא חיבור לאינטרנט',
]

const ORG_VALUES = ['מספר אירועים', 'התאמה לצרכים שלכם', 'תמחור מותאם']

interface PlansModalProps {
  isOpen: boolean
  onClose: () => void
  eventId?: string | null
  source?: string | null
  initialPlan?: Option | null
  focusPlan?: Option | null
}

export function PlansModal({
  isOpen,
  onClose,
  eventId = null,
  source = null,
  initialPlan = null,
  focusPlan = null,
}: PlansModalProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)
  /** Single visual emphasis target — moves when the user picks another plan. */
  const [emphasizedPlan, setEmphasizedPlan] = useState<Option>('full')

  const formSectionRef = useRef<HTMLDivElement>(null)
  const focusedCardRef = useRef<HTMLDivElement>(null)
  const shouldScrollOnSelectRef = useRef(false)
  const sessionKeyRef = useRef(0)
  const restoredPlanRef = useRef(false)
  const scrolledToFocusRef = useRef(false)

  const emphasizeBasic = emphasizedPlan === 'independent'
  const emphasizeFull = emphasizedPlan === 'full'
  const emphasizeOrg = emphasizedPlan === 'organizations'
  const emphasizeOffline = emphasizedPlan === 'offline'

  useEffect(() => {
    if (!isOpen) return
    sessionKeyRef.current += 1
    restoredPlanRef.current = false
    scrolledToFocusRef.current = false
    setSelectedOption(null)
    setFormVisible(false)
    setEmphasizedPlan(focusPlan ?? 'full')
    shouldScrollOnSelectRef.current = false
  }, [isOpen, eventId, source, initialPlan, focusPlan])

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

  useEffect(() => {
    if (!isOpen || restoredPlanRef.current) return
    if (initialPlan !== 'independent' && initialPlan !== 'full' && initialPlan !== 'organizations') {
      return
    }
    restoredPlanRef.current = true
    setSelectedOption(initialPlan)
    setFormVisible(true)
    setEmphasizedPlan(initialPlan)
  }, [isOpen, initialPlan])

  useEffect(() => {
    if (!isOpen || !focusPlan || scrolledToFocusRef.current || initialPlan) return
    scrolledToFocusRef.current = true
    const frame = requestAnimationFrame(() => {
      focusedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen, focusPlan, initialPlan])

  useEffect(() => {
    if (!formVisible || !selectedOption || !shouldScrollOnSelectRef.current) return
    shouldScrollOnSelectRef.current = false
    const el = formSectionRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [formVisible, selectedOption])

  function emphasizeOnly(option: Option) {
    setEmphasizedPlan(option)
    if (formVisible && selectedOption !== option) {
      setFormVisible(false)
      setSelectedOption(null)
    }
  }

  function openFormFor(option: Option) {
    setEmphasizedPlan(option)
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
      dialogClassName="!flex h-[90vh] !w-[90vw] max-h-[90vh] max-w-none flex-col"
      contentClassName="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6"
    >
      <div dir="rtl">
        <p className="mb-6 text-center text-sm leading-relaxed text-muted">
          בחרו איך תרצו לשחק באירוע שלכם.
        </p>

        <div className="mb-8 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Basic */}
          <div ref={focusPlan === 'independent' ? focusedCardRef : undefined}>
            <OptionCard
              featured={emphasizeBasic}
              label="משחק בסיסי"
              disabled={currentPlan === 'independent'}
              onEmphasize={() => emphasizeOnly('independent')}
            >
              <div className="mb-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden="true">🎮</span>
                  <span className="text-base font-bold text-foreground">משחק בסיסי</span>
                  {currentPlan === 'independent' && (
                    <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      המסלול הנוכחי
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeBasic ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    ₪40
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">עד 70 משתתפים</p>
                <p className="mt-2.5 text-xs leading-relaxed text-foreground/80">
                  משחקים עם כל המערכת, ומזינים את הסריקות ידנית.
                </p>
              </div>

              <div className="mb-5 flex-1 space-y-2">
                {BASIC_INCLUDES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
              </div>

              <Button
                variant={emphasizeBasic ? 'gradient' : 'outline'}
                size="md"
                className="w-full font-medium"
                disabled={currentPlan === 'independent'}
                onClick={(event) => {
                  event.stopPropagation()
                  openFormFor('independent')
                }}
              >
                {currentPlan === 'independent' ? 'המסלול הנוכחי שלכם' : 'אני רוצה משחק בסיסי'}
              </Button>
            </OptionCard>
          </div>

          {/* Full — recommended */}
          <div className="relative pt-3">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                הכי פופולרי
              </span>
            </div>
            <OptionCard
              featured={emphasizeFull}
              label="משחק מלא"
              onEmphasize={() => emphasizeOnly('full')}
            >
              <div className="mb-4">
                <div className="mb-1 flex items-center gap-2 pt-1">
                  <span className="text-lg" aria-hidden="true">⭐</span>
                  <span className="text-base font-bold text-foreground">משחק מלא</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeFull ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    ₪150
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">עד 70 משתתפים · יום נוסף ₪15</p>
                <p className="mt-2.5 text-xs leading-relaxed text-foreground/80">
                  סורקים עם סורק ונהנים מחוויית המשחק המלאה.
                </p>
              </div>

              <div className="mb-5 flex-1 space-y-2">
                {FULL_INCLUDES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
                <div className="mt-1 space-y-1 rounded-lg bg-[color-mix(in_srgb,var(--palette-brand-accent)_6%,transparent)] px-2 py-1.5">
                  <p className="text-[10px] font-semibold leading-none text-foreground/75">כולל גם:</p>
                  {FULL_SPECIALS.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check size={13} className="shrink-0 text-success-text" aria-hidden="true" />
                      <span className="text-xs font-semibold leading-snug text-foreground">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant={emphasizeFull ? 'gradient' : 'outline'}
                size="md"
                className="w-full font-medium"
                onClick={(event) => {
                  event.stopPropagation()
                  openFormFor('full')
                }}
              >
                אני רוצה משחק מלא
              </Button>
            </OptionCard>
          </div>

          {/* Offline — the full game, delivered as a file that needs no network */}
          <div ref={focusPlan === 'offline' ? focusedCardRef : undefined}>
            <OptionCard
              featured={emphasizeOffline}
              label="חוויה בלי חיבור לאינטרנט"
              disabled={currentPlan === 'offline'}
              onEmphasize={() => emphasizeOnly('offline')}
            >
              <div className="mb-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden="true">📴</span>
                  <span className="text-base font-bold text-foreground">חוויה בלי חיבור לאינטרנט</span>
                  {currentPlan === 'offline' && (
                    <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      המסלול הנוכחי
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeOffline ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    ₪200
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">עד 70 משתתפים · יום נוסף ₪15</p>
                <p className="mt-2.5 text-xs leading-relaxed text-foreground/80">
                  כל מה שיש במשחק המלא — גם במקום בלי אינטרנט.
                </p>
              </div>

              <div className="mb-5 flex-1 space-y-2">
                {FULL_INCLUDES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
                <div className="mt-1 space-y-1 rounded-lg bg-[color-mix(in_srgb,var(--palette-brand-accent)_6%,transparent)] px-2 py-1.5">
                  <p className="text-[10px] font-semibold leading-none text-foreground/75">כולל גם:</p>
                  {OFFLINE_SPECIALS.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check size={13} className="shrink-0 text-success-text" aria-hidden="true" />
                      <span className="text-xs font-semibold leading-snug text-foreground">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-foreground/75">
                  אחרי התשלום תקבלו את הקובץ עם ההגדרות שהגדרתם, כך שתוכלו להפעיל אותו
                  מכל מחשב ללא חיבור לאינטרנט.
                </p>
              </div>

              <Button
                variant={emphasizeOffline ? 'gradient' : 'outline'}
                size="md"
                className="w-full font-medium"
                disabled={currentPlan === 'offline'}
                onClick={(event) => {
                  event.stopPropagation()
                  openFormFor('offline')
                }}
              >
                {currentPlan === 'offline' ? 'המסלול הנוכחי שלכם' : 'אני רוצה משחק בלי אינטרנט'}
              </Button>
            </OptionCard>
          </div>

          {/* Organizations — CTA card */}
          <OptionCard
            featured={emphasizeOrg}
            label="פתרון לארגונים"
            onEmphasize={() => emphasizeOnly('organizations')}
          >
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">🏫</span>
                <span className="text-base font-bold text-foreground">צריכים פתרון לארגון?</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground/80">
                לבתי ספר, קייטנות, ישיבות, חברות וקהילות.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/80">
                נתאים את Gamify לאירועים ולפעילות שלכם.
              </p>
            </div>

            <div className="mb-5 flex-1 space-y-2">
              {ORG_VALUES.map((item) => (
                <FeatureRow key={item} text={item} />
              ))}
            </div>

            <Button
              variant={emphasizeOrg ? 'gradient' : 'outline'}
              size="md"
              className="w-full font-medium"
              onClick={(event) => {
                event.stopPropagation()
                openFormFor('organizations')
              }}
            >
              בואו נדבר
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
  label,
  onEmphasize,
  disabled = false,
}: {
  children: ReactNode
  featured?: boolean
  label: string
  onEmphasize: () => void
  disabled?: boolean
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onEmphasize()
    }
  }

  return (
    <div
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-pressed={featured}
      onClick={() => {
        if (!disabled) onEmphasize()
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex h-full flex-col rounded-2xl bg-surface p-5 text-right transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        disabled
          ? 'cursor-not-allowed opacity-80'
          : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.995]',
        featured
          ? 'border-2 border-primary shadow-card'
          : 'border border-border shadow-card',
      )}
    >
      {children}
    </div>
  )
}

function FeatureRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check size={13} className="shrink-0 text-success-text" aria-hidden="true" />
      <span className="text-xs leading-snug text-foreground">{text}</span>
    </div>
  )
}
