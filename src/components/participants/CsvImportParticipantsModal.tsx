import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'

interface CsvImportParticipantsModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

interface ImportSummary {
  totalRows: number
  created: number
  skipped: number
  groupsCreated: number
  errors: { row: number; reason: string }[]
}

interface ParsedRow {
  rowNumber: number
  participantName: string
  groupName: string
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current)
  return fields
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/)
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(nonEmptyLines[0]).map((h) => h.trim().toLowerCase())
  const rows = nonEmptyLines.slice(1).map((line) => parseCsvLine(line))
  return { headers, rows }
}

export function CsvImportParticipantsModal({ eventId, isOpen, onClose, onImported }: CsvImportParticipantsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleReset() {
    setFile(null)
    setError('')
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (summary && (summary.created > 0 || summary.groupsCreated > 0)) {
      onImported()
    }
    handleReset()
    onClose()
  }

  async function handleImport() {
    if (!file) {
      setError('אנא בחרו קובץ CSV.')
      return
    }

    setError('')
    setImporting(true)

    try {
      const text = await file.text()
      const { headers, rows } = parseCsv(text)

      if (headers.length === 0) {
        setError('קובץ ה-CSV ריק.')
        setImporting(false)
        return
      }

      const nameIdx = headers.indexOf('participant_name')
      const groupIdx = headers.indexOf('group_name')

      if (nameIdx === -1 || groupIdx === -1) {
        const missing: string[] = []
        if (nameIdx === -1) missing.push('participant_name')
        if (groupIdx === -1) missing.push('group_name')
        setError(`עמודות חובה חסרות: ${missing.join(', ')}`)
        setImporting(false)
        return
      }

      const { data: existingParticipants } = await supabase
        .from('participants')
        .select('name')
        .eq('event_id', eventId)

      const existingParticipantNames = new Set(
        (existingParticipants ?? []).map((p) => p.name.toLowerCase())
      )

      const { data: existingGroups } = await supabase
        .from('groups')
        .select('id, name')
        .eq('event_id', eventId)

      const groupMap = new Map<string, string>()
      for (const g of existingGroups ?? []) {
        groupMap.set(g.name.toLowerCase(), g.id)
      }

      const errors: ImportSummary['errors'] = []
      const validRows: ParsedRow[] = []
      const seenNames = new Set<string>()

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2
        const fields = rows[i]

        const rawName = (fields[nameIdx] ?? '').trim()
        const rawGroup = (fields[groupIdx] ?? '').trim()

        if (!rawName && !rawGroup) continue

        if (!rawName) {
          errors.push({ row: rowNumber, reason: 'שם משתתף חסר' })
          continue
        }

        if (!rawGroup) {
          errors.push({ row: rowNumber, reason: 'שם קבוצה חסר' })
          continue
        }

        const nameLower = rawName.toLowerCase()

        if (existingParticipantNames.has(nameLower)) {
          errors.push({ row: rowNumber, reason: `משתתף "${rawName}" כבר קיים` })
          continue
        }

        if (seenNames.has(nameLower)) {
          errors.push({ row: rowNumber, reason: `משתתף כפול "${rawName}" ב-CSV` })
          continue
        }

        seenNames.add(nameLower)
        validRows.push({ rowNumber, participantName: rawName, groupName: rawGroup })
      }

      let groupsCreated = 0

      for (const row of validRows) {
        const groupLower = row.groupName.toLowerCase()
        if (!groupMap.has(groupLower)) {
          const { data: newGroup, error: groupError } = await supabase
            .from('groups')
            .insert({ event_id: eventId, name: row.groupName })
            .select()
            .single()

          if (groupError) {
            if (groupError.code === '23505') {
              const { data: refetched } = await supabase
                .from('groups')
                .select('id')
                .eq('event_id', eventId)
                .ilike('name', row.groupName)
                .single()
              if (refetched) {
                groupMap.set(groupLower, refetched.id)
              }
            } else {
              for (const r of validRows.filter((v) => v.groupName.toLowerCase() === groupLower)) {
                errors.push({ row: r.rowNumber, reason: `יצירת קבוצה "${row.groupName}" נכשלה: ${groupError.message}` })
              }
              continue
            }
          } else {
            groupMap.set(groupLower, newGroup.id)
            groupsCreated++
          }
        }
      }

      let created = 0
      for (const row of validRows) {
        const groupId = groupMap.get(row.groupName.toLowerCase())
        if (!groupId) continue

        const { data: newParticipant, error: insertError } = await supabase
          .from('participants')
          .insert({ event_id: eventId, name: row.participantName })
          .select()
          .single()

        if (insertError) {
          errors.push({ row: row.rowNumber, reason: insertError.message })
          continue
        }

        const { error: assignError } = await supabase
          .from('participant_groups')
          .insert({ participant_id: newParticipant.id, group_id: groupId })

        if (assignError) {
          errors.push({ row: row.rowNumber, reason: `משתתף נוצר אך שיוך לקבוצה נכשל: ${assignError.message}` })
        }

        created++
      }

      const totalRows = rows.filter((fields) => {
        const rawName = (fields[nameIdx] ?? '').trim()
        const rawGroup = (fields[groupIdx] ?? '').trim()
        return rawName || rawGroup
      }).length

      const skipped = totalRows - created - errors.length

      setSummary({ totalRows, created, skipped, groupsCreated, errors })
    } catch {
      setError('קריאת קובץ ה-CSV נכשלה.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="ייבוא משתתפים מ-CSV">
      <div className="space-y-4">
        {error && (
          <ErrorAlert message={error} />
        )}

        {!summary ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">קובץ CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setError('')
                }}
                className="block w-full text-sm text-gray-500 file:ml-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-500/20 file:text-brand-300 hover:file:bg-brand-500/30"
              />
            </div>

            <div className="rounded-lg bg-game-dark border border-game-border rounded-xl p-3">
              <p className="text-xs font-medium text-gray-700 mb-1">עמודות נדרשות:</p>
              <code className="text-xs text-gray-400">participant_name, group_name</code>
              <p className="text-xs text-gray-500 mt-2">
                קבוצות חסרות ייווצרו אוטומטית. שמות משתתפים כפולים ידולגו.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleImport} loading={importing} disabled={!file}>
                ייבוא
              </Button>
              <Button variant="outline" onClick={handleClose}>
                ביטול
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">סה״כ שורות שעובדו</span>
                <span className="font-medium text-gray-900">{summary.totalRows}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">משתתפים שנוצרו</span>
                <span className="font-medium text-green-700">{summary.created}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">שורות שדולגו (כפולים)</span>
                <span className="font-medium text-yellow-700">{summary.skipped}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">קבוצות שנוצרו</span>
                <span className="font-medium text-blue-700">{summary.groupsCreated}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">שגיאות</span>
                <span className="font-medium text-red-700">{summary.errors.length}</span>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-medium text-red-800 mb-2">פירוט שגיאות:</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {summary.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-700">
                      שורה {err.row}: {err.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleClose}>סיום</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
