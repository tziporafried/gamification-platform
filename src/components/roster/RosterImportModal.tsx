import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Phone,
  Upload,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { Alert } from '@/components/ui/Alert'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { UpgradeModal } from '@/components/UpgradeModal'
import { readSpreadsheetFile, SPREADSHEET_ACCEPT, SpreadsheetError } from '@/lib/spreadsheet'
import { downloadRosterTemplate, downloadRosterTemplateCsv } from '@/lib/roster/rosterTemplate'
import {
  GROUP_COLUMN_HEADER,
  NAME_COLUMN_HEADER,
  PHONE_COLUMN_HEADER,
  planHasWork,
  planRosterImport,
  skippedRowCount,
  type RosterPlan,
} from '@/lib/roster/rosterPlan'
import { formatPhone } from '@/lib/phone'
import { isMissingPhoneColumnError, MISSING_PHONE_COLUMN_MESSAGE, useSmsNotifications } from '@/lib/smsNotifications'
import { importRoster, type RosterImportResult } from '@/lib/roster/rosterImport'
import type { Group } from '@/types'

/** Which wizard step opened the dialog - only the wording differs. */
export type RosterImportContext = 'participants' | 'groups'

interface RosterImportModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  context: RosterImportContext
  /** The event is set to "participants compete individually" right now. */
  groupsDisabled?: boolean
  onImported: (result: RosterImportResult) => void
}

type Stage = 'pick' | 'preview' | 'importing' | 'done'

const PREVIEW_ROWS = 6

const FILE_ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: 'הקובץ גדול מדי. אפשר להעלות קובץ של עד 5MB.',
  UNSUPPORTED_FORMAT: 'סוג הקובץ אינו נתמך. העלו קובץ Excel‏ (xlsx.) או CSV.',
  UNREADABLE_FILE: 'לא הצלחנו לקרוא את הקובץ. נסו לשמור אותו מחדש כ-Excel‏ (xlsx.) או CSV.',
  LEGACY_XLS: 'הפורמט הישן של אקסל (xls.) אינו נתמך. שמרו את הקובץ בתור xlsx. ונסו שוב.',
}

const PLAN_ERRORS: Record<string, string> = {
  EMPTY_FILE: 'לא נמצאו שורות בקובץ. מלאו את קובץ הדוגמה ונסו שוב.',
  NO_NAMES: 'כל השמות שבקובץ כבר קיימים באירוע, אז אין מה להוסיף.',
  TOO_MANY_ROWS: 'יש בקובץ יותר מדי שורות. אפשר לייבא עד 2,000 משתתפים בפעם אחת.',
}

