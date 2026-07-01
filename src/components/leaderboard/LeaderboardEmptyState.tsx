import { Trophy } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { theme } from '@/lib/theme'

interface LeaderboardEmptyStateProps {
  message?: string
}

export function LeaderboardEmptyState({ message }: LeaderboardEmptyStateProps) {
  return (
    <EmptyState
      variant="solid"
      className="opacity-0 animate-fade-in-up py-16"
      icon={
        <div className={theme.iconBox}>
          <Trophy size={32} />
        </div>
      }
      title="הזירה מוכנה"
      description={
        message || 'עדיין לא נרשמו ניקודים. התחילו להעניק ניקוד כדי לראות את הדירוגים הראשונים.'
      }
    />
  )
}
