import { useState, useEffect } from 'react'
import { Sparkles, PenLine, Layers, Users, CheckSquare, Gift, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { fetchActivityTemplates, applyActivityTemplateById, templateGroupType, formatTemplateError } from '@/lib/templates'
import type { ActivityTemplateWithContent, GroupType } from '@/types'

interface TemplatePickerModalProps {
  eventId: string
  isOpen: boolean
  onChooseScratch: () => void
  onTemplateApplied: (groupType: GroupType, eventName: string) => void
}

type Screen = 'choose' | 'templates'

export function TemplatePickerModal({
  eventId,
  isOpen,
  onChooseScratch,
  onTemplateApplied,
}: TemplatePickerModalProps) {
  const [screen, setScreen] = useState<Screen>('choose')
  const [templates, setTemplates] = useState<ActivityTemplateWithContent[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setScreen('choose')
      setError('')
    }
  }, [isOpen])

  async function handleShowTemplates() {
    setScreen('templates')
    setLoadingTemplates(true)
    setError('')
    try {
      const data = await fetchActivityTemplates()
      setTemplates(data)
    } catch {
      setError('שגיאה בטעינת התבניות. נסו שוב.')
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function handleSelectTemplate(template: ActivityTemplateWithContent) {
    setApplying(template.id)
    setError('')
    try {
      const applied = await applyActivityTemplateById(eventId, template.id)
      onTemplateApplied(templateGroupType(applied), applied.name.trim())
    } catch (err) {
      setError(formatTemplateError(err, 'שגיאה ביישום התבנית.'))
      setApplying(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onChooseScratch}
      title={screen === 'choose' ? 'איך תרצו להתחיל?' : 'בחרו תבנית'}
    >
      {screen === 'choose' ? (
        <div className="space-y-3 pt-1">
          <button
            onClick={handleShowTemplates}
            className="w-full text-right rounded-xl border border-game-border bg-game-card p-4 transition-colors hover:border-brand-500/50 hover:bg-brand-500/5 group"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-brand-500/10 p-2 group-hover:bg-brand-500/20 transition-colors">
                <Sparkles size={20} className="text-brand-400" />
              </div>
              <div>
                <p className="font-medium text-white">התחל מתבנית</p>
                <p className="mt-0.5 text-xs text-gray-400">קבוצות ומשימות מוכנות — התאימו אחר כך</p>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseScratch}
            className="w-full text-right rounded-xl border border-game-border bg-game-card p-4 transition-colors hover:border-white/20 hover:bg-white/5 group"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-white/5 p-2 group-hover:bg-white/10 transition-colors">
                <PenLine size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-white">התחל מאפס</p>
                <p className="mt-0.5 text-xs text-gray-400">בנו את האירוע צעד אחר צעד לפי הצורך שלכם</p>
              </div>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border border-game-border bg-game-card p-4 space-y-3"
              >
                <div>
                  <p className="font-medium text-white">{tmpl.name}</p>
                  {tmpl.description && (
                    <p className="mt-0.5 text-xs text-gray-400">{tmpl.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {tmpl.group_type === 'custom' ? (
                    <span className="flex items-center gap-1">
                      <Layers size={12} />
                      {tmpl.groups.length} קבוצות
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      ללא קבוצות
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CheckSquare size={12} />
                    {tmpl.tasks.length} משימות
                  </span>
                  {tmpl.rewards.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Gift size={12} />
                      {tmpl.rewards.length} פרסים
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  loading={applying === tmpl.id}
                  disabled={applying !== null}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="w-full"
                >
                  בחר תבנית
                </Button>
              </div>
            ))
          )}

          <button
            onClick={() => setScreen('choose')}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
          >
            חזרה
          </button>
        </div>
      )}
    </Modal>
  )
}
