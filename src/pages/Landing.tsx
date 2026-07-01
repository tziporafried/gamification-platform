import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ScanLine, Trophy, Wand2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Wand2,
    title: 'בונים את המשחק באשף',
    body: 'שישה שלבים מלווים אתכם: פרטי הפעילות, חלוקה לקבוצות (כולם יחד או קבוצות נפרדות), הוספת משתתפים, הגדרת משימות וניקוד, פרסים — ובסיום מייצרים ומדפיסים כרטיסי QR מוכנים לאירוע.',
  },
  {
    icon: ScanLine,
    title: 'המשתתפים סורקים וצוברים נקודות',
    body: 'בעמדת הסריקה, כשמשתתף משלים משימה הוא סורק את כרטיס ה-QR שקיבל מראש — והנקודות נרשמות מיד. פרסים נפתחים אוטומטית כשמגיעים לסף הנדרש.',
  },
  {
    icon: Trophy,
    title: 'התחרות נשארת חיה על המסך',
    body: 'מסך «שיאנים בלייב» נפתח בלשונית נפרדת ומציג דירוג משתתפים וקבוצות שמתעדכן עם כל ניקוד. אפשר להקרין אותו על מסך גדול כדי שכולם יראו מי מוביל.',
  },
] as const

const FEATURES = [
  'אשף הקמה בשישה שלבים',
  'חלוקה לקבוצות או משחק משותף',
  'ניהול משתתפים, משימות ופרסים',
  'יצירה והדפסה של כרטיסי QR',
  'עמדת סריקה לניקוד אוטומטי',
  'לוח שיאים חי להקרנה',
  'מרכז בקרה לאירוע',
] as const

const FAQ_ITEMS = [
  {
    question: 'כמה עולה להשתמש במערכת?',
    answer: 'יש מסלול התנסות חינמי עם מגבלות (למשל עד 2 משתתפים ו-3 משימות). מסלולים בתשלום — משחק עצמאי, חוויה מלאה ופתרון לארגונים — מפורטים בדף המסלולים, ואפשר גם לשלוח בקשה ונחזור אליכם.',
  },
  {
    question: 'כמה זמן לוקח להקים משחק?',
    answer: 'ברוב המקרים ניתן להקים משחק ראשון בתוך מספר דקות באמצעות האשף — מהגדרת פרטי האירוע ועד להדפסת כרטיסי QR.',
  },
  {
    question: 'האם אפשר ליצור כמה קבוצות?',
    answer: 'כן. בוחרים «כולם יחד» או יוצרים קבוצות עם צבעים נפרדים. לוח השיאים מציג גם דירוג משתתפים וגם דירוג קבוצות.',
  },
  {
    question: 'איך המשתתפים משחקים?',
    answer: 'למשתתפים אין התחברות לאפליקציה. כל משתתף מקבל כרטיס QR מודפס עם המשימות הרלוונטיות, מבצע את הפעילות בשטח, ובעמדת הסריקה סורק את הכרטיס — והנקודות מתעדכנות אוטומטית.',
  },
  {
    question: 'איך מציגים את הדירוג?',
    answer: 'ממרכז הבקרה של האירוע פותחים את «שיאנים בלייב» — מסך נפרד שמתעדכן עם כל ניקוד חדש. אפשר להקרין אותו על מסך גדול.',
  },
  {
    question: 'האם צריך להתקין אפליקציה?',
    answer: 'לא. מנהלי האירוע עובדים מהדפדפן — אשף ההקמה, עמדת הסריקה ולוח השיאים. למשתתפים מספיקים כרטיסי QR מודפסים ועמדת סריקה באירוע.',
  },
  {
    question: 'לאילו סוגי אירועים המערכת מתאימה?',
    answer: 'ימי גיבוש, פעילויות חינוכיות, משחקי ניווט, אירועי חברה, פעילויות קהילתיות וכל פעילות המבוססת על משימות, ניקוד ותחרות.',
  },
] as const

