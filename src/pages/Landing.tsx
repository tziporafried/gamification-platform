import { useState, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import { FloatingContactButton } from '@/components/layout/FloatingContactButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { BrandLogo } from '@/components/icons/BrandLogo'
import {
  trackCtaClick,
  trackFaqOpen,
  trackVideoComplete,
  trackVideoProgress,
  trackVideoView,
} from '@/lib/analytics'
import { LANDING_CONTACT_PATH } from '@/lib/contact'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: '🪄',
    title: 'בונים את המשחק בכמה קליקים',
    body: 'שישה שלבים מלווים אתכם: פרטי הפעילות, חלוקה לקבוצות (כולם יחד או קבוצות נפרדות), הוספת משתתפים, הגדרת משימות וניקוד, פרסים - ובסיום מייצרים ומדפיסים כרטיסי QR מוכנים לאירוע.',
  },
  {
    icon: '📱',
    title: 'המשתתפים סורקים וצוברים נקודות',
    body: 'בעמדת הסריקה, כשמשתתף משלים משימה הוא סורק את כרטיס ה-QR שקיבל מראש - והנקודות נרשמות מיד. פרסים נפתחים אוטומטית כשמגיעים לסף הנדרש.',
  },
  {
    icon: '🏆',
    title: 'התחרות נשארת חיה על המסך',
    body: 'מסך "שיאנים בלייב" נפתח בלשונית נפרדת ומציג דירוג משתתפים וקבוצות שמתעדכן עם כל ניקוד. אפשר להקרין אותו על מסך גדול כדי שכולם יראו מי מוביל.',
  },
] as const

const FEATURES = [
  'הקמה קלילה בשישה שלבים',
  'חלוקה לקבוצות או משחק משותף',
  'ניהול משתתפים, משימות ופרסים',
  'יצירה והדפסה של כרטיסי QR',
  'עמדת סריקה לניקוד אוטומטי',
  'לוח שיאים חי להקרנה',
  'מרכז בקרה לאירוע',
] as const

