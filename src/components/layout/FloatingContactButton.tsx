import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { trackCtaClick } from '@/lib/analytics'
import { LANDING_CONTACT_PATH } from '@/lib/contact'
import { Tooltip } from '@/components/ui/Tooltip'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

interface FloatingContactButtonProps {
  /** Analytics `cta_location` value */
  location?: string
  /** Landing: pill with label. App (trial): compact icon + tooltip. */
  variant?: 'pill' | 'compact'
}

export function FloatingContactButton({
  location = 'floating',
  variant = 'pill',
}: FloatingContactButtonProps) {
  const motionSafe = !useReducedMotion()

  function handleClick() {
    trackCtaClick({
      cta_name: 'contact_us',
      cta_location: location,
      destination: LANDING_CONTACT_PATH,
    })
  }

  return (
    <motion.div
      className="fixed bottom-5 left-4 z-50 sm:bottom-6 sm:left-6"
      initial={motionSafe ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.35 }}
    >
      {variant === 'compact' ? (
        <Tooltip content="יש לכם שאלה?" side="top" portal>
          <Link
            to={LANDING_CONTACT_PATH}
            onClick={handleClick}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--color-secondary)_28%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--color-secondary)_88%,black)] hover:shadow-[0_6px_18px_color-mix(in_srgb,var(--color-secondary)_36%,transparent)]"
            aria-label="יש לכם שאלה?"
          >
            <MessageCircle size={24} strokeWidth={2.35} />
          </Link>
        </Tooltip>
      ) : (
        <Link
          to={LANDING_CONTACT_PATH}
          onClick={handleClick}
          className="group flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-[0_6px_20px_color-mix(in_srgb,var(--color-secondary)_35%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--color-secondary)_88%,black)] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-secondary)_42%,transparent)] sm:gap-2.5 sm:px-4 sm:py-3"
          aria-label="יש לכם שאלה?"
        >
          <MessageCircle size={18} strokeWidth={2} className="shrink-0" />
          <span>יש לכם שאלה?</span>
        </Link>
      )}
    </motion.div>
  )
}
