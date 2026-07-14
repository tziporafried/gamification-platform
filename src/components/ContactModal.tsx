import { Modal } from '@/components/ui/Modal'
import { ContactForm } from '@/components/ContactForm'
import type { ContactSource } from '@/lib/contact'
import { contactLimitTypeForSource, pageSourceFromLocation } from '@/lib/contact'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  /** Entry source for analytics / DB when using the generic contact path. */
  source?: ContactSource
  /** Floating / page location → behind-the-scenes page source tag. */
  location?: string
  eventId?: string | null
  eventName?: string | null
  /** Optional mode tag (e.g. trial / active) appended to notes. */
  mode?: string | null
}

/**
 * Neutral Contact Intent modal.
 * Never use this for plan selection / activation leads — those use PlansModal.
 */
export function ContactModal({
  isOpen,
  onClose,
  source = 'homepage_contact',
  location,
  eventId = null,
  eventName = null,
}: ContactModalProps) {
  const resolvedLimitType = contactLimitTypeForSource(source)
  const pageSource = location ? pageSourceFromLocation(location) : pageSourceFromLocation('home')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="יש לכם שאלה? אנחנו כאן 😊"
      contentClassName="max-h-[min(80vh,40rem)] overflow-y-auto"
      dialogClassName="max-w-xl"
    >
      <ContactForm
        key={`${source}-${eventId ?? ''}-${isOpen}`}
        intent="contact"
        hideHeading
        limitType={resolvedLimitType}
        analyticsPlanName={source}
        eventId={eventId}
        eventName={eventName}
        source={source}
        pageSource={pageSource}
      />
    </Modal>
  )
}
