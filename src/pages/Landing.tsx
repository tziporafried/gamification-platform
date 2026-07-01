import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AtmosphericBackground } from '@/components/layout/AtmosphericBackground'
import { Button } from '@/components/ui/Button'
import { GoogleIcon } from '@/components/icons/GoogleIcon'

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-app-radial atmosphere-landing px-4">
      <AtmosphericBackground />
      <div className="relative z-10 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-foreground shadow-card">
          G
        </div>
        <h1 className="mb-3 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
          Gamify PLATFORM
        </h1>
        <p className="mb-8 max-w-md text-lg text-muted">
          צרו תחרויות מרתקות עם ניקוד, קבוצות וטבלאות דירוג.
        </p>
        <Button size="lg" variant="gradient" loading={loading} onClick={handleGoogleSignIn}>
          <GoogleIcon className="ml-2 h-5 w-5" />
          התחלה עם Google
        </Button>
      </div>
    </div>
  )
}
