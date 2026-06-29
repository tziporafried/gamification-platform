import { useState, useRef, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Option = 'independent' | 'full' | 'organizations'

const OPTIONS: Record<Option, string> = {
  independent: 'משחק עצמאי',
  full: 'חוויה מלאה',
  organizations: 'פתרון לארגונים',
}

const LIMIT_TYPE_MAP: Record<Option, string> = {
  independent: 'plan-independent',
  full: 'plan-full',
  organizations: 'plan-organizations',
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

export function PlansPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const formRef = useRef<HTMLDivElement>(null)

  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [email, setEmail] = useState(profile?.email || user?.email || '')
  const [phone, setPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [participantCount, setParticipantCount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedOption && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }, [selectedOption])

  function handleChoose(option: Option) {
    setSelectedOption(option)
    setSubmitted(false)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName) { setError('שם מלא הוא שדה חובה'); return }
    if (!trimmedEmail) { setError('אימייל הוא שדה חובה'); return }
    if (!trimmedPhone) { setError('מספר טלפון הוא שדה חובה'); return }

    setSubmitting(true)

    const noteParts: string[] = []
    if (eventDate.trim()) noteParts.push(`תאריך האירוע: ${eventDate.trim()}`)
    if (participantCount.trim()) noteParts.push(`מספר משתתפים: ${participantCount.trim()}`)
    if (notes.trim()) noteParts.push(`הערות: ${notes.trim()}`)
    const combinedNotes = noteParts.join('\n') || null

    const { error: insertError } = await supabase
      .from('contact_upgrade_requests')
      .insert({
        user_id: user!.id,
        full_name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        notes: combinedNotes,
        limit_type: LIMIT_TYPE_MAP[selectedOption!],
      })

    if (insertError) {
      setError('שגיאה בשליחת הבקשה. נסו שנית.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSubmitted(true)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10" dir="rtl">
      <button
        onClick={() => navigate(-1)}
        className="mb-10 flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowRight size={15} />
        חזרה
      </button>

      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold text-white mb-3 leading-snug">
          איך תרצו להפעיל את המשחק באירוע שלכם?
        </h1>
        <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
          בחרו את האפשרות המתאימה לכם.
          <br />
          לאחר הבחירה ניצור אתכם קשר ונעזור לכם להפיק אירוע בלתי נשכח.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-12">

        {/* Card 1 — משחק עצמאי */}
        <OptionCard
          selected={selectedOption === 'independent'}
        >
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">🎮</span>
              <span className="text-base font-bold text-white">משחק עצמאי</span>
            </div>
            <div className="flex items-end gap-1 mt-2">
              <span className="text-2xl font-extrabold text-white">40</span>
              <span className="mb-0.5 text-sm text-gray-400">₪ לאירוע</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              מתאים למי שרוצה להפעיל את המשחק באופן עצמאי.
            </p>
          </div>

          <div className="flex-1 space-y-2 mb-5">
            {INDEPENDENT_INCLUDES.map(item => (
              <FeatureRow key={item} included text={item} />
            ))}
            {INDEPENDENT_EXCLUDES.map(item => (
              <FeatureRow key={item} included={false} text={item} />
            ))}
          </div>

          <Button
            variant={selectedOption === 'independent' ? 'gradient' : 'outline'}
            size="md"
            className="w-full font-medium"
            onClick={() => handleChoose('independent')}
          >
            אני מעוניין במשחק עצמאי
          </Button>
        </OptionCard>

        {/* Card 2 — חוויה מלאה */}
        <div className="relative">
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
            <span className="rounded-full bg-brand-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
              הכי פופולרי
            </span>
          </div>
          <OptionCard
            featured
            selected={selectedOption === 'full'}
          >
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <span className="text-base font-bold text-white">חוויה מלאה</span>
              </div>
              <div className="flex items-end gap-1 mt-2">
                <span className="text-2xl font-extrabold text-white">150</span>
                <span className="mb-0.5 text-sm text-gray-400">₪ לאירוע</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">יום פעילות נוסף: 15 ₪</p>
              <p className="mt-1 text-xs text-gray-500">עד 50 משתתפים</p>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                הפתרון המלא להפעלת המשחק.
              </p>
            </div>

            <div className="flex-1 space-y-2 mb-5">
              {INDEPENDENT_INCLUDES.map(item => (
                <FeatureRow key={item} included text={item} />
              ))}
              {FULL_EXTRAS.map(item => (
                <FeatureRow key={item} included text={item} highlight />
              ))}
            </div>

            <Button
              variant="gradient"
              size="md"
              className="w-full font-medium"
              onClick={() => handleChoose('full')}
            >
              אני מעוניין בחוויה המלאה
            </Button>
          </OptionCard>
        </div>

        {/* Card 3 — פתרון לארגונים */}
        <OptionCard
          selected={selectedOption === 'organizations'}
        >
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">🏫</span>
              <span className="text-base font-bold text-white">פתרון לארגונים</span>
            </div>
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              מתאים לבתי ספר, קייטנות, ישיבות, חברות, קהילות וארגונים.
            </p>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              נשמח להתאים את המערכת בדיוק לצרכים שלכם.
            </p>
          </div>

          <div className="flex-1" />

          <Button
            variant={selectedOption === 'organizations' ? 'gradient' : 'outline'}
            size="md"
            className="w-full font-medium"
            onClick={() => handleChoose('organizations')}
          >
            אני מעוניין בפתרון מותאם
          </Button>
        </OptionCard>
      </div>

      {/* Contact form — appears when an option is chosen */}
      {selectedOption && (
        <div ref={formRef} className="scroll-mt-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-game-border bg-game-card p-7 shadow-card">
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
                  <CheckCircle size={26} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">הפנייה נשלחה בהצלחה</p>
                  <p className="mt-1 text-sm text-gray-400">ניצור אתכם קשר בהקדם.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="mb-1 text-lg font-bold text-white">ספרו לנו על האירוע שלכם</h2>
                <p className="mb-5 text-sm text-gray-400">נחזור אליכם בהקדם ונעזור לכם להתחיל.</p>

                {/* Selected option tag */}
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-brand-600/10 border border-brand-500/20 px-4 py-2.5">
                  <span className="text-xs font-semibold text-brand-400">האפשרות שבחרתם</span>
                  <span className="text-xs text-white font-medium">{OPTIONS[selectedOption]}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">שם מלא *</label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">טלפון *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="050-1234567"
                        dir="ltr"
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-400">אימייל *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      dir="ltr"
                      className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">תאריך האירוע</label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">מספר משתתפים משוער</label>
                      <input
                        type="number"
                        min="1"
                        value={participantCount}
                        onChange={(e) => setParticipantCount(e.target.value)}
                        placeholder="50"
                        dir="ltr"
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-400">הערות</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="ספרו לנו על האירוע שלכם..."
                      rows={3}
                      className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                    />
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <Button
                    type="submit"
                    variant="gradient"
                    size="lg"
                    loading={submitting}
                    className="w-full font-semibold"
                  >
                    שלחו את הפרטים
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function OptionCard({
  children,
  featured,
  selected,
}: {
  children: React.ReactNode
  featured?: boolean
  selected?: boolean
}) {
  return (
    <div
      className={[
        'flex flex-col rounded-2xl p-5 transition-all duration-200',
        featured
          ? 'border-2 border-brand-500 bg-game-card shadow-[0_0_28px_rgba(139,92,246,0.15)]'
          : 'border border-game-border bg-game-card shadow-card',
        selected && !featured ? 'border-brand-500/60' : '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function FeatureRow({ included, text, highlight }: { included: boolean; text: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {included ? (
        <Check size={13} className={`shrink-0 ${highlight ? 'text-brand-400' : 'text-emerald-400'}`} />
      ) : (
        <X size={13} className="shrink-0 text-gray-600" />
      )}
      <span className={`text-xs ${!included ? 'text-gray-600 line-through' : highlight ? 'font-medium text-brand-300' : 'text-gray-400'}`}>
        {text}
      </span>
    </div>
  )
}
