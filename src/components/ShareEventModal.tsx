import { useState, useEffect, FormEvent } from 'react'
import { UserPlus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Collaborator {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

interface ShareEventModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
}

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: 'לא נמצא משתמש עם אימייל זה',
  NOT_OWNER: 'רק בעל האירוע יכול לשתף',
  CANNOT_SHARE_SELF: 'לא ניתן לשתף עם עצמך',
}

export function ShareEventModal({ isOpen, onClose, eventId }: ShareEventModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators()
      setEmail('')
      setError('')
      setSuccess('')
    }
  }, [isOpen, eventId])

  async function fetchCollaborators() {
    const { data } = await supabase.rpc('get_event_collaborators', { p_event_id: eventId })
    if (data) setCollaborators(data as Collaborator[])
  }

  async function handleShare(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    const { data, error: rpcError } = await supabase.rpc('share_event_by_email', {
      p_event_id: eventId,
      p_email: email.trim(),
    })

    setLoading(false)

    if (rpcError) {
      setError('שגיאה בשיתוף האירוע')
      return
    }

    const result = data as { error?: string; success?: boolean }
    if (result.error) {
      setError(ERROR_MESSAGES[result.error] || result.error)
      return
    }

    setSuccess(`האירוע שותף עם ${email}`)
    setEmail('')
    fetchCollaborators()
  }

  async function handleRemove(userId: string) {
    await supabase
      .from('event_collaborators')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId)
    fetchCollaborators()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="שיתוף אירוע">
      <form onSubmit={handleShare} className="space-y-4">
        <div className="flex gap-2">
          <Input
            id="share-email"
            type="email"
            placeholder="הזן אימייל..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="primary" size="md" loading={loading}>
            <UserPlus size={16} />
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-400">{success}</p>
        )}
      </form>

      {collaborators.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase">משתמשים משותפים</h3>
          {collaborators.map((c) => (
            <div key={c.user_id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600/20 text-xs font-bold text-brand-400">
                    {(c.display_name || c.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{c.display_name || c.email.split('@')[0]}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(c.user_id)}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
