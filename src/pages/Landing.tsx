import { useState, useRef, useEffect, Fragment, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScanLine,
  Settings2,
  Printer,
  PlugZap,
  Ticket,
  Trophy,
  Flame,
  ChevronLeft,
  ChevronDown,
  QrCode,
  AppWindow,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { usePlansModal } from '@/contexts/PlansModalContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import { FloatingContactButton } from '@/components/layout/FloatingContactButton'
import { ContactModal } from '@/components/ContactModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { BrandLogo } from '@/components/icons/BrandLogo'
import {
  trackCtaClick,
  trackContactFormOpen,
  trackFaqOpen,
  trackHowItWorksView,
  trackVideoComplete,
  trackVideoProgress,
  trackVideoView,
} from '@/lib/analytics'
import { setPendingCreateEventIntent } from '@/lib/contact'
import { cn } from '@/lib/utils'

const SETUP_STEPS = [
  {
    id: 'setup',
    icon: Settings2,
    title: 'בוחרים ומגדירים משחק',
    body: 'כמה קליקים והמשחק שלכם מוכן.',
  },
  {
    id: 'print',
    icon: Printer,
    title: 'מורידים ומדפיסים',
    body: 'מקבלים קובץ כרטיסי QR מוכן להדפסה.',
  },
  {
    id: 'scanner',
    icon: ScanLine,
    title: 'מקבלים מאיתנו סורק',
    body: 'במשחק המלא, הסורק כבר כלול.',
  },
  {
    id: 'play',
    icon: PlugZap,
    title: 'מחברים ומתחילים לשחק',
    body: 'פותחים את Gamify, מחברים את הסורק ומתחילים לסרוק.',
  },
] as const

const EVENT_STEPS = [
  {
    icon: Ticket,
    title: 'הכרטיסים מחולקים - והמשחק יוצא לדרך',
    body: 'כל משתתף מקבל את כרטיס ה-QR שהודפס לאירוע, עם המשימות הרלוונטיות.',
  },
  {
    icon: ScanLine,
    title: 'סורקים וצוברים נקודות',
    body: 'בעמדת הסריקה משלימים משימה, סורקים את הכרטיס - והנקודות נרשמות מיד. פרסים נפתחים אוטומטית כשמגיעים לסף.',
  },
  {
    icon: Trophy,
    title: 'הדירוג מתעדכן מול כולם',
    body: 'מסך "שיאנים בלייב" מציג דירוג משתתפים וקבוצות שמתעדכן עם כל ניקוד. אפשר להקרין אותו כדי שכולם יראו מי מוביל.',
  },
  {
    icon: Flame,
    title: 'התחרות מתחממת',
    body: 'מתח, צחוק וגיבוש - האירוע הופך לחוויה שכולם מדברים עליה.',
  },
] as const

const PRICING_VALUES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'access', label: 'מערכת המשחק', icon: AppWindow },
  { id: 'qr', label: 'קובץ QR להדפסה', icon: QrCode },
  { id: 'scanner', label: 'סורק לשימוש באירוע', icon: ScanLine },
]

