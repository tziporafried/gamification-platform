import { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  loading?: boolean
  cancelLabel?: string
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  loading = false,
  cancelLabel = 'ביטול',
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {description && (
          typeof description === 'string' ? (
            <p className="text-sm text-gray-400">{description}</p>
          ) : (
            <div className="text-sm text-gray-400">{description}</div>
          )
        )}
        {children}
        <div className="flex gap-3">
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
