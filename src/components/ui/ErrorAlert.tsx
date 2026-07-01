import { Alert } from './Alert'

interface AlertMessageProps {
  message: string
  className?: string
}

export function ErrorAlert({ message, className }: AlertMessageProps) {
  return <Alert variant="error" message={message} className={className} />
}

export function SuccessAlert({ message, className }: AlertMessageProps) {
  return <Alert variant="success" message={message} className={className} />
}