const FAQ_ITEMS: { question: string; answer: ReactNode }[] = [
  {
    question: 'מאיפה יהיה לי סורק?',
    answer: 'scanners',
  },
  {
    question: 'אפשר לשחק גם בלי סורק?',
    answer: 'withoutScanner',
  },
  {
    question: 'איך מקבלים את כרטיסי ה-QR?',
    answer:
      'בסיום הגדרת המשחק המערכת מפיקה קובץ כרטיסי QR מוכן להורדה ולהדפסה. מורידים את הקובץ ומדפיסים את הכרטיסים בעצמכם.',
  },
  {
    question: 'כמה זמן לוקח להקים משחק?',
    answer:
      'ברוב המקרים אפשר להקים משחק ראשון בתוך כמה דקות - מהגדרת האירוע והמשימות ועד להורדת קובץ כרטיסי ה-QR להדפסה.',
  },
  {
    question: 'האם אפשר ליצור כמה קבוצות?',
    answer:
      'כן. אפשר לשחק כולם יחד או לחלק את המשתתפים לקבוצות. לכל קבוצה צבע משלה, ולוח השיאים מציג גם את דירוג המשתתפים וגם את דירוג הקבוצות.',
  },
  {
    question: 'איך המשתתפים משחקים?',
    answer:
      'כל משתתף מקבל כרטיס QR מודפס עם המשימות שלו, מבצע אותן במהלך הפעילות וצובר נקודות. במשחק המלא סורקים את הכרטיס בעמדת הסריקה והניקוד מתעדכן אוטומטית. במשחק הבסיסי מזינים את הסריקות ידנית מתוך המערכת.',
  },
  {
    question: 'איך מציגים את הדירוג?',
    answer:
      'ממרכז הבקרה של האירוע פותחים את "שיאנים בלייב" - מסך שמתעדכן בזמן אמת עם כל ניקוד חדש. אפשר להציג אותו על מסך גדול כדי שכולם יעקבו אחרי התחרות.',
  },
  {
    question: 'האם צריך להתקין אפליקציה?',
    answer:
      'לא. Gamify פועלת ישירות מהדפדפן ואין צורך להתקין אפליקציה. גם המשתתפים לא צריכים להתחבר או להוריד דבר - הם משחקים עם כרטיסי ה-QR המודפסים.',
  },
  {
    question: 'צריך ידע טכני כדי להפעיל את המשחק?',
    answer: 'לא. אם אתם יודעים לחבר סורק למחשב ולפתוח דפדפן, אתם מסודרים.',
  },
  {
    question: 'מה עושים אם אין חיבור לאינטרנט במקום האירוע?',
    answer: 'offline',
  },
  {
    question: 'לאילו סוגי אירועים המערכת מתאימה?',
    answer:
      'Gamify מתאימה לימי גיבוש, פעילויות חינוכיות, משחקי ניווט, אירועי חברה, פעילויות קהילתיות וכל פעילות שמבוססת על משימות, ניקוד ותחרות.',
  },
  {
    question: 'אפשר להוסיף משימה לזמן קצוב?',
    answer:
      'כן. אפשר להגדיר משימה שפעילה רק בחלון זמן מסוים - למשל לחצי שעה - ולהוסיף עוד מתח ותחרות למשחק.',
  },
  {
    question: 'כמה עולה להשתמש במערכת?',
    answer: 'pricing',
  },
]

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
}

/** Re-plays when elements re-enter the viewport on scroll. */
const viewportReveal = { once: false, amount: 0.2 } as const

const revealTransition = { duration: 0.55, ease: EASE_OUT } as const

