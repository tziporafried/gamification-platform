import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface CsvImportActionsModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

interface ImportSummary {
  totalRows: number
  created: number
  skipped: number
  errors: { row: number; reason: string }[]
}

interface ParsedRow {
  rowNumber: number
  actionName: string
  points: number
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

export function CsvImportActionsModal({ eventId, isOpen, onClose, onImported }: CsvImportActionsModalProps) {
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
    if (summary && summary.created > 0) {
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

      const nameIdx = headers.indexOf('action_name')
      const pointsIdx = headers.indexOf('points')

      if (nameIdx === -1 || pointsIdx === -1) {
        const missing: string[] = []
        if (nameIdx === -1) missing.push('action_name')
        if (pointsIdx === -1) missing.push('points')
        setError(`עמודות חובה חסרות: ${missing.join(', ')}`)
        setImporting(false)
        return
      }

      const { data: existingActions } = await supabase
        .from('actions')
        .select('name')
        .eq('event_id', eventId)

      const existingNames = new Set(
        (existingActions ?? []).map((a) => a.name.toLowerCase())
      )

      const seenNames = new Set<string>()
      const errors: ImportSummary['errors'] = []
      const validRows: ParsedRow[] = []

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2
        const fields = rows[i]

        const rawName = (fields[nameIdx] ?? '').trim()
        const rawPoints = (fields[pointsIdx] ?? '').trim()

        if (!rawName && !rawPoints) continue

        if (!rawName) {
          errors.push({ row: rowNumber, reason: 'שם משימה חסר' })
          continue
        }

        if (!rawPoints) {
          errors.push({ row: rowNumber, reason: 'ערך ניקוד חסר' })
          continue
        }

        const pointsNum = parseInt(rawPoints, 10)
        if (isNaN(pointsNum) || rawPoints !== pointsNum.toString()) {
          errors.push({ row: rowNumber, reason: `ערך ניקוד לא תקין: "${rawPoints}"` })
          continue
        }

        const nameLower = rawName.toLowerCase()

        if (existingNames.has(nameLower)) {
          errors.push({ row: rowNumber, reason: `משימה "${rawName}" כבר קיימת` })
          continue
        }

        if (seenNames.has(nameLower)) {
          errors.push({ row: rowNumber, reason: `משימה כפולה "${rawName}" ב-CSV` })
          continue
        }

        seenNames.add(nameLower)
        validRows.push({ rowNumber, actionName: rawName, points: pointsNum })
      }

      let created = 0
      for (const row of validRows) {
        const { error: insertError } = await supabase
          .from('actions')
          .insert({
            event_id: eventId,
            name: row.actionName,
            points: row.points,
          })

        if (insertError) {
          errors.push({ row: row.rowNumber, reason: insertError.message })
        } else {
          created++
        }
      }

      const totalRows = rows.filter((fields) => {
        const rawName = (fields[nameIdx] ?? '').trim()
        const rawPoints = (fields[pointsIdx] ?? '').trim()
        return rawName || rawPoints
      }).length

      const skipped = totalRows - created - errors.length

      setSummary({ totalRows, created, skipped, errors })
    } catch {
      setError('קריאת קובץ ה-CSV נכשלה.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="ייבוא משימות מ-CSV">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
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
              <code className="text-xs text-gray-400">action_name, points</code>
              <p className="text-xs text-gray-500 mt-2">
                ניקוד יכול להיות מספר שלם חיובי או שלילי. שמות משימות כפולים ידולגו.
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
                <span className="text-gray-600">משימות שנוצרו</span>
                <span className="font-medium text-green-700">{summary.created}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">שורות שדולגו (כפולים)</span>
                <span className="font-medium text-yellow-700">{summary.skipped}</span>
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
