import { Link } from 'react-router-dom'
import { SiteFooter, OWNER_NAME } from '@/components/layout/SiteFooter'

/**
 * Plain-language usage terms. General wording only — this is not legal advice
 * and has not been reviewed by a lawyer.
 */
export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-5 py-12 text-right sm:px-6 sm:py-16">
        <Link
          to="/"
          className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          חזרה לדף הבית
        </Link>

        <h1 className="mt-6 text-3xl font-black leading-snug text-foreground sm:text-4xl">
          תנאי שימוש
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          עודכן לאחרונה: יולי 2026
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-foreground">שימוש מותר</h2>
          <p className="text-base leading-[1.8] text-foreground">
            הפלטפורמה מיועדת לניהול והפעלה של אירועי גיימיפיקציה על ידי משתמשים
            רשומים. השימוש מותר למטרה זו בלבד, בהתאם לתנאים שלהלן.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-foreground">שימוש אסור</h2>
          <p className="text-base leading-[1.8] text-foreground">
            אין לבצע, ללא אישור מראש ובכתב מבעלי הפלטפורמה:
          </p>
          <ul className="list-disc space-y-2 pr-5 text-base leading-[1.8] text-foreground">
            <li>
              העתקה, שכפול או יצירת יצירה נגזרת של העיצוב, התוכן או נכסי המשחק.
            </li>
            <li>
              איסוף אוטומטי של תוכן מהאתר (scraping), לרבות באמצעות סקריפטים,
              סורקים או כלים אוטומטיים אחרים.
            </li>
            <li>
              שימוש באתר כמקור השראה או כ־reference ליצירת מוצר מתחרה או חיקוי
              מסחרי.
            </li>
            <li>
              שימוש בתוכן האתר לצורך אימון, כוונון או הפעלה של מערכות בינה
              מלאכותית.
            </li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-foreground">קניין רוחני</h2>
          <p className="text-base leading-[1.8] text-foreground">
            מלוא זכויות היוצרים בעיצוב, בתוכן ובנכסי המשחק שמורות ל־{OWNER_NAME}.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-foreground">הערה</h2>
          <p className="text-base leading-[1.8] text-muted">
            מסמך זה מנוסח בשפה כללית לצורכי הבהרה בלבד, ואינו מהווה ייעוץ משפטי
            או תחליף לו.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