export function RosterImportModal({
  isOpen,
  onClose,
  eventId,
  context,
  groupsDisabled = false,
  onImported,
}: RosterImportModalProps) {
  const [stage, setStage] = useState<Stage>('pick')
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [existingNames, setExistingNames] = useState<string[]>([])
  const [existingGroups, setExistingGroups] = useState<Pick<Group, 'name' | 'color'>[]>([])
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState<RosterPlan | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<RosterImportResult | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Only a game that texts its participants asks the file for a phone column.
  const collectPhones = useSmsNotifications()

  useEffect(() => {
    if (!isOpen) return

    setStage('pick')
    setPlan(null)
    setError('')
    setFileName('')
    setProgress(0)
    setResult(null)
    setLoadingExisting(true)

    let cancelled = false
    async function loadExisting() {
      const [participants, groups] = await Promise.all([
        supabase.from('participants').select('name').eq('event_id', eventId),
        supabase.from('groups').select('name, color').eq('event_id', eventId),
      ])
      if (cancelled) return
      setExistingNames((participants.data ?? []).map((p) => p.name as string))
      setExistingGroups((groups.data ?? []) as Pick<Group, 'name' | 'color'>[])
      setLoadingExisting(false)
    }
    loadExisting()
    return () => { cancelled = true }
  }, [isOpen, eventId])

  const handleFile = useCallback(async (file: File) => {
    if (loadingExisting) {
      // Without the current roster the preview can't tell new names from ones
      // that already exist, so wait rather than show misleading numbers.
      setError('רק רגע, טוענים את הרשימה הקיימת. נסו שוב עוד רגע.')
      return
    }

    setError('')
    setFileName(file.name)

    let grid: string[][]
    try {
      grid = await readSpreadsheetFile(file)
    } catch (err) {
      const code = err instanceof SpreadsheetError ? err.code : 'UNREADABLE_FILE'
      setError(FILE_ERRORS[code] ?? FILE_ERRORS.UNREADABLE_FILE)
      setFileName('')
      return
    }

    const next = planRosterImport(
      grid,
      {
        participantNames: existingNames,
        groupNames: existingGroups.map((group) => group.name),
      },
      { collectPhones },
    )

    if (next.error) {
      setError(PLAN_ERRORS[next.error])
      setFileName('')
      return
    }

    setPlan(next)
    setStage('preview')
  }, [existingNames, existingGroups, loadingExisting, collectPhones])

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so picking the same file again still fires a change event.
    event.target.value = ''
    if (file) handleFile(file)
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (!plan) return
    setStage('importing')
    setProgress(0)
    setError('')

    try {
      const imported = await importRoster(
        eventId,
        plan,
        existingGroups.map((group) => group.color),
        { onProgress: (done, total) => setProgress(total > 0 ? done / total : 0) },
      )

      // A cap can stop the import part-way, so the lists are refreshed whenever
      // anything at all was written.
      if (imported.participantsCreated > 0 || imported.groupsCreated > 0) {
        onImported(imported)
      }
      if (imported.planLimitReached) setUpgradeOpen(true)

      if (imported.participantsCreated === 0 && imported.groupsCreated === 0) {
        setStage('preview')
        return
      }

      setResult(imported)
      setStage('done')
    } catch (err) {
      setStage('preview')
      const message = err instanceof Error ? err.message : ''
      if (isMissingPhoneColumnError(message)) {
        setError(MISSING_PHONE_COLUMN_MESSAGE)
        return
      }
      setError(message ? `הייבוא נכשל: ${message}` : 'הייבוא נכשל. נסו שוב.')
    }
  }

  const newGroupCount = plan?.newGroups.length ?? 0
  const skipped = plan ? skippedRowCount(plan) : 0

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={stage === 'importing' ? () => {} : onClose}
        title={context === 'groups' ? 'ייבוא קבוצות ומשתתפים מקובץ' : 'ייבוא משתתפים מקובץ'}
        dialogClassName="max-w-lg"
      >
        {stage === 'pick' && (
          <div className="space-y-4">
            <ol className="space-y-2.5">
              <ImportStep index={1} icon={<Download size={16} strokeWidth={2} />}>
                הורידו את קובץ הדוגמה.
              </ImportStep>
              <ImportStep index={2} icon={<FileSpreadsheet size={16} strokeWidth={2} />}>
                מלאו שורה לכל משתתף: <strong className="font-semibold text-foreground">{NAME_COLUMN_HEADER}</strong>
                {' '}ולצידו <strong className="font-semibold text-foreground">{GROUP_COLUMN_HEADER}</strong>
                {collectPhones && <> ו-<strong className="font-semibold text-foreground">{PHONE_COLUMN_HEADER}</strong></>}.
                מחקו את שורות הדוגמה.
              </ImportStep>
              <ImportStep index={3} icon={<Upload size={16} strokeWidth={2} />}>
                העלו את הקובץ חזרה לכאן.
              </ImportStep>
            </ol>

            <Alert variant="warning">
              {context === 'groups' ? (
                <>
                  <strong className="font-semibold">שימו לב:</strong> אותו קובץ מגדיר גם את שמות המשתתפים.
                  כל שורה היא משתתף אחד, והקבוצות נוצרות מעמודת "{GROUP_COLUMN_HEADER}".
                </>
              ) : (
                <>
                  <strong className="font-semibold">שימו לב:</strong> עמודת "{GROUP_COLUMN_HEADER}" יוצרת גם קבוצות.
                  כל שם קבוצה שיופיע בקובץ ואינו קיים באירוע ייווצר כקבוצה חדשה, והמשתתפים ישויכו אליה.
                  {groupsDisabled && ' אם תשאירו את העמודה ריקה, האירוע יישאר תחרות בין משתתפים.'}
                </>
              )}
            </Alert>

            {collectPhones && (
              <div className={cn('flex items-start gap-2 p-3 text-sm leading-relaxed text-muted', theme.surfaceInset)}>
                <Phone size={16} className="mt-0.5 shrink-0 text-secondary-text" aria-hidden="true" />
                <p>
                  <strong className="font-semibold text-foreground">{PHONE_COLUMN_HEADER}:</strong>{' '}
                  המשחק שולח הודעות SMS, אז מלאו גם עמודת טלפון. אפשר לכתוב את המספר בכל צורה
                  (050-1234567, ‎054 987 6543) ואנחנו נסדר אותו. משתתף בלי מספר תקין ייובא, אבל לא יקבל הודעות.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => downloadRosterTemplate({ includePhoneColumn: collectPhones })}
              >
                <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                הורדת קובץ לדוגמה
              </Button>
              <button
                type="button"
                onClick={() => downloadRosterTemplateCsv({ includePhoneColumn: collectPhones })}
                className={cn('mx-auto block rounded px-1 text-[11px] text-muted underline-offset-2 hover:underline', theme.focusRing)}
              >
                או הורדה כקובץ CSV
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
                dragging ? 'border-accent bg-surface-elevated' : 'border-border bg-surface-elevated',
              )}
            >
              <Upload size={24} strokeWidth={1.75} className="text-secondary-text" aria-hidden="true" />
              <p className="text-sm text-muted">גררו לכאן קובץ Excel או CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={SPREADSHEET_ACCEPT}
                onChange={handleInputChange}
                className="sr-only"
                aria-label="בחירת קובץ לייבוא"
              />
              <Button
                size="sm"
                className="gap-1.5"
                loading={loadingExisting}
                onClick={() => fileInputRef.current?.click()}
              >
                בחירת קובץ
              </Button>
            </div>

            {error && <Alert variant="error" message={error} />}
          </div>
        )}

        {stage === 'preview' && plan && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-muted">
              <FileSpreadsheet size={16} className="shrink-0 text-secondary-text" aria-hidden="true" />
              <span className="min-w-0 truncate">{fileName}</span>
            </p>

            <div className="grid grid-cols-3 gap-2">
              <SummaryTile icon={<Users size={15} />} value={plan.entries.length} label="משתתפים חדשים" />
              <SummaryTile icon={<Layers size={15} />} value={newGroupCount} label="קבוצות חדשות" />
              <SummaryTile value={skipped} label="שורות שידולגו" muted />
            </div>

            {newGroupCount > 0 && (
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      הייבוא ייצור {newGroupCount === 1 ? 'קבוצה חדשה אחת' : `${newGroupCount} קבוצות חדשות`}
                      {groupsDisabled && ', והאירוע יעבור לתחרות בין קבוצות'}.
                    </p>
                    <p className="leading-relaxed">{plan.newGroups.join(' · ')}</p>
                  </div>
                </div>
              </Alert>
            )}

            {collectPhones && plan.missingPhoneRows > 0 && (
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <Phone size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {plan.missingPhoneRows === plan.entries.length
                        ? 'לאף אחד מהמשתתפים בקובץ אין מספר טלפון תקין'
                        : `${plan.missingPhoneRows} מהמשתתפים בקובץ בלי מספר טלפון תקין`}
                    </p>
                    <p className="leading-relaxed">
                      הם ייובאו בכל מקרה, אבל לא יקבלו הודעות SMS עד שתשלימו להם מספר.
                      בדקו שיש בקובץ עמודת "{PHONE_COLUMN_HEADER}" ושהמספרים בה ניידים.
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {plan.alreadyInEventRows > 0 && (
              <p className="text-xs leading-relaxed text-muted">
                {plan.alreadyInEventRows} שמות כבר קיימים באירוע ולא ייווצרו שוב
                {plan.duplicateRows > 0 && `, ועוד ${plan.duplicateRows} שורות כפולות בתוך הקובץ`}.
              </p>
            )}
            {plan.alreadyInEventRows === 0 && plan.duplicateRows > 0 && (
              <p className="text-xs leading-relaxed text-muted">
                {plan.duplicateRows} שורות כפולות בתוך הקובץ ידולגו.
              </p>
            )}

            {plan.entries.length > 0 && (
              <div className={cn('overflow-hidden rounded-xl border', theme.border)}>
                <table className="w-full text-right text-sm">
                  <thead className="bg-surface-elevated text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">{NAME_COLUMN_HEADER}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{GROUP_COLUMN_HEADER}</th>
                      {collectPhones && (
                        <th scope="col" className="px-3 py-2 font-semibold">{PHONE_COLUMN_HEADER}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.entries.slice(0, PREVIEW_ROWS).map((entry, index) => (
                      <tr key={`${entry.name}-${index}`} className="border-t border-border">
                        <td className="px-3 py-1.5 text-foreground">{entry.name}</td>
                        <td className="px-3 py-1.5 text-muted">{entry.group || 'כל הקבוצות'}</td>
                        {collectPhones && (
                          // The number as it will be stored, so a wrong column
                          // or a number we could not read shows up here first.
                          <td className="px-3 py-1.5 text-muted" dir="ltr">
                            {entry.phone
                              ? formatPhone(entry.phone)
                              : <span className="text-danger-text">חסר</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan.entries.length > PREVIEW_ROWS && (
                  <p className="border-t border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted">
                    ועוד {plan.entries.length - PREVIEW_ROWS} משתתפים בקובץ
                  </p>
                )}
              </div>
            )}

            {error && <Alert variant="error" message={error} />}

            <ModalActions>
              <Button onClick={handleImport} disabled={!planHasWork(plan)}>
                ייבוא {plan.entries.length > 0 ? `${plan.entries.length} משתתפים` : 'הקבוצות'}
              </Button>
              <Button variant="outline" onClick={() => { setStage('pick'); setPlan(null); setFileName('') }}>
                בחירת קובץ אחר
              </Button>
            </ModalActions>
          </div>
        )}

        {stage === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Spinner size="lg" />
            <p className="text-sm text-muted">מייבא את הרשימה...</p>
            {progress > 0 && (
              <div className="w-full max-w-xs">
                <ProgressBar value={progress * 100} />
              </div>
            )}
          </div>
        )}

        {stage === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <CheckCircle2 size={36} strokeWidth={1.75} className="text-success-text" aria-hidden="true" />
              <p className="text-base font-semibold text-foreground">הייבוא הושלם</p>
              <p className="text-sm leading-relaxed text-muted">
                נוספו {result.participantsCreated} משתתפים
                {result.groupsCreated > 0 && ` ו-${result.groupsCreated} קבוצות`}.
                {result.skipped > 0 && ` ${result.skipped} שורות דולגו.`}
              </p>
            </div>
            <ModalActions>
              <Button onClick={onClose}>סיום</Button>
            </ModalActions>
          </div>
        )}
      </Modal>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />
    </>
  )
}

function ImportStep({ index, icon, children }: { index: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-secondary-text">
        {icon}
      </span>
      <span className="pt-1 text-sm leading-relaxed text-muted">
        <span className="sr-only">שלב {index}: </span>
        {children}
      </span>
    </li>
  )
}

function SummaryTile({
  icon,
  value,
  label,
  muted = false,
}: {
  icon?: React.ReactNode
  value: number
  label: string
  muted?: boolean
}) {
  return (
    <div className={cn('rounded-xl border border-border px-3 py-2.5 text-center', muted ? 'bg-surface' : 'bg-surface-elevated')}>
      <div className={cn('flex items-center justify-center gap-1.5', muted ? 'text-muted' : 'text-secondary-text')}>
        {icon}
        <span className="text-lg font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  )
}
