import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('יש למלא את כל השדות.')
      return
    }

    setLoading(true)
    const { error: authError } = await signIn(email, password)
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-game-dark px-4">
      <div className="w-full max-w-sm rounded-2xl border border-game-border bg-game-card p-6">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl gradient-brand text-lg font-bold text-white">
            G
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">ברוכים השבים</h1>
          <p className="mt-1 text-sm text-gray-500">התחברו לחשבון שלכם</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
          )}

          <Input
            id="email"
            label="אימייל"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <Input
            id="password"
            label="סיסמה"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <Button type="submit" variant="gradient" loading={loading} className="w-full">
            התחברות
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          אין לכם חשבון?{' '}
          <Link to="/register" className="font-medium text-brand-400 hover:text-brand-300">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  )
}
