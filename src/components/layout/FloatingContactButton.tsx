import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { trackCtaClick, trackContactFormOpen } from '@/lib/analytics'
import { contactSourceFromLocation } from '@/lib/contact'
import { Tooltip } from '@/components/ui/Tooltip'
import { ContactModal } from '@/components/ContactModal'
import { cn } from '@/lib/utils'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

interface FloatingContactButtonProps {
  /** Analytics `cta_location` value */
  location?: string
  /** Landing: pill with label. App (trial): compact icon + tooltip. */
  variant?: 'pill' | 'compact'
  /** Optional linked event for context submissions. */
  eventId?: string | null
  eventName?: string | null
  /**
   * question = trial / marketing ("יש לכם שאלה?")
   * help = active game support ("צריכים עזרה?")
   */
  labelMode?: 'question' | 'help'
  /** Hide the floating control (e.g. another contact modal is already open). */
  hidden?: boolean
}

export function FloatingContactButton({
  location = 'floating',
  variant = 'pill',
  eventId = null,
  eventName = null,
  labelMode = 'question',
  hidden = false,
}: FloatingContactButtonProps) {
  const motionSafe = !useReducedMotion()
  const [open, setOpen] = useState(false)
  const source = contactSourceFromLocation(location)
  const deactivated = open || hidden
  const label = labelMode === 'help' ? 'צריכים עזרה?' : 'יש לכם שאלה?'

  function handleOpen() {
    trackCtaClick({
      cta_name: 'contact_us',
      cta_location: location,
      destination: 'contact_modal',
      contact_source: source,
    })
    trackContactFormOpen({
      contact_source: source,
      cta_location: location,
    })
    setOpen(true)
  }

  return (
    <>
      <motion.div
        className={cn(
          'fixed bottom-5 left-4 z-50 sm:bottom-6 sm:left-6',
          deactivated && 'pointer-events-none',
        )}
        initial={motionSafe ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: deactivated ? 0 : 1, y: 0 }}
        transition={{ duration: deactivated ? 0.15 : 0.45, ease: EASE_OUT, delay: deactivated ? 0 : 0.35 }}
        aria-hidden={deactivated}
      >
        {variant === 'compact' ? (
          <Tooltip content={label} side="top" portal>
            <button
              type="button"
              onClick={handleOpen}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--color-secondary)_28%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--color-secondary)_88%,black)] hover:shadow-[0_6px_18px_color-mix(in_srgb,var(--color-secondary)_36%,transparent)]"
              aria-label={label}
            >
              <MessageCircle size={24} strokeWidth={2.35} />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="group flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-[0_6px_20px_color-mix(in_srgb,var(--color-secondary)_35%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--color-secondary)_88%,black)] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-secondary)_42%,transparent)] sm:gap-2.5 sm:px-4 sm:py-3"
            aria-label={label}
          >
            <MessageCircle size={18} strokeWidth={2} className="shrink-0" />
            <span>{label}</span>
          </button>
        )}
      </motion.div>

      <ContactModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={source}
        location={location}
        eventId={eventId}
        eventName={eventName}
      />
    </>
  )
}