function revealProps(motionSafe: boolean, delay = 0) {
  return {
    initial: motionSafe ? { opacity: 0, y: 28 } : (false as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: viewportReveal,
    transition: { ...revealTransition, delay },
  }
}

export function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { openPlans, isOpen: plansOpen } = usePlansModal()
  const reducedMotion = useReducedMotion()
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactLocation, setContactLocation] = useState<'faq' | 'footer'>('footer')
  const howItWorksRef = useRef<HTMLElement>(null)
  const withoutScannerCtaRef = useRef<HTMLButtonElement>(null)
  const restoreFocusToWithoutScannerRef = useRef(false)

  useEffect(() => {
    if (plansOpen || !restoreFocusToWithoutScannerRef.current) return
    restoreFocusToWithoutScannerRef.current = false
    queueMicrotask(() => withoutScannerCtaRef.current?.focus())
  }, [plansOpen])

  function handleOpenPlans(ctaLocation: string) {
    trackCtaClick({
      cta_name: 'view_pricing',
      cta_location: ctaLocation,
      destination: 'plans_modal',
    })
    openPlans()
  }

  function handleOpenPlansWithoutScanner() {
    trackCtaClick({
      cta_name: 'view_pricing',
      cta_location: 'faq_without_scanner',
      destination: 'plans_modal',
    })
    restoreFocusToWithoutScannerRef.current = true
    openPlans({
      focusPlan: 'independent',
      source: 'faq_without_scanner',
    })
  }

  function handleCreateEventClick() {
    trackCtaClick({
      cta_name: 'create_event',
      cta_location: 'footer',
      destination: user ? '/events' : '/login',
    })
    if (user) {
      navigate('/events')
      return
    }
    setPendingCreateEventIntent()
    navigate(`/login?returnTo=${encodeURIComponent('/events')}`)
  }

  function handleContactClick(location: 'faq' | 'footer') {
    trackCtaClick({
      cta_name: 'contact_us',
      cta_location: location,
      destination: 'contact_modal',
      contact_source: 'homepage_contact',
    })
    trackContactFormOpen({
      contact_source: 'homepage_contact',
      cta_location: location,
    })
    setContactLocation(location)
    setContactOpen(true)
  }

  function scrollToHowItWorks() {
    trackCtaClick({
      cta_name: 'scroll_how_it_works',
      cta_location: 'after_video',
      destination: '#how-it-works',
    })
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleFaq(index: number) {
    setFaqOpenIndex((current) => {
      if (current === index) return null
      trackFaqOpen(FAQ_ITEMS[index].question, index)
      return index
    })
  }

  function renderFaqAnswer(item: (typeof FAQ_ITEMS)[number]) {
    if (item.answer === 'pricing') {
      return (
        <>
          משלמים לפי אירוע - החל מ-₪40.
          {' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => handleOpenPlans('pricing')}
          >
            באפשרויות ההפעלה
          </button>
          {' '}
          תמצאו את המסלולים - משחק בסיסי, משחק מלא ופתרון לארגונים - ואפשר גם לשלוח בקשה
          ונחזור אליכם.
        </>
      )
    }
    if (item.answer === 'scanners') {
      return (
        <>
          במשחק המלא תקבלו מאיתנו סורק מתאים לשימוש באירוע - אין צורך לרכוש סורק בעצמכם.
          {' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => handleOpenPlans('pricing')}
          >
            לכל המחירים והמסלולים
          </button>
          .
        </>
      )
    }
    if (item.answer === 'offline') {
      return (
        <div className="space-y-2.5">
          <p>
            אנחנו עובדים על אפשרות להפעלת Gamify גם ללא חיבור לאינטרנט, ונשמח לשמוע מה
            אתם צריכים.
          </p>
          <button
            type="button"
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            onClick={() => handleContactClick('faq')}
          >
            דברו איתנו
          </button>
        </div>
      )
    }
    if (item.answer === 'withoutScanner') {
      return (
        <div className="space-y-2">
          <p>
            כן. במשחק הבסיסי מעדכנים את הסריקות ידנית מתוך המערכת במקום להשתמש בסורק.
            שאר ניהול המשחק נשאר ב-Gamify כרגיל.
          </p>
          <button
            ref={withoutScannerCtaRef}
            type="button"
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            onClick={handleOpenPlansWithoutScanner}
          >
            למסלולים ולמחירים
          </button>
        </div>
      )
    }
    return item.answer
  }

  const motionSafe = !reducedMotion

  return (
    <div className="relative min-h-screen bg-app-radial atmosphere-landing" dir="rtl">
      <AtmosphericBackground animated={motionSafe} />
      {motionSafe && <FloatingIconsLayer className="fixed inset-0 z-[1] opacity-70" />}

      <div className="relative z-10">
        <GlobalHeader />

        <main className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6">
          {/* 1. Hero */}
          <motion.section
            className="mx-auto mb-10 max-w-2xl text-center sm:mb-12"
            variants={stagger}
            initial={motionSafe ? 'hidden' : false}
            animate="visible"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.55, ease: EASE_OUT }}
              className="mb-6 flex justify-center"
            >
              <motion.div
                animate={
                  motionSafe
                    ? { y: [0, -10, 0], rotate: [0, -2.5, 2.5, 0] }
                    : undefined
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BrandLogo className="h-28 w-28 sm:h-36 sm:w-36 drop-shadow-[0_12px_28px_rgba(171,53,0,0.28)]" />
              </motion.div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.55, ease: EASE_OUT }}
              className="mb-5 text-[34px] font-black leading-[1.2] text-foreground sm:text-[42px]"
            >
              סבתא? דודה?
              <br />
              אחראית על ה-
              <span className={cn('text-primary', motionSafe && 'landing-brand-shimmer')}>Vibe</span>
              {' '}בנופש המשפחתי?
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mb-4 text-lg leading-[1.6] text-foreground"
            >
              מכירים את הרגע בנופש שמישהו אומר...
            </motion.p>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mb-5 text-xl font-bold italic text-muted"
            >
              "טוב... אז מה עושים עכשיו?"
            </motion.p>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mb-5 text-[26px] font-black leading-[1.3] text-foreground sm:text-[30px]"
            >
              עם{' '}
              <span className={cn('text-primary', motionSafe && 'landing-brand-shimmer')}>Gamify</span>
              {' '}זה פשוט לא קורה.
            </motion.p>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto mb-6 max-w-[500px] text-[17px] leading-[1.7] text-foreground"
            >
              הופכים את כל הנופש לכיף אחד גדול עם משימות, אתגרים, תחרויות, ניקוד, פרסים ולוח אלופים שכווווולם רוצים לכבוש.
            </motion.p>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="mx-auto mb-0 max-w-[500px] text-base font-bold leading-[1.6] text-primary [text-shadow:0_0_18px_rgba(171,53,0,0.35)]"
            >
              פחות שעמום, יותר צחוק, יותר גיבוש, ורגעים שלא שוכחים.
            </motion.p>
          </motion.section>

          {/* 2. Video */}
          <motion.section
            className="mb-20 sm:mb-[88px]"
            {...revealProps(motionSafe)}
          >
            <div className="w-full overflow-hidden rounded-2xl bg-foreground/5 shadow-lift">
              <LandingDemoVideo />
            </div>
            <div className="mt-10 text-center">
              <motion.div
                whileHover={motionSafe ? { scale: 1.04 } : undefined}
                whileTap={motionSafe ? { scale: 0.97 } : undefined}
                className="inline-block"
              >
                <Button
                  size="lg"
                  variant="gradient"
                  onClick={scrollToHowItWorks}
                  className="landing-hero-cta !rounded-full !px-12 !py-4 !text-[19px] !font-extrabold"
                >
                  אז איך זה עובד? ↓
                </Button>
              </motion.div>
            </div>
          </motion.section>

          {/* 3. How it works — setup flow */}
          <motion.section
            ref={howItWorksRef}
            id="how-it-works"
            className="mb-20 scroll-mt-24 sm:mb-[88px]"
            {...revealProps(motionSafe)}
            onViewportEnter={trackHowItWorksView}
          >
            <SectionTitle className="mb-3 text-[30px] font-black leading-tight sm:mb-4 sm:text-[38px]">
              איך מקימים משחק?
            </SectionTitle>
            <motion.p
              className="mb-10 mt-0 max-w-2xl text-right text-lg font-semibold leading-[1.65] text-foreground sm:text-xl"
              {...revealProps(motionSafe, 0.06)}
            >
              ארבעה שלבים פשוטים, מההגדרה באתר ועד שמתחילים לשחק.
            </motion.p>

            <SetupSnakeFlow motionSafe={motionSafe} />
          </motion.section>

          {/* 4. Event-time experience */}
          <section className="mb-14 sm:mb-16">
            <SectionTitle>ומה קורה באירוע עצמו?</SectionTitle>
            <motion.p
              className="mb-4 mt-0 max-w-2xl text-right text-base leading-[1.65] text-muted"
              {...revealProps(motionSafe, 0.05)}
            >
              מהרגע שהאורחים מגיעים עם הכרטיסים - ככה נראית החוויה בשטח.
            </motion.p>
            <div className="space-y-2.5 sm:space-y-3">
              {EVENT_STEPS.map((step, index) => (
                <StepCard
                  key={step.title}
                  step={index + 1}
                  icon={step.icon}
                  title={step.title}
                  body={step.body}
                  delay={index * 0.07}
                  motionSafe={motionSafe}
                />
              ))}
            </div>
          </section>

          {/* 5–6. Pricing + try CTA — one conversion block */}
          <div className="mb-16 text-center sm:mb-20">
            <motion.section className="mb-8 sm:mb-9" {...revealProps(motionSafe)}>
              <SectionTitle className="mb-4 text-center sm:mb-5">כמה זה עולה?</SectionTitle>
              <motion.p
                className="mb-3 text-[34px] font-black leading-[1.15] tracking-tight text-primary sm:text-[48px]"
                {...revealProps(motionSafe, 0.05)}
              >
                משחק מלא ב־
                <span className="whitespace-nowrap">₪150</span>
                {' '}לאירוע
              </motion.p>
              <motion.p
                className="mb-8 text-base font-semibold text-foreground sm:text-lg"
                {...revealProps(motionSafe, 0.1)}
              >
                כל מה שצריך לחוויית המשחק, בלי מנוי.
              </motion.p>
              <ul className="mx-auto mb-9 flex max-w-2xl flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                {PRICING_VALUES.map(({ id, label, icon: Icon }, index) => (
                  <motion.li
                    key={id}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface-modal px-4 py-2.5 text-sm font-medium text-foreground shadow-card sm:text-[15px]"
                    {...revealProps(motionSafe, 0.08 + index * 0.06)}
                  >
                    <Icon size={16} strokeWidth={2.25} className="shrink-0 text-primary" aria-hidden="true" />
                    {label}
                  </motion.li>
                ))}
              </ul>
              <motion.div
                whileHover={motionSafe ? { scale: 1.04 } : undefined}
                whileTap={motionSafe ? { scale: 0.97 } : undefined}
                className="inline-block"
                {...revealProps(motionSafe, 0.16)}
              >
                <Button
                  size="lg"
                  variant="gradient"
                  onClick={() => handleOpenPlans('pricing_section')}
                  className="!rounded-full !px-10 !py-3.5 !text-[17px] !font-extrabold"
                >
                  לכל המחירים והמסלולים
                </Button>
              </motion.div>
              <motion.p
                className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-foreground/75"
                {...revealProps(motionSafe, 0.2)}
              >
                מחפשים משהו בסיסי יותר? יש מסלולים החל מ־₪40 לאירוע.
              </motion.p>
            </motion.section>

            <motion.section {...revealProps(motionSafe, 0.08)}>
              <h2 className="mb-2.5 text-xl font-semibold leading-snug text-primary sm:text-[22px]">
                רוצים קודם לראות איך זה עובד אצלכם?
              </h2>
              <p className="mx-auto mb-5 max-w-xl text-base leading-[1.65] text-muted">
                צרו משחק, הגדירו הכול והתנסו במערכת.{' '}
                <span className="font-semibold text-foreground">
                  משלמים רק כשרוצים להפעיל אירוע.
                </span>
              </p>
              <motion.div
                whileHover={motionSafe ? { scale: 1.03 } : undefined}
                whileTap={motionSafe ? { scale: 0.97 } : undefined}
                className="inline-block"
              >
                <Button
                  size="lg"
                  variant="gradient"
                  onClick={handleCreateEventClick}
                  className="!rounded-full !px-10 !py-3.5 !text-[17px] !font-bold"
                >
                  צרו את המשחק הראשון שלכם
                </Button>
              </motion.div>
              <p className="mx-auto mt-2.5 text-sm leading-relaxed text-foreground/70">
                ללא תשלום מראש · ללא התחייבות
              </p>
            </motion.section>
          </div>

          {/* 7. FAQ accordion */}
          <section className="mb-16 sm:mb-20">
            <SectionTitle className="mb-4 sm:mb-5">שאלות נפוצות</SectionTitle>
            <div className="space-y-1.5">
              {FAQ_ITEMS.map((item, index) => (
                <FaqItem
                  key={item.question}
                  id={`faq-panel-${index}`}
                  question={item.question}
                  answer={renderFaqAnswer(item)}
                  open={faqOpenIndex === index}
                  onToggle={() => toggleFaq(index)}
                  motionSafe={motionSafe}
                  delay={index * 0.04}
                />
              ))}
            </div>
            <motion.p
              className="mt-4 text-center text-sm leading-[1.7] text-muted"
              {...revealProps(motionSafe, 0.1)}
            >
              לא מצאתם את התשובה שחיפשתם?{' '}
              <button
                type="button"
                onClick={() => handleContactClick('faq')}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                דברו איתנו
              </button>
            </motion.p>
          </section>

          {/* 8. Contact fallback — after FAQ */}
          <motion.section className="text-center" {...revealProps(motionSafe)}>
            <div className="mx-auto max-w-md border-t border-border/60 pt-8">
              <p className="text-sm font-medium leading-[1.7] text-foreground">
                יש לכם שאלה או אירוע מיוחד?
              </p>
              <p className="mt-1 text-sm leading-[1.7] text-muted">
                נשמח לחשוב איתכם יחד.
              </p>
              <button
                type="button"
                onClick={() => handleContactClick('footer')}
                className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
              >
                דברו איתנו
              </button>
            </div>
          </motion.section>
        </main>
      </div>

      <FloatingContactButton location="floating" variant="pill" hidden={contactOpen} />
      <ContactModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        source="homepage_contact"
        location={contactLocation}
      />
    </div>
  )
}

