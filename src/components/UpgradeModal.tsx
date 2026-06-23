import { useState, FormEvent } from 'react'
import { Rocket, CheckCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FREE_PLAN_LIMITS, ENTITY_LABELS, type LimitableEntity } from '@/lib/plans'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  limitType?: LimitableEntity
}

const LIMIT_ENTRIES = (Object.keys(FREE_PLAN_LIMITS) as LimitableEntity[]).map(entity => ({
  entity,
  label: ENTITY_LABELS[entity],
  limit: FREE_PLAN_LIMITS[entity],
}))

export function UpgradeModal({ isOpen, onClose, limitType }: UpgradeModalProps) {
  const { user, profile } = useAuth()
  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [email, setEmail] = useState(profile?.email || user?.email || '')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleClose() {
    if (!submitting) {
      setSubmitted(false)
      setError('')
      onClose()
    }
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

    const { error: insertError } = await supabase
      .from('contact_upgrade_requests')
      .insert({
        user_id: user!.id,
        full_name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        notes: notes.trim() || null,
        limit_type: limitType || 'general',
      })

    if (insertError) {
      setError('שגיאה בשליחת הבקשה. נסו שנית.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="הבקשה נשלחה">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white">הבקשה נשלחה בהצלחה</p>
            <p className="mt-1 text-sm text-gray-400">נחזור אליך בהקדם.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClose}>סגירה</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="🚀 בקשה לשדרוג">
      <div className="space-y-5">
        <p className="text-sm text-gray-400">
          הגרסה החינמית מוגבלת ל:
        </p>

        <div className="space-y-2">
          {LIMIT_ENTRIES.map(({ entity, label, limit }) => (
            <div key={entity}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                entity === limitType
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-white/5'
              }`}
            >
              <span className={`text-sm ${entity === limitType ? 'font-semibold text-red-300' : 'text-gray-300'}`}>
                {label}
              </span>
              <span className={`text-sm font-medium ${entity === limitType ? 'text-red-400' : 'text-gray-400'}`}>
                עד {limit}
                {entity === limitType && ' ← הגעת למגבלה'}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-game-border pt-4">
          <p className="mb-4 text-sm font-medium text-white">מלאו את הפרטים ונחזור אליכם:</p>
          <form onSubmit={handleSubmit} className="space-y-3">
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-400">הערות</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ספרו לנו מה אתם צריכים..."
                rows={2}
                className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <Button type="submit" variant="gradient" size="lg" loading={submitting} className="w-full font-semibold">
              <Rocket size={16} className="ml-1.5" />
              שליחת בקשה
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  )
}
