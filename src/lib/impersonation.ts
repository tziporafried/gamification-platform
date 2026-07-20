const STORAGE_KEY = 'gamify_impersonation'

export interface ImpersonationState {
  /** Admin session to restore when exiting impersonation. */
  adminAccessToken: string
  adminRefreshToken: string
  adminEmail: string
  targetUserId: string
  targetEmail: string
  targetDisplayName: string | null
  startedAt: string
}

export function getImpersonationState(): ImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonationState
    if (!parsed?.adminAccessToken || !parsed?.adminRefreshToken || !parsed?.targetUserId) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setImpersonationState(state: ImpersonationState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearImpersonationState(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isImpersonating(): boolean {
  return getImpersonationState() !== null
}
