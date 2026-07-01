import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Layers,
  CheckSquare,
  Gift,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { cn } from '@/lib/utils'
import {
  fetchAllActivityTemplates,
  createActivityTemplate,
  ensureTemplateDraftEvent,
  setTemplateActive,
  deleteActivityTemplate,
  formatTemplateError,
} from '@/lib/templates'
import type { ActivityTemplateWithContent } from '@/types'

export function TemplateAdminList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ActivityTemplateWithContent[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<ActivityTemplateWithContent | null>(null)
  const [error, setError] = useState('')

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllActivityTemplates()
      setTemplates(data)
      setError('')
    } catch {
      setError('שגיאה בטעינת התבניות.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  async function handleCreate() {
    if (!user) return
    setCreating(true)
    setError('')
    try {
      const template = await createActivityTemplate(user.id)
      navigate(`/events/${template.draft_event_id}/step/1`)
    } catch (err) {
      setError(formatTemplateError(err, 'שגיאה ביצירת תבנית חדשה.'))
      setCreating(false)
    }
  }

  async function handleEdit(template: ActivityTemplateWithContent) {
    if (!user) return
    setBusyId(template.id)
    setError('')
    try {
      const eventId = await ensureTemplateDraftEvent(template.id, user.id)
      navigate(`/events/${eventId}/step/1`)
    } catch (err) {
      setError(formatTemplateError(err, 'שגיאה בפתיחת עורך התבנית.'))
      setBusyId(null)
    }
  }

  async function handleToggleActive(template: ActivityTemplateWithContent) {
    setBusyId(template.id)
    setError('')
    try {
      await setTemplateActive(template.id, !template.is_active)
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: !t.is_active } : t)),
      )
    } catch {
      setError('שגיאה בעדכון סטטוס התבנית.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return
    setBusyId(deletingTemplate.id)
    setError('')
    try {
      await deleteActivityTemplate(deletingTemplate.id)
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id))
      setDeletingTemplate(null)
    } catch {
      setError('שגיאה במחיקת התבנית.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <FullPageLoader />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-muted" />
          <h2 className="text-sm font-medium text-muted">
            {templates.length} תבניות
          </h2>
        </div>
        <Button size="sm" loading={creating} onClick={handleCreate}>
          <Plus size={16} className="ml-1.5" />
          תבנית חדשה
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-surface-elevated border border-danger px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted mb-4">אין תבניות עדיין</p>
          <Button size="sm" loading={creating} onClick={handleCreate}>
            <Plus size={16} className="ml-1.5" />
            צרו תבנית ראשונה
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{template.name}</span>
                    <span
                      className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        template.is_active
                          ? 'text-success bg-surface-elevated border border-success'
                          : 'text-muted bg-surface-elevated border border-border',
                      )}
                    >
                      {template.is_active ? 'פעילה' : 'מוסתרת'}
                    </span>
                  </div>

                  {template.description && (
                    <p className="text-xs text-muted">{template.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted">
                    {template.group_type === 'custom' ? (
                      <span className="flex items-center gap-1">
                        <Layers size={12} />
                        {template.groups.length} קבוצות
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Layers size={12} />
                        ללא קבוצות
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CheckSquare size={12} />
                      {template.tasks.length} משימות
                    </span>
                    {template.rewards.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Gift size={12} />
                        {template.rewards.length} פרסים
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === template.id}
                    onClick={() => handleEdit(template)}
                  >
                    <Pencil size={14} className="ml-1" />
                    עריכה
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === template.id}
                    onClick={() => handleToggleActive(template)}
                  >
                    {template.is_active ? (
                      <>
                        <EyeOff size={14} className="ml-1" />
                        הסתר
                      </>
                    ) : (
                      <>
                        <Eye size={14} className="ml-1" />
                        הפעל
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === template.id}
                    onClick={() => setDeletingTemplate(template)}
                    className="text-danger hover:text-danger"
                  >
                    <Trash2 size={14} className="ml-1" />
                    מחק
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        title="מחיקת תבנית"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            האם למחוק את התבנית{' '}
            <strong className="text-foreground">{deletingTemplate?.name}</strong>?
            {' '}הפעולה לא ניתנת לביטול.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" loading={busyId === deletingTemplate?.id} onClick={handleDelete}>
              מחק תבנית
            </Button>
            <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
