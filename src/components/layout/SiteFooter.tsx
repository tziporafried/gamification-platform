import { Link } from 'react-router-dom'

/**
 * Registered / display owner name for copyright and terms.
 */
export const OWNER_NAME = 'Gamify'

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-5 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-xs leading-relaxed text-muted">
        <p>
          © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
        </p>
        <span className="text-border" aria-hidden="true">|</span>
        <Link
          to="/terms"
          className="font-medium text-muted underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          תנאי שימוש
        </Link>
      </div>
    </footer>
  )
}