export function Landing() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-app-radial atmosphere-landing">
      <AtmosphericBackground />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/85 backdrop-blur-[20px]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-sm font-bold text-foreground shadow-card">
              G
            </div>
            <span className="text-lg font-bold text-primary">Gamify</span>
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            התחברות
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        {/* Hero */}
        <section className="mb-16 text-center sm:mb-20">
          <h1 className="mb-5 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Gamify
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-foreground sm:text-xl">
            הדרך הפשוטה להפוך כל פעילות, יום גיבוש או אירוע למשחק מונחה משימות — עם ניקוד, קבוצות, כרטיסי QR ולוח שיאים חי.
          </p>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted">
            בלי קבצי אקסל ובלי לעבור בין כמה מערכות.
            מגדירים את המשחק באשף, מדפיסים כרטיסים, ומנהלים את האירוע והדירוג מהדפדפן.
          </p>
          <div className="mt-8">
            <Button size="lg" variant="gradient" loading={loading} onClick={handleGoogleSignIn}>
              <GoogleIcon className="ml-2 h-5 w-5" />
              התחילו ליצור – עם Google
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-16 sm:mb-20">
          <h2 className="mb-8 text-2xl font-bold text-primary sm:text-3xl">
            כך מתנהל אירוע ב־Gamify
          </h2>
          <div className="space-y-5">
            {STEPS.map((step, index) => (
              <StepCard key={step.title} step={index + 1} {...step} />
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16 sm:mb-20">
          <h2 className="mb-6 text-2xl font-bold text-primary sm:text-3xl">
            כל מה שצריך כדי להפעיל משחק מוצלח
          </h2>
          <Card className="p-6 sm:p-8">
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-secondary">
                    <Check size={13} strokeWidth={2.5} />
                  </span>
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Try it */}
        <section className="mb-16 sm:mb-20">
          <h2 className="mb-6 text-2xl font-bold text-primary sm:text-3xl">
            עדיין לא בטוחים איך זה עובד?
          </h2>
          <Card className="space-y-4 p-6 leading-relaxed text-foreground sm:p-8">
            <p>אין צורך להתחייב לפני שמבינים את המערכת.</p>
            <p>אחרי ההתחברות אפשר ליצור אירוע התנסות חינמי ולעבור על כל שלבי האשף.</p>
            <p>
              האשף מוביל אתכם שלב אחר שלב — מהגדרת פרטי האירוע, דרך משתתפים ומשימות, ועד להדפסת כרטיסי QR ופתיחת מרכז הבקרה.
            </p>
            <p className="font-medium text-primary">
              הדרך הטובה ביותר להכיר את Gamify היא פשוט ליצור אירוע ולהריץ אותו.
            </p>
          </Card>
        </section>

        {/* FAQ */}
        <section className="mb-16 sm:mb-20">
          <h2 className="mb-6 text-2xl font-bold text-primary sm:text-3xl">
            שאלות נפוצות
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.question} {...item} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-primary sm:text-3xl">
            מוכנים להתחיל?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl leading-relaxed text-muted">
            צרו אירוע התנסות, עברו את האשף והדפיסו כרטיסים — תוך דקות תוכלו לראות איך נראה משחק אמיתי עם עמדת סריקה ולוח שיאים חי.
          </p>
          <Button size="lg" variant="gradient" loading={loading} onClick={handleGoogleSignIn}>
            <GoogleIcon className="ml-2 h-5 w-5" />
            צרו את האירוע הראשון שלכם
          </Button>
        </section>
      </main>
    </div>
  )
}

function StepCard({
  step,
  icon: Icon,
  title,
  body,
}: {
  step: number
  icon: typeof Wand2
  title: string
  body: string
}) {
  return (
    <Card className="border-r-[5px] border-r-primary p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-sm font-bold text-primary">
          {step}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated text-secondary">
          <Icon size={18} />
        </div>
        <h3 className="text-lg font-bold text-primary">{title}</h3>
      </div>
      <p className="leading-relaxed text-foreground">{body}</p>
    </Card>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 p-5 text-right transition-colors hover:bg-surface-elevated/50 sm:p-6"
        aria-expanded={open}
      >
        <span className="font-bold text-primary">{question}</span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 leading-relaxed text-foreground sm:px-6 sm:pb-6">
          {answer}
        </div>
      )}
    </Card>
  )
}
