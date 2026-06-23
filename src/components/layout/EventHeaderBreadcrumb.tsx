import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EventHeaderBreadcrumbProps {
  eventName: string
  suffix?: string
}

export function EventHeaderBreadcrumb({ eventName, suffix }: EventHeaderBreadcrumbProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors shrink-0"
      >
        <ArrowRight size={14} />
        <span>האירועים שלי</span>
      </button>
      <span className="text-brand-400/60 shrink-0">/</span>
      <span className="text-xs font-medium text-white truncate max-w-[200px]">
        {eventName || 'אירוע חדש'}
      </span>
      {suffix && (
        <>
          <span className="text-brand-400/60 shrink-0">/</span>
          <span className="text-xs text-gray-400 truncate">{suffix}</span>
        </>
      )}
    </div>
  )
}
