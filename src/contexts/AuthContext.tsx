import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { User, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  consumePendingOAuthAuth,
  getUtmAttribution,
  restoreUtmAttribution,
} from '@/lib/analytics'
import { hasUtmAttribution } from '@/lib/utmAttribution'
import {
  clearImpersonationState,
  getImpersonationState,
  setImpersonationState,
  type ImpersonationState,
} from '@/lib/impersonation'
import type { UserProfile } from '@/types'

export type SignInOrSignUpResult =
  | { status: 'signed-in' }
  | { status: 'signed-up' }
  /** Account created but Supabase requires email confirmation before a session exists (only if "Confirm email" is enabled). */
  | { status: 'confirmation-required' }
  | { status: 'error'; reason: 'invalid-credentials' | 'network' }

export type ImpersonateResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }

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
  /** True while a super admin is viewing the app as another user. */
  isImpersonating: boolean
  impersonationTarget: { email: string; displayName: string | null } | null
  /** Switch the current session into the given user (super_admin only). */
  impersonateUser: (userId: string) => Promise<ImpersonateResult>
  /** Restore the saved admin session and clear the impersonation flag. */
  stopImpersonating: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Persist session UTMs onto the user profile (first-touch only). */
async function claimSessionAffiliate() {
  const utm = getUtmAttribution()
  if (!hasUtmAttribution(utm)) return
  const { error } = await supabase.rpc('claim_affiliate_attribution', { p_attribution: utm })
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[affiliate] claim failed:', error.message)
  }
}

function applyProfileAffiliate(profile: UserProfile | null): UserProfile | null {
  if (!profile?.affiliate_attribution) return profile
  restoreUtmAttribution(profile.affiliate_attribution)
  return profile
}

function readImpersonationTarget(state: ImpersonationState | null) {
  if (!state) return null
  return { email: state.targetEmail, displayName: state.targetDisplayName }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(() => getImpersonationState())
  const claimedForUserRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    const next = applyProfileAffiliate(data as UserProfile | null)
    setProfile(next)
    return next
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  const syncAffiliateForUser = useCallback(async (userId: string) => {
    // Never write affiliate attribution while viewing as another user.
    if (getImpersonationState()) {
      claimedForUserRef.current = userId
      return fetchProfile(userId)
    }

    if (claimedForUserRef.current === userId) return

    await claimSessionAffiliate()
    let next = await fetchProfile(userId)

    // OAuth race: claim can run before user_profiles row exists (UPDATE 0 rows → "already_set").
    // Retry once so first-touch UTMs are not lost permanently.
    if (!next?.affiliate_attribution && hasUtmAttribution(getUtmAttribution())) {
      await new Promise((r) => setTimeout(r, 400))
      await claimSessionAffiliate()
      next = await fetchProfile(userId)
    }

    // Only lock out further attempts after we tried (and optionally retried).
    claimedForUserRef.current = userId
    return next
  }, [fetchProfile])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        syncAffiliateForUser(u.id).finally(() => {
          if (!cancelled) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        if (event === 'SIGNED_IN') {
          claimedForUserRef.current = null
          syncAffiliateForUser(u.id)
          if (!getImpersonationState()) {
            consumePendingOAuthAuth(u.created_at)
          }
        } else {
          fetchProfile(u.id)
        }
      } else {
        claimedForUserRef.current = null
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile, syncAffiliateForUser])

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
    const utm = getUtmAttribution()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: hasUtmAttribution(utm)
        ? { data: { affiliate_attribution: utm } }
        : undefined,
    })

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

  const signOut = useCallback(async () => {
    clearImpersonationState()
    setImpersonation(null)
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const impersonateUser = useCallback(async (userId: string): Promise<ImpersonateResult> => {
    const { data: { session: adminSession } } = await supabase.auth.getSession()
    if (!adminSession?.access_token || !adminSession.refresh_token) {
      return { status: 'error', message: 'אין סשן אדמין פעיל. התחברי מחדש.' }
    }

    const { data, error } = await supabase.functions.invoke('admin-impersonate', {
      body: { userId },
    })

    if (error) {
      const status = (error as { context?: Response }).context?.status
      if (status === 401) return { status: 'error', message: 'יש להתחבר מחדש.' }
      if (status === 403) return { status: 'error', message: 'אין הרשאה להתחבר כלקוח.' }
      return { status: 'error', message: 'ההתחברות כלקוח נכשלה. נסי שוב.' }
    }

    const payload = data as {
      token_hash?: string
      email?: string
      display_name?: string | null
      error?: string
    } | null

    if (!payload?.token_hash || !payload.email) {
      return { status: 'error', message: payload?.error || 'ההתחברות כלקוח נכשלה.' }
    }

    const nextState: ImpersonationState = {
      adminAccessToken: adminSession.access_token,
      adminRefreshToken: adminSession.refresh_token,
      adminEmail: adminSession.user.email ?? '',
      targetUserId: userId,
      targetEmail: payload.email,
      targetDisplayName: payload.display_name ?? null,
      startedAt: new Date().toISOString(),
    }
    setImpersonationState(nextState)
    setImpersonation(nextState)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: payload.token_hash,
      type: 'email',
    })

    if (verifyError) {
      clearImpersonationState()
      setImpersonation(null)
      return { status: 'error', message: 'לא הצלחנו להיכנס לחשבון הלקוח. נסי שוב.' }
    }

    return { status: 'ok' }
  }, [])

  const stopImpersonating = useCallback(async () => {
    const state = getImpersonationState()
    clearImpersonationState()
    setImpersonation(null)

    if (!state?.adminAccessToken || !state.adminRefreshToken) {
      await supabase.auth.signOut()
      setProfile(null)
      return
    }

    const { error } = await supabase.auth.setSession({
      access_token: state.adminAccessToken,
      refresh_token: state.adminRefreshToken,
    })

    if (error) {
      await supabase.auth.signOut()
      setProfile(null)
    }
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'
  const isImpersonating = impersonation !== null
  const impersonationTarget = readImpersonationTarget(impersonation)

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInOrSignUp,
        signOut,
        isSuperAdmin,
        refreshProfile,
        isImpersonating,
        impersonationTarget,
        impersonateUser,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
