import { useLocation } from 'react-router-dom'

/** True on scan/scoring/control routes that keep the dark game shell. */
export function useIsGameShellRoute() {
  const { pathname } = useLocation()
  return /\/control$|\/ops$|\/display$/.test(pathname)
}
