import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
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
import { LaunchOfferBanner } from '@/components/ui/LaunchOfferBanner'
import {
  EXTRA_DAY_PRICE,
  formatPriceIls,
  isLaunchOfferActive,
  resolvePlanPrice,
} from '@/lib/planPrices'
import { cn } from '@/lib/utils'

type Option = PlansOption

const OPTIONS: Record<Option, string> = {
  independent: 'משחק ידני',
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

/** Kept short on purpose - the four management lines read as one idea. */
const CORE_INCLUDES = ['ניהול מלא של המשחק', 'משימות, משתתפים וקבוצות']

const BASIC_INCLUDES = [
  ...CORE_INCLUDES,
  'לוח תוצאות בזמן אמת',
  'הזנת ניקוד ידנית ממסך המשחק',
]

/** Spelled out so nobody buys the basic plan expecting these. */
const BASIC_EXCLUDES = ['סורק', 'מסך הגרלה']

/** Newly shipped - carries the "חדש" badge in the full plan's list. */
const LOTTERY_FEATURE = 'הגרלה חגיגית בזמן אמת'

const FULL_INCLUDES = [...CORE_INCLUDES, 'לוח תוצאות בזמן אמת', LOTTERY_FEATURE]

const FULL_SPECIALS = ['סורק לשימוש באירוע']

/** The full plan's extras, plus the one reason to pick offline over it. */
const OFFLINE_SPECIALS = ['סורק לשימוש באירוע', 'משחק וסריקה ללא חיבור לאינטרנט']

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
  /** Single visual emphasis target - moves when the user picks another plan. */
  const [emphasizedPlan, setEmphasizedPlan] = useState<Option>('full')
  const [launchActive, setLaunchActive] = useState(() => isLaunchOfferActive())
  const handleLaunchExpired = useCallback(() => setLaunchActive(false), [])

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
      'lottery_trial_reveal',
      'lottery_locked_plan',
      'launch_offer_banner',
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
    : 'בחרו את המסלול המתאים לאירוע שלכם'

  // Re-resolved when the modal opens and again the moment the countdown hits
  // zero, so an open tab drops to the regular price without a refresh.
  const basicPrice = useMemo(() => resolvePlanPrice('independent'), [isOpen, launchActive])
  const fullPrice = useMemo(() => resolvePlanPrice('full'), [isOpen, launchActive])
  const offlinePrice = useMemo(() => resolvePlanPrice('offline'), [isOpen, launchActive])
  const extraDayLabel = `עד 70 משתתפים · יום נוסף ${formatPriceIls(EXTRA_DAY_PRICE)}`

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
        <LaunchOfferBanner
          variant="bar"
          sticky={false}
          showAction={false}
          eventId={eventId}
          onExpire={handleLaunchExpired}
          className="mb-6 rounded-xl border"
        />

        <div className="mb-8 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Basic */}
          <div ref={focusPlan === 'independent' ? focusedCardRef : undefined}>
            <OptionCard
              featured={emphasizeBasic}
              label="משחק ידני"
              disabled={currentPlan === 'independent'}
              onEmphasize={() => emphasizeOnly('independent')}
            >
              <div className="mb-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden="true">🎮</span>
                  <span className="text-base font-bold text-foreground">משחק ידני</span>
                  {currentPlan === 'independent' && (
                    <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      המסלול הנוכחי
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  {basicPrice?.wasPrice != null && (
                    <span className="text-lg font-semibold text-muted line-through decoration-2">
                      {formatPriceIls(basicPrice.wasPrice)}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeBasic ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    {basicPrice && formatPriceIls(basicPrice.price)}
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">עד 70 משתתפים</p>
                <PlanTagline>משחקים בלי סורק.</PlanTagline>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                  במקום לסרוק כרטיס, מזינים למשתתף את הניקוד ידנית ממסך המשחק.
                </p>
              </div>

              <div className="mb-5 flex-1 space-y-3">
                {BASIC_INCLUDES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
                <div className="mt-2 space-y-1.5 rounded-lg bg-surface-elevated px-2 py-1.5">
                  <p className="text-[10px] font-semibold leading-none text-muted">לא כולל:</p>
                  {BASIC_EXCLUDES.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <X size={13} className="shrink-0 text-muted" aria-hidden="true" />
                      <span className="text-xs leading-snug text-muted">{item}</span>
                    </div>
                  ))}
                </div>
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
                {currentPlan === 'independent' ? 'המסלול הנוכחי שלכם' : 'בחרו משחק ידני'}
              </Button>
            </OptionCard>
          </div>

          {/* Full - recommended */}
          <div className="relative pt-3">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                המסלול המומלץ
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
                  {fullPrice?.wasPrice != null && (
                    <span className="text-lg font-semibold text-muted line-through decoration-2">
                      {formatPriceIls(fullPrice.wasPrice)}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeFull ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    {fullPrice && formatPriceIls(fullPrice.price)}
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">{extraDayLabel}</p>
                <PlanTagline>החוויה המלאה של משחק הסריקות.</PlanTagline>
              </div>

              <div className="mb-5 flex-1 space-y-3">
                {FULL_INCLUDES.map((item) => (
                  <FeatureRow
                    key={item}
                    text={item}
                    badge={item === LOTTERY_FEATURE ? 'חדש' : undefined}
                  />
                ))}
                <div className="mt-2 space-y-1.5 rounded-lg bg-[color-mix(in_srgb,var(--palette-brand-accent)_6%,transparent)] px-2 py-1.5">
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
                בחרו משחק מלא
              </Button>
            </OptionCard>
          </div>

          {/* Offline - the full game, delivered as a file that needs no network */}
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
                  {offlinePrice?.wasPrice != null && (
                    <span className="text-lg font-semibold text-muted line-through decoration-2">
                      {formatPriceIls(offlinePrice.wasPrice)}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-3xl font-extrabold leading-none',
                      emphasizeOffline ? 'text-primary-text' : 'text-foreground',
                    )}
                  >
                    {offlinePrice && formatPriceIls(offlinePrice.price)}
                  </span>
                  <span className="text-sm font-medium text-muted">לאירוע</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">{extraDayLabel}</p>
                <PlanTagline>כל מה שיש במשחק המלא - גם במקום בלי אינטרנט.</PlanTagline>
              </div>

              <div className="mb-5 flex-1 space-y-3">
                {FULL_INCLUDES.map((item) => (
                  <FeatureRow
                    key={item}
                    text={item}
                    badge={item === LOTTERY_FEATURE ? 'חדש' : undefined}
                  />
                ))}
                <div className="mt-2 space-y-1.5 rounded-lg bg-[color-mix(in_srgb,var(--palette-brand-accent)_6%,transparent)] px-2 py-1.5">
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
                {currentPlan === 'offline' ? 'המסלול הנוכחי שלכם' : 'בחרו משחק ללא אינטרנט'}
              </Button>
            </OptionCard>
          </div>

          {/* Organizations - CTA card */}
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
              <PlanTagline className="mt-3">נתאים את Gamify לאירועים ולפעילות שלכם.</PlanTagline>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
                לבתי ספר, קייטנות, ישיבות, חברות וקהילות.
              </p>
            </div>

            <div className="mb-5 flex-1 space-y-3">
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

/**
 * The line that says what the plan is, under the price. Deliberately heavier
 * than the feature rows beneath it - the list is the detail, this is the
 * reason to pick this card over the one next to it.
 */
function PlanTagline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-2.5 text-sm font-semibold leading-snug text-foreground', className)}>
      {children}
    </p>
  )
}

function FeatureRow({ text, badge }: { text: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check size={13} className="shrink-0 text-success-text" aria-hidden="true" />
      <span className="text-xs leading-snug text-foreground">{text}</span>
      {badge && (
        <span
          className={cn(
            'inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full',
            'bg-primary px-2.5 text-[11px] font-medium leading-none text-primary-foreground',
            'animate-[badge-pop_250ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none',
          )}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
