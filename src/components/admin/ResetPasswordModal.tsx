import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ModalActions } from '@/components/ui/ModalActions'
import { ErrorAlert, SuccessAlert } from '@/components/ui/ErrorAlert'

/** Matches the floor the edge function enforces. */
export const MIN_PASSWORD_LENGTH = 6

/**
 * Characters that survive being read out loud over the phone - no 0/O, 1/l/I,
 * and nothing that a keyboard layout switch turns into something else.
 */
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePassword(length = 10) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
  }
  return out
}

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  user: { user_id: string; email: string; display_name: string | null }
}

/**
 * Sets a customer's password from the admin panel. There is no self-service
 * reset flow in the app, so a customer who lost their password gets a new one
 * from support - which means the dialog has to make the new password easy to
 * read back and copy, not just easy to submit.
 */
export function ResetPasswordModal({ isOpen, onClose, user }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  // A fresh suggestion per opening, so a dialog reopened for another customer
  // never carries the previous one's password.
  useEffect(() => {
    if (!isOpen) return
    setPassword(generatePassword())
    setRevealed(true)
    setError(null)
    setDone(false)
    setCopied(false)
    setSaving(false)
  }, [isOpen, user.user_id])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const tooShort = password.length < MIN_PASSWORD_LENGTH

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      setError('לא הצלחנו להעתיק. סמנו את הסיסמה והעתיקו ידנית.')
    }
  }

  async function submit() {
    if (tooShort || saving) return
    setSaving(true)
    setError(null)

    const { data, error: fnError } = await supabase.functions.invoke('admin-set-password', {
      body: { userId: user.user_id, password },
    })

    if (fnError) {
      const status = (fnError as { context?: Response }).context?.status
      if (status === 401) setError('יש להתחבר מחדש.')
      else if (status === 403) setError('אין הרשאה לאפס סיסמה למשתמש הזה.')
      else setError('איפוס הסיסמה נכשל. נסי שוב.')
      setSaving(false)
      return
    }

    const payload = data as { email?: string; error?: string } | null
    if (payload?.error) {
      setError(payload.error)
      setSaving(false)
      return
    }

    setSaving(false)
    setDone(true)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="איפוס סיסמה ללקוח"
      subtitle={user.display_name ? `${user.display_name} · ${user.email}` : user.email}
    >
      <div className="space-y-4">
        {done ? (
          <>
            <SuccessAlert message="הסיסמה הוחלפה. מסרו אותה ללקוח - הסיסמה הישנה כבר לא עובדת." />
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 select-all rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              >
                {password}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copyPassword()}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span className="ms-1.5">{copied ? 'הועתק' : 'העתק'}</span>
              </Button>
            </div>
            <ModalActions className="pt-0">
              <Button onClick={onClose}>סגירה</Button>
            </ModalActions>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              הסיסמה מוחלפת מיד. מסרו אותה ללקוח - אין באתר מסך "שכחתי סיסמה" שדרכו הוא
              יכול לשחזר בעצמו.
            </p>

            <div className="flex items-end gap-2">
              <Input
                label="סיסמה חדשה"
                dir="ltr"
                type={revealed ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="font-mono"
                error={password && tooShort ? `לפחות ${MIN_PASSWORD_LENGTH} תווים` : undefined}
              />
              <div className="flex shrink-0 gap-1 pb-0.5">
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  aria-label={revealed ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  title="הגרל סיסמה"
                  aria-label="הגרל סיסמה חדשה"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void copyPassword()}
                  title="העתק סיסמה"
                  aria-label="העתק את הסיסמה"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  {copied ? <Check size={16} className="text-success-text" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {error && <ErrorAlert message={error} />}

            <ModalActions className="pt-0">
              <Button onClick={() => void submit()} loading={saving} disabled={tooShort}>
                החלף סיסמה
              </Button>
              <Button variant="outline" onClick={onClose}>
                ביטול
              </Button>
            </ModalActions>
          </>
        )}
      </div>
    </Modal>
  )
}
