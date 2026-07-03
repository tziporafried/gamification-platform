import { useLocation } from 'react-router-dom'

/** True on live/control routes that keep the dark game shell. */
export function useIsGameShellRoute() {
  const { pathname } = useLocation()
  return /\/control$|\/display$/.test(pathname)
}