function LandingDemoVideo() {
  const viewedRef = useRef(false)
  const completedRef = useRef(false)
  const milestonesRef = useRef(new Set<25 | 50 | 75>())

  function handlePlay() {
    if (viewedRef.current) return
    viewedRef.current = true
    trackVideoView('gamify-tour')
  }

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget
    if (!video.duration || !Number.isFinite(video.duration)) return
    const percent = (video.currentTime / video.duration) * 100
    for (const milestone of [25, 50, 75] as const) {
      if (percent >= milestone && !milestonesRef.current.has(milestone)) {
        milestonesRef.current.add(milestone)
        trackVideoProgress(milestone, 'gamify-tour')
      }
    }
  }

  function handleEnded(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (!completedRef.current) {
      completedRef.current = true
      trackVideoComplete('gamify-tour')
    }
    milestonesRef.current.clear()
    const video = e.currentTarget
    video.pause()
    video.currentTime = 0
  }

  return (
    <video
      className="aspect-video w-full bg-[#fff5ef] object-cover"
      controls
      playsInline
      preload="metadata"
      poster="/demo/gamify-tour-poster.jpg"
      dir="ltr"
      onPlay={handlePlay}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    >
      <source src="/demo/gamify-tour.mp4" type="video/mp4" />
    </video>
  )
}

