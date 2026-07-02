import { useState, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'

export function Login() {
  const { signInWithGoogle, signInWithMagicLink, signInWithPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = searchParams.get('returnTo') || undefined

  // Demo mode is only active when ?demo=true is explicitly present in the URL
  const isDemoMode = searchParams.get('demo') === 'true'

  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  // Demo-only state — not used unless isDemoMode is true
  const [demoEmail, setDemoEmail] = useState('')
  const [demoPassword, setDemoPassword] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState('')

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

  // Demo-only: authenticates with real Supabase email+password, only reachable via ?demo=true
  async function handleDemoLogin(e: FormEvent) {
    e.preventDefault()
    setDemoError('')
    const trimmedEmail = demoEmail.trim()
    if (!trimmedEmail || !demoPassword) {
      setDemoError('יש להזין אימייל וסיסמה')
      return
    }
    setDemoLoading(true)
    const result = await signInWithPassword(trimmedEmail, demoPassword)
    setDemoLoading(false)
    if (result.error) {
      setDemoError('פרטי התחברות שגויים')
      return
    }
    navigate(returnTo || '/events')
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
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl gradient-brand text-lg font-bold text-foreground">
            G
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">ברוכים הבאים</h1>
          <p className="mt-1 text-sm text-muted">התחברו לפלטפורמה</p>
        </div>

        {/* Demo-only: show only email+password form when ?demo=true */}
        {isDemoMode ? (
          <>
            {demoError && <ErrorAlert message={demoError} className="mb-4" />}
            <form onSubmit={handleDemoLogin} className="space-y-3">
              <Input
                id="demo-email"
                label="אימייל"
                type="email"
                placeholder=""
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                autoComplete="username"
              />
              <Input
                id="demo-password"
                label="סיסמה"
                type="password"
                placeholder=""
                value={demoPassword}
                onChange={(e) => setDemoPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                loading={demoLoading}
                className="w-full"
              >
                כניסה
              </Button>
            </form>
          </>
        ) : (
          <>
            {error && <ErrorAlert message={error} className="mb-4" />}

            {/* Google — Primary */}
            <Button
              variant="gradient"
              size="lg"
              loading={googleLoading}
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon className="ml-2 h-5 w-5" />
              התחברות עם Google
            </Button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">או</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Magic Link — Secondary */}
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
                  size="md"
                  loading={magicLinkLoading}
                  className="w-full"
                >
                  שלח קישור התחברות
                </Button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  )
}
