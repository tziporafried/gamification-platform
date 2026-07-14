import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { consumePendingOAuthAuth } from '@/lib/analytics'
import type { UserProfile } from '@/types'

export type SignInOrSignUpResult =
  | { status: 'signed-in' }
  | { status: 'signed-up' }
  /** Account created but Supabase requires email confirmation before a session exists (only if "Confirm email" is enabled). */
  | { status: 'confirmation-required' }
  | { status: 'error'; reason: 'invalid-credentials' | 'network' }

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  /** Signs in with email+password, falling back to account creation when no account exists yet. */
  signInOrSignUp: (email: string, password: string) => Promise<SignInOrSignUpResult>
  signOut: () => Promise<void>
  isSuperAdmin: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data as UserProfile | null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id)
        if (event === 'SIGNED_IN') {
          consumePendingOAuthAuth(u.created_at)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirectTo || '/events'}`,
      },
    })
  }, [])

  const signInOrSignUp = useCallback(async (email: string, password: string): Promise<SignInOrSignUpResult> => {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInError) return { status: 'signed-in' }

    if (isAuthRetryableFetchError(signInError)) {
      return { status: 'error', reason: 'network' }
    }

    // Sign-in failed for a reason other than a network/server issue — most likely there's no
    // account yet for this email, so try creating one. If an account does exist, Supabase will
    // reject this with an "already registered" style error, which we treat as wrong credentials
    // rather than creating a duplicate account.
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      if (isAuthRetryableFetchError(signUpError)) {
        return { status: 'error', reason: 'network' }
      }
      // eslint-disable-next-line no-console
      console.error('[signInOrSignUp] signUp failed:', signUpError.code, signUpError.status, signUpError.message)
      return { status: 'error', reason: 'invalid-credentials' }
    }

    if (!data.session) {
      return { status: 'confirmation-required' }
    }

    return { status: 'signed-up' }
  }, [])

  // TODO: add resetPasswordForEmail() / updateUser({ password }) helpers here once a "forgot
  // password" / "set password" flow is built — not all existing users (Google-only)
  // have a password set yet.

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signInOrSignUp, signOut, isSuperAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
