import { useState, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'
import { safeReturnTo, cn } from '@/lib/utils'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

export function Login() {
  const { signInWithGoogle, signInWithMagicLink, signInOrSignUp } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = searchParams.get('returnTo') || undefined

  const [password, setPassword] = useState('')
  const [passwordEmail, setPasswordEmail] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmationRequired, setConfirmationRequired] = useState(false)

  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false)

  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle(returnTo)
    } catch {
      setError('שגיאה בהתחברות. נסו שוב.')
      setGoogleLoading(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (passwordLoading) return

    setPasswordError('')
    setConfirmationRequired(false)

    const trimmedEmail = passwordEmail.trim()
    if (!trimmedEmail || !password) {
      setPasswordError('יש להזין אימייל וסיסמה')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setPasswordError('כתובת האימייל אינה תקינה')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`)
      return
    }

    setPasswordLoading(true)
    const result = await signInOrSignUp(trimmedEmail, password)
    setPasswordLoading(false)

    switch (result.status) {
      case 'signed-in':
      case 'signed-up':
        navigate(safeReturnTo(returnTo ?? null))
        return
      case 'confirmation-required':
        setConfirmationRequired(true)
        return
      case 'error':
        setPasswordError(
          result.reason === 'network'
            ? 'לא ניתן להתחבר כרגע. נסו שוב בעוד רגע.'
            : 'לא הצלחנו להתחבר עם הפרטים שהוזנו',
        )
        return
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = email.trim()
    if (!trimmed) {
      setError('יש להזין כתובת מייל')
      return
    }

    setMagicLinkLoading(true)
    const result = await signInWithMagicLink(trimmed, returnTo)
    setMagicLinkLoading(false)

    if (result.error) {
      if (result.error.includes('rate')) {
        setError('נסו שוב בעוד מספר דקות')
      } else {
        setError('לא ניתן לשלוח קישור התחברות כרגע')
      }
      return
    }

    setMagicLinkSent(true)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-background)] atmosphere-login px-4">
      <AtmosphericBackground />
      <FloatingIconsLayer />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl gradient-brand text-lg font-bold text-foreground">
            G
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">ברוכים הבאים</h1>
          <p className="mt-1 text-sm text-muted">התחברו לפלטפורמה</p>
        </div>

        {/* Primary: Email + Password (sign in, or create an account on first use) */}
        {confirmationRequired ? (
          <div className="text-center space-y-2 py-2">
            <CheckCircle2 size={32} className="mx-auto text-success" />
            <p className="text-sm font-medium text-foreground">נשלח אליך מייל אימות</p>
            <p className="text-xs text-muted">יש לאשר את הכתובת כדי להשלים את ההרשמה ולהתחבר</p>
            <button
              onClick={() => setConfirmationRequired(false)}
              className="text-xs text-secondary hover:text-accent transition-colors mt-2"
            >
              חזרה
            </button>
          </div>
        ) : (
          <>
            {passwordError && <ErrorAlert message={passwordError} className="mb-4" />}
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <Input
                id="password-email"
                label="אימייל"
                type="email"
                placeholder="you@example.com"
                value={passwordEmail}
                onChange={(e) => { setPasswordEmail(e.target.value); setPasswordError('') }}
                autoComplete="email"
              />
              <Input
                id="password-password"
                label="סיסמה"
                type="password"
                placeholder=""
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
                autoComplete="current-password"
              />
              {/* TODO: add "שכחתי סיסמה" link here once a password-reset flow exists */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                loading={passwordLoading}
                className="w-full"
              >
                כניסה
              </Button>
            </form>
          </>
        )}

        {/* Secondary: Google + Magic Link, tucked away behind a collapsed section */}
        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setMoreOptionsOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
            aria-expanded={moreOptionsOpen}
          >
            אפשרויות התחברות נוספות
            <ChevronDown size={14} className={cn('transition-transform', moreOptionsOpen && 'rotate-180')} />
          </button>

          {moreOptionsOpen && (
            <div className="mt-4 space-y-3">
              {error && <ErrorAlert message={error} className="mb-1" />}

              <Button
                variant="outline"
                size="md"
                loading={googleLoading}
                className="w-full"
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon className="ml-2 h-5 w-5" />
                התחברות עם Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">או</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {magicLinkSent ? (
                <div className="text-center space-y-2 py-2">
                  <CheckCircle2 size={32} className="mx-auto text-success" />
                  <p className="text-sm font-medium text-foreground">קישור התחברות נשלח למייל שלך</p>
                  <p className="text-xs text-muted">בדוק את תיבת הדואר ולחץ על הקישור</p>
                  <button
                    onClick={() => { setMagicLinkSent(false); setEmail('') }}
                    className="text-xs text-secondary hover:text-accent transition-colors mt-2"
                  >
                    שלח שוב
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <Input
                    id="magic-email"
                    label="כתובת אימייל"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    loading={magicLinkLoading}
                    className="w-full"
                  >
                    שלח קישור התחברות
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
