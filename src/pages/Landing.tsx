import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { BrandLogo } from '@/components/icons/BrandLogo'
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
    question: 'כמה עולה להשתמש במערכת?',
    answer: (
      <>
        <Link to="/plans" className="font-medium text-primary hover:underline">
          בדף המחירון
        </Link>
        {' '}תמצאו את המסלולים - משחק עצמאי, חוויה מלאה ופתרון לארגונים - ואפשר גם לשלוח בקשה ונחזור אליכם.
      </>
    ),
  },
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
]

export function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [faqOpen, setFaqOpen] = useState(() => FAQ_ITEMS.map(() => false))

  function handleCreateEventClick() {
    navigate(user ? '/events' : '/login')
  }

  function toggleFaq(index: number) {
    setFaqOpen((current) => current.map((open, itemIndex) => (itemIndex === index ? !open : open)))
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-radial atmosphere-landing" dir="rtl">
      <AtmosphericBackground />

      <GlobalHeader />

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6">
        <section className="mx-auto mb-20 max-w-2xl text-center sm:mb-[88px]">
          <BrandLogo className="mx-auto mb-6 h-28 w-28 sm:h-36 sm:w-36" />
          <h1 className="mb-5 text-[34px] font-black leading-[1.2] text-foreground sm:text-[42px]">
            סבתא? דודה?
            <br />
            אחראית על ה-<span className="text-primary">Vibe</span> בנופש המשפחתי?
          </h1>

          <p className="mb-4 text-lg leading-[1.6] text-foreground">
            מכירים את הרגע בנופש שמישהו אומר...
          </p>

          <p className="mb-5 text-xl font-bold italic text-muted">
            "טוב... אז מה עושים עכשיו?"
          </p>

          <p className="mb-5 text-[26px] font-black leading-[1.3] text-foreground sm:text-[30px]">
            עם <span className="text-primary">Gamify</span> זה פשוט לא קורה.
          </p>

          <p className="mx-auto mb-6 max-w-[500px] text-[17px] leading-[1.7] text-foreground">
            הופכים את כל הנופש לכיף אחד גדול עם משימות, אתגרים, תחרויות, ניקוד, פרסים ולוח אלופים שכווווולם רוצים לכבוש.
          </p>

          <p className="mx-auto mb-9 max-w-[500px] text-base font-bold leading-[1.6] text-primary [text-shadow:0_0_18px_rgba(171,53,0,0.35)]">
            פחות שעמום, יותר צחוק, יותר גיבוש, ורגעים שלא שוכחים.
          </p>

          <Button
            size="lg"
            variant="gradient"
            onClick={() => navigate('/login')}
            className="landing-hero-cta !rounded-full !px-12 !py-4 !text-[19px] !font-extrabold"
          >
            בואו נשחק
          </Button>
        </section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>כך מתנהל אירוע ב-Gamify</SectionTitle>
          <div className="space-y-5">
            {STEPS.map((step, index) => (
              <StepCard key={step.title} step={index + 1} {...step} />
            ))}
          </div>
        </section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>כל מה שצריך כדי להפעיל משחק מוצלח</SectionTitle>
          <Card className="p-6 sm:p-8">
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-right text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-secondary">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="leading-[1.7]">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mb-20 sm:mb-[88px]">
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
        </section>

        <section className="mb-20 sm:mb-[88px]">
          <SectionTitle>שאלות נפוצות</SectionTitle>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <FaqItem
                key={item.question}
                {...item}
                open={faqOpen[index]}
                onToggle={() => toggleFaq(index)}
              />
            ))}
          </div>
        </section>

        <section className="text-center">
          <h2 className="mb-4 text-[26px] font-bold text-primary">מוכנים להתחיל?</h2>
          <p className="mx-auto mb-8 max-w-xl leading-[1.7] text-muted">
            צרו אירוע, עברו את שלבי ההקמה והדפיסו כרטיסים - תוך דקות תוכלו לראות איך נראה משחק אמיתי עם עמדת סריקה ולוח שיאים חי.
          </p>
          <Button
            size="lg"
            variant="gradient"
            onClick={handleCreateEventClick}
            className="!rounded-xl !px-7 !py-3.5 !text-base !font-semibold"
          >
            צרו את האירוע הראשון שלכם
          </Button>
        </section>
      </main>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 text-right text-[26px] font-bold text-primary sm:mb-8">{children}</h2>
}

function StepCard({
  step,
  icon,
  title,
  body,
}: {
  step: number
  icon: string
  title: string
  body: string
}) {
  return (
    <Card className="border-r-[5px] border-r-primary p-5 text-right sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-sm font-bold text-primary">
          {step}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-lg">
          {icon}
        </span>
        <h3 className="text-lg font-bold text-primary">{title}</h3>
      </div>
      <p className="leading-[1.7] text-foreground">{body}</p>
    </Card>
  )
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string
  answer: ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
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
      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 text-right leading-[1.7] text-foreground sm:px-6 sm:pb-6">
          {answer}
        </div>
      )}
    </Card>
  )
}
