import { Link, useSearchParams } from 'react-router-dom'
import { Monitor, Globe, Power, ScanLine, Keyboard, MousePointer2, AppWindow } from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * Standalone help page for running an exported offline game and its scanner.
 * Linked from the admin offline export UI (AdminScannersPanel) - opened in a
 * new tab so it never interrupts the export workflow.
 *
 * Two groups of instructions, deliberately labelled: the "same computer / same
 * browser / survives shutdown" rules apply ONLY to offline games, while the
 * scanner rules apply to every game (online and offline alike).
 */

type Step = {
  icon: typeof Monitor
  title: string
  body: string
}

const OFFLINE_STEPS: Step[] = [
  {
    icon: Monitor,
    title: 'השתמשו תמיד באותו מחשב',
    body: 'כל נתוני המשחק נשמרים על המחשב שבו פתחתם את הקובץ. פתיחה במחשב אחר תיצור משחק חדש ללא ההתקדמות הקודמת.',
  },
  {
    icon: Globe,
    title: 'פתחו תמיד באותו דפדפן',
    body: 'הנתונים נשמרים בדפדפן שבו המשחק נפתח לראשונה. הקפידו להמשיך את המשחק מאותו דפדפן.',
  },
  {
    icon: Power,
    title: 'גם אחרי כיבוי – הכול נשמר',
    body: 'אם המחשב נכבה, הופעל מחדש או שהדפדפן נסגר – אין צורך להתחיל מחדש. פשוט פתחו שוב את קובץ המשחק והמשיכו בדיוק מהמקום שבו הפסקתם.',
  },
]

const SCANNER_STEPS: Step[] = [
  {
    icon: ScanLine,
    title: 'הסורק מחובר ומוכן',
    body: 'ודאו שהסורק מחובר למחשב ופועל לפני תחילת המשחק.',
  },
  {
    icon: Keyboard,
    title: 'שפת ההקלדה באנגלית',
    body: 'הסורק מקליד את הנתונים כמו מקלדת, לכן חשוב ששפת ההקלדה תהיה אנגלית (EN). אם המקלדת על עברית, הסריקות לא ייקלטו כראוי.',
  },
  {
    icon: AppWindow,
    title: 'השאירו את המשחק פתוח',
    body: 'ודאו שחלון המשחק פתוח ופעיל בזמן הסריקה. מעבר לחלון אחר ימנע מהסריקות להיקלט.',
  },
  {
    icon: MousePointer2,
    title: 'התחילו עם מסך נקי',
    body: 'לפני הסריקה, לחצו על אזור ריק במסך כדי לוודא שהסמן אינו נמצא בתוך שדה הקלדה.',
  },
]

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary-text">
        <Icon size={22} />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground">{step.title}</h3>
        <p className="text-sm leading-[1.7] text-muted">{step.body}</p>
      </div>
    </li>
  )
}

function SectionBadge({ tone, children }: { tone: 'offline' | 'all'; children: string }) {
  const styles =
    tone === 'offline'
      ? 'bg-warning/15 text-warning-text'
      : 'bg-secondary/15 text-secondary-text'
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {children}
    </span>
  )
}

interface OfflineInstructionsPageProps {
  /** Where the back link goes. Defaults to the event's control center (from the
   *  ?event= param) online; the offline player passes the hub route instead. */
  backTo?: string
  backLabel?: string
  /** The footer links to /terms, which doesn't exist in the offline player. */
  showFooter?: boolean
}

export function OfflineInstructionsPage({
  backTo,
  backLabel,
  showFooter = true,
}: OfflineInstructionsPageProps = {}) {
  const [params] = useSearchParams()
  const eventId = params.get('event')
  const resolvedBackTo = backTo ?? (eventId ? `/events/${eventId}/control` : '/')
  const resolvedBackLabel = backLabel ?? (eventId ? 'חזרה ללוח הבקרה' : 'חזרה לדף הבית')

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="mx-auto max-w-3xl px-5 py-12 text-right sm:px-6 sm:py-16">
        <Link
          to={resolvedBackTo}
          className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          {resolvedBackLabel}
        </Link>

        <h1 className="mt-6 text-3xl font-black leading-snug text-foreground sm:text-4xl">
          הוראות הפעלה
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          כל מה שצריך לדעת כדי להפעיל את המשחק בצורה חלקה. מומלץ לעבור על ההוראות
          לפני תחילת האירוע.
        </p>

        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">הפעלת הסורק</h2>
            <SectionBadge tone="all">רלוונטי לכל המשחקים</SectionBadge>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            ההוראות הבאות תקפות לכל סוגי המשחקים – אונליין ואופליין.
          </p>
          <ul className="space-y-3">
            {SCANNER_STEPS.map((step) => (
              <StepCard key={step.title} step={step} />
            ))}
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">הפעלת המשחק במצב אופליין</h2>
            <SectionBadge tone="offline">רלוונטי רק למשחקי אופליין</SectionBadge>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            במצב אופליין כל המשחק פועל מתוך קובץ אחד, ללא צורך בחיבור לאינטרנט.
            כדי שכל ההתקדמות תישמר, חשוב להקפיד על ההנחיות הבאות.
          </p>
          <ul className="space-y-3">
            {OFFLINE_STEPS.map((step) => (
              <StepCard key={step.title} step={step} />
            ))}
          </ul>
        </section>
      </main>

      {showFooter && <SiteFooter />}
    </div>
  )
}