function SectionTitle({
  children,
  className,
}: {
  children: ReactNode
  /** Override spacing — default is tight for a subtitle directly underneath. */
  className?: string
}) {
  const reducedMotion = useReducedMotion()
  const motionSafe = !reducedMotion
  return (
    <motion.h2
      className={cn('mb-2 text-right text-[26px] font-bold text-primary', className)}
      {...revealProps(motionSafe)}
    >
      {children}
    </motion.h2>
  )
}

const SETUP_SNAKE_MS = 2200
const SETUP_ARROW_SLOT = 'w-10 shrink-0' // equal gap for each desktop arrow

function SetupSnakeFlow({
  motionSafe,
}: {
  motionSafe: boolean
}) {
  const [active, setActive] = useState(0)
  const [running, setRunning] = useState(false)
  /** Bumps to restart the interval after hover jumps to a step. */
  const [timelineKey, setTimelineKey] = useState(0)
  const stepCount = SETUP_STEPS.length

  useEffect(() => {
    if (!motionSafe || !running) return
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % stepCount)
    }, SETUP_SNAKE_MS)
    return () => window.clearInterval(id)
  }, [motionSafe, running, stepCount, timelineKey])

  function focusStep(index: number) {
    if (!motionSafe) return
    setActive(index)
    setTimelineKey((key) => key + 1)
  }

  return (
    <motion.div
      className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0"
      onViewportEnter={() => setRunning(true)}
      onViewportLeave={() => setRunning(false)}
      viewport={{ amount: 0.35 }}
    >
      {SETUP_STEPS.map((step, index) => {
        const isActive = !motionSafe || active === index
        const showArrow = motionSafe && active === index && index < stepCount - 1

        return (
          <Fragment key={step.id}>
            <div
              className="flex min-h-0 min-w-0 flex-1 outline-none"
              tabIndex={0}
              onMouseEnter={() => focusStep(index)}
              onFocus={() => focusStep(index)}
            >
              <SetupStepCard
                step={index + 1}
                icon={step.icon}
                title={step.title}
                body={step.body}
                delay={index * 0.08}
                motionSafe={motionSafe}
                active={isActive}
              />
            </div>

            {index < stepCount - 1 && (
              <>
                <div
                  aria-hidden="true"
                  className={cn(
                    'relative hidden shrink-0 items-start justify-center pt-[2.35rem] md:flex',
                    SETUP_ARROW_SLOT,
                  )}
                >
                  <AnimatePresence mode="wait">
                    {showArrow && (
                      <motion.div
                        key={`desk-arrow-${active}`}
                        className="text-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                      >
                        <ChevronLeft size={26} strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div
                  aria-hidden="true"
                  className="flex h-9 items-center justify-center md:hidden"
                >
                  <AnimatePresence mode="wait">
                    {showArrow ? (
                      <motion.div
                        key={`mobile-arrow-${active}`}
                        className="text-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                      >
                        <ChevronDown size={24} strokeWidth={2.5} />
                      </motion.div>
                    ) : (
                      <span className="h-4 w-px bg-primary/15" />
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </Fragment>
        )
      })}
    </motion.div>
  )
}

function SetupStepCard({
  step,
  icon: Icon,
  title,
  body,
  delay,
  motionSafe,
  active,
}: {
  step: number
  icon: LucideIcon
  title: string
  body: ReactNode
  delay: number
  motionSafe: boolean
  active: boolean
}) {
  return (
    <motion.div
      {...revealProps(motionSafe, delay)}
      className="flex h-full w-full min-w-0"
    >
      <Card
        className={cn(
          'relative z-[1] flex h-full w-full cursor-pointer flex-col bg-surface-modal p-5 text-right transition-[box-shadow,border-color,background-color,opacity] duration-500 sm:p-6',
          active
            ? 'border-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_22%,transparent),0_12px_28px_-10px_color-mix(in_srgb,var(--color-primary)_42%,transparent)]'
            : 'border-border opacity-[0.88] shadow-card',
        )}
      >
        <div className="mb-3.5 flex items-center gap-3">
          <span
            className={cn(
              'relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-black transition-all duration-500',
              active
                ? 'bg-primary text-primary-foreground shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_28%,transparent),0_4px_12px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]'
                : 'bg-primary/55 text-primary-foreground',
            )}
          >
            {step}
          </span>
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-500',
              active ? 'bg-primary/15 text-primary' : 'bg-surface-elevated text-primary/80',
            )}
          >
            <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
          </span>
        </div>
        <h3
          className={cn(
            'mb-2 text-base font-bold leading-snug sm:text-lg',
            active ? 'text-primary' : 'text-foreground',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'text-[15px] leading-[1.7] sm:text-base',
            active ? 'text-foreground' : 'text-muted',
          )}
        >
          {body}
        </p>
      </Card>
    </motion.div>
  )
}

function StepCard({
  step,
  icon: Icon,
  title,
  body,
  delay,
  motionSafe,
}: {
  step: number
  icon: LucideIcon
  title: string
  body: string
  delay: number
  motionSafe: boolean
}) {
  return (
    <motion.div
      {...revealProps(motionSafe, delay)}
      whileHover={motionSafe ? { y: -2, transition: { duration: 0.2 } } : undefined}
    >
      <Card className="border-r-[5px] border-r-primary px-4 py-3.5 text-right sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_28%,transparent),0_4px_12px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]">
            {step}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-primary">
            <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <h3 className="text-base font-bold text-primary sm:text-lg">{title}</h3>
        </div>
        <p className="text-[15px] leading-[1.6] text-foreground sm:text-base sm:leading-[1.65]">
          {body}
        </p>
      </Card>
    </motion.div>
  )
}

function FaqItem({
  id,
  question,
  answer,
  open,
  onToggle,
  motionSafe,
  delay = 0,
}: {
  id: string
  question: string
  answer: ReactNode
  open: boolean
  onToggle: () => void
  motionSafe: boolean
  delay?: number
}) {
  return (
    <motion.div
      className="overflow-hidden rounded-lg border border-border bg-surface-modal shadow-card"
      {...revealProps(motionSafe, delay)}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2.5 text-right transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:px-3.5"
        aria-expanded={open}
        aria-controls={id}
      >
        <span className="text-[13px] font-semibold leading-snug text-primary sm:text-sm">{question}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          aria-hidden="true"
          className={cn(
            'shrink-0 text-primary transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="faq-body"
            role="region"
            initial={motionSafe ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={motionSafe ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3 pb-3 pt-2 text-right text-[13px] leading-[1.65] text-foreground sm:px-3.5 sm:text-sm">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