const FAQ_ITEMS: { question: string; answer: ReactNode }[] = [
  {
    question: 'כמה זמן לוקח להקים משחק?',
    answer: 'ברוב המקרים ניתן להקים משחק ראשון בתוך מספר דקות בתהליך הקמה קליל - מהגדרת פרטי האירוע ועד להדפסת כרטיסי QR.',
  },
  {
    question: 'האם אפשר ליצור כמה קבוצות?',
    answer: 'כן. בוחרים "כולם יחד" או יוצרים קבוצות עם צבעים נפרדים. לוח השיאים מציג גם דירוג משתתפים וגם דירוג קבוצות.',
  },
  {
    question: 'איך המשתתפים משחקים?',
    answer: 'למשתתפים אין התחברות לאפליקציה. כל משתתף מקבל כרטיס QR מודפס עם המשימות הרלוונטיות, מבצע את הפעילות בשטח, ובעמדת הסריקה סורק את הכרטיס - והנקודות מתעדכנות אוטומטית.',
  },
  {
    question: 'איך מציגים את הדירוג?',
    answer: 'ממרכז הבקרה של האירוע פותחים את "שיאנים בלייב" - מסך נפרד שמתעדכן עם כל ניקוד חדש. אפשר להקרין אותו על מסך גדול.',
  },
  {
    question: 'האם צריך להתקין אפליקציה?',
    answer: 'לא. מנהלי האירוע עובדים מהדפדפן - תהליך ההקמה, עמדת הסריקה ולוח השיאים. למשתתפים מספיקים כרטיסי QR מודפסים ועמדת סריקה באירוע.',
  },
  {
    question: 'לאילו סוגי אירועים המערכת מתאימה?',
    answer: 'ימי גיבוש, פעילויות חינוכיות, משחקי ניווט, אירועי חברה, פעילויות קהילתיות וכל פעילות המבוססת על משימות, ניקוד ותחרות.',
  },
  {
    question: 'אפשר להוסיף משימה לזמן קצוב?',
    answer: 'בהחלט. אפשר להגדיר משימה שתקפה רק לחלון זמן מסוים - למשל חצי שעה. זה מוסיף מתח, מגביר את הכיף ומחזק את התחרות בין המשתתפים.',
  },
  {
    question: 'כמה עולה להשתמש במערכת?',
    answer: (
      <>
        <Link
          to="/plans"
          className="font-medium text-primary hover:underline"
          onClick={() =>
            trackCtaClick({
              cta_name: 'view_pricing',
              cta_location: 'pricing',
              destination: '/plans',
            })
          }
        >
          בדף המחירון
        </Link>
        {' '}תמצאו את המסלולים - משחק עצמאי, חוויה מלאה ופתרון לארגונים - ואפשר גם לשלוח בקשה ונחזור אליכם.
      </>
    ),
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

const viewportOnce = { once: true, amount: 0.25 } as const

export function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [faqOpen, setFaqOpen] = useState(() => FAQ_ITEMS.map(() => false))

  function handleCreateEventClick() {
    const destination = user ? '/events' : '/login'
    trackCtaClick({
      cta_name: 'create_event',
      cta_location: 'footer',
      destination,
    })
    navigate(destination)
  }

  function handleContactClick(location: 'faq' | 'footer') {
    trackCtaClick({
      cta_name: 'contact_us',
      cta_location: location,
      destination: LANDING_CONTACT_PATH,
    })
  }

  function toggleFaq(index: number) {
    setFaqOpen((current) => {
      const willOpen = !current[index]
      if (willOpen) {
        trackFaqOpen(FAQ_ITEMS[index].question, index)
      }
      return current.map((open, itemIndex) => (itemIndex === index ? !open : open))
    })
  }

  const motionSafe = !reducedMotion

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-radial atmosphere-landing" dir="rtl">
      <AtmosphericBackground animated={motionSafe} />
      {motionSafe && <FloatingIconsLayer className="fixed inset-0 z-[1] opacity-70" />}

      <GlobalHeader />

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6">
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

        <motion.section
          className="mb-20 sm:mb-[88px]"
          initial={motionSafe ? { opacity: 0, y: 28 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE_OUT }}
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
                onClick={() => {
                  trackCtaClick({
                    cta_name: 'start_now',
                    cta_location: 'after_video',
                    destination: '/login',
                  })
                  navigate('/login')
                }}
                className="landing-hero-cta !rounded-full !px-12 !py-4 !text-[19px] !font-extrabold"
              >
                בואו נשחק
              </Button>
            </motion.div>
          </div>
        </motion.section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>כך מתנהל אירוע ב-Gamify</SectionTitle>
          <div className="space-y-5">
            {STEPS.map((step, index) => (
              <StepCard
                key={step.title}
                step={index + 1}
                {...step}
                delay={index * 0.1}
                motionSafe={motionSafe}
              />
            ))}
          </div>
        </section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>כל מה שצריך כדי להפעיל משחק מוצלח</SectionTitle>
          <motion.div
            initial={motionSafe ? { opacity: 0, y: 24 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <Card className="p-6 sm:p-8">
              <motion.ul
                className="space-y-3"
                variants={stagger}
                initial={motionSafe ? 'hidden' : false}
                whileInView="visible"
                viewport={viewportOnce}
              >
                {FEATURES.map((feature) => (
                  <motion.li
                    key={feature}
                    variants={fadeUp}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                    className="flex items-start gap-3 text-right text-foreground"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-secondary">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="leading-[1.7]">{feature}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </Card>
          </motion.div>
        </section>

        <motion.section
          className="mb-20 sm:mb-[88px]"
          initial={motionSafe ? { opacity: 0, y: 24 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <SectionTitle>עדיין לא בטוחים איך זה עובד?</SectionTitle>
          <Card className="space-y-4 p-6 text-right text-foreground sm:p-8">
            <p className="leading-[1.7]">אין צורך להתחייב לפני שמבינים את המערכת.</p>
            <p className="leading-[1.7]">אחרי ההתחברות אפשר ליצור אירוע ולעבור על כל שלבי ההקמה.</p>
            <p className="leading-[1.7]">
              תהליך ההקמה מוביל אתכם שלב אחר שלב - מהגדרת פרטי האירוע, דרך משתתפים ומשימות, ועד להדפסת כרטיסי QR ופתיחת מרכז הבקרה.
            </p>
            <p className="font-medium leading-[1.7] text-primary">
              הדרך הטובה ביותר להכיר את Gamify היא פשוט ליצור אירוע ולהריץ אותו.
            </p>
          </Card>
        </motion.section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>שאלות נפוצות</SectionTitle>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <FaqItem
                key={item.question}
                {...item}
                open={faqOpen[index]}
                onToggle={() => toggleFaq(index)}
                motionSafe={motionSafe}
                delay={index * 0.04}
              />
            ))}
          </div>
          <p className="mt-5 text-center text-sm leading-[1.7] text-muted">
            לא מצאתם את התשובה שחיפשתם?{' '}
            <Link
              to={LANDING_CONTACT_PATH}
              onClick={() => handleContactClick('faq')}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              דברו איתנו
            </Link>
          </p>
        </section>

        <motion.section
          className="text-center"
          initial={motionSafe ? { opacity: 0, scale: 0.96 } : false}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          <h2 className="mb-4 text-[26px] font-bold text-primary">מוכנים להתחיל?</h2>
          <p className="mx-auto mb-8 max-w-xl leading-[1.7] text-muted">
            צרו את האירוע הראשון שלכם ותראו איך Gamify עובד בפועל.
          </p>
          <motion.div
            whileHover={motionSafe ? { scale: 1.04 } : undefined}
            whileTap={motionSafe ? { scale: 0.97 } : undefined}
            className="inline-block"
          >
            <Button
              size="lg"
              variant="gradient"
              onClick={handleCreateEventClick}
              className="landing-hero-cta !rounded-full !px-12 !py-4 !text-[19px] !font-extrabold"
            >
              צרו את האירוע הראשון שלכם
            </Button>
          </motion.div>

          <div className="mx-auto mt-10 max-w-md border-t border-border/60 pt-8">
            <p className="text-sm font-medium leading-[1.7] text-foreground">
              יש לכם שאלה או אירוע מיוחד?
            </p>
            <p className="mt-1 text-sm leading-[1.7] text-muted">
              נשמח לחשוב איתכם יחד.
            </p>
            <Link
              to={LANDING_CONTACT_PATH}
              onClick={() => handleContactClick('footer')}
              className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
            >
              דברו איתנו
            </Link>
          </div>
        </motion.section>
      </main>

      <FloatingContactButton location="floating" variant="pill" />
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
    // Prefer the opening frame over a blank/black post-ended state.
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

function SectionTitle({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.h2
      className="mb-6 text-right text-[26px] font-bold text-primary sm:mb-8"
      initial={reducedMotion ? false : { opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.h2>
  )
}

function StepCard({
  step,
  icon,
  title,
  body,
  delay,
  motionSafe,
}: {
  step: number
  icon: string
  title: string
  body: string
  delay: number
  motionSafe: boolean
}) {
  return (
    <motion.div
      initial={motionSafe ? { opacity: 0, x: 28 } : false}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      whileHover={motionSafe ? { y: -3, transition: { duration: 0.2 } } : undefined}
    >
      <Card className="border-r-[5px] border-r-primary p-5 text-right sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-sm font-bold text-primary">
            {step}
          </span>
          <motion.span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-lg"
            animate={
              motionSafe
                ? { y: [0, -4, 0], rotate: [0, -6, 6, 0] }
                : undefined
            }
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: step * 0.35,
            }}
          >
            {icon}
          </motion.span>
          <h3 className="text-lg font-bold text-primary">{title}</h3>
        </div>
        <p className="leading-[1.7] text-foreground">{body}</p>
      </Card>
    </motion.div>
  )
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
  motionSafe,
  delay,
}: {
  question: string
  answer: ReactNode
  open: boolean
  onToggle: () => void
  motionSafe: boolean
  delay: number
}) {
  return (
    <motion.div
      initial={motionSafe ? { opacity: 0, y: 12 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
    >
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 p-5 text-right transition-colors hover:bg-surface-elevated/50 sm:px-6"
          aria-expanded={open}
        >
          <span className="font-bold text-primary">{question}</span>
          <span
            className={cn(
              'shrink-0 text-lg font-light leading-none text-muted transition-transform duration-200',
              open && 'rotate-45',
            )}
          >
            +
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="faq-body"
              initial={motionSafe ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={motionSafe ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="border-t border-border px-5 pb-5 pt-4 text-right leading-[1.7] text-foreground sm:px-6 sm:pb-6">
                {answer}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}
