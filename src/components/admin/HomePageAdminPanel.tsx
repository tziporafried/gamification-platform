import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { House, ExternalLink, Copy, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { loadActiveHomeIdForAdmin, saveActiveHomeId } from '@/lib/siteSettings'
import { CODE_DEFAULT_HOME, HOME_PAGES, codeDefaultHomePage, findHomePage } from '@/pages/home/homePages'
import { cn } from '@/lib/utils'

const MISSING_TABLE_HINT =
  'טבלת ההגדרות עדיין לא הותקנה במסד הנתונים. הריצו את supabase/APPLY_SITE_SETTINGS.sql ורעננו. ' +
  'עד אז האתר מציג את ברירת המחדל שבקוד.'

/** Value of the "follow the code" option in the picker. */
const CODE_OPTION = '__code__'

/**
 * Which homepage `/` shows. Picking "ברירת המחדל מהקוד" clears the saved
 * choice, so CODE_DEFAULT_HOME in homePages.ts decides again.
 */
export function HomePageAdminPanel() {
  const { user } = useAuth()
  const [savedId, setSavedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingOption, setSavingOption] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await loadActiveHomeIdForAdmin()
    setSavedId(res.id)
    setTableMissing(res.tableMissing)
    setError(res.tableMissing ? null : res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function choose(option: string) {
    const nextId = option === CODE_OPTION ? null : option
    if (nextId === savedId) return
    setSavingOption(option)
    setError(null)
    const saveError = await saveActiveHomeId(nextId, user?.id ?? null)
    setSavingOption(null)
    if (saveError) {
      setError(saveError)
      return
    }
    setSavedId(nextId)
  }

  function linkFor(id: string) {
    return `${window.location.origin}/home/${id}`
  }

  function copyLink(id: string) {
    void navigator.clipboard?.writeText(linkFor(id))
    setCopiedId(id)
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600)
  }

  if (loading) return <CenteredLoader />

  const codeDefault = codeDefaultHomePage()
  const savedPage = findHomePage(savedId)
  // A saved id that no longer exists in code is ignored by the site.
  const effective = savedPage ?? codeDefault
  const selectedOption = savedPage ? savedPage.id : CODE_OPTION

  return (
    <>
      {tableMissing && (
        <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-warning-text">
          {MISSING_TABLE_HINT}
        </p>
      )}
      {error && <ErrorAlert message={error} className="mb-4" />}

      <div className="mb-5">
        <div className="flex items-center gap-2">
          <House size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-medium text-muted">
            מוצג כרגע בדף הבית: <span className="text-foreground">{effective.label}</span>
          </h2>
        </div>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
          בחרו איזה אזור פתיחה יוצג בראש דף הבית. שאר הדף נשאר אותו דבר. כל גרסה זמינה תמיד גם בקישור משלה, גם כשהיא לא הפעילה.
          {savedId && !savedPage && ` הבחירה השמורה (${savedId}) כבר לא קיימת בקוד, ולכן מוצגת ברירת המחדל.`}
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="הגרסה הפעילה של דף הבית">
        <OptionCard
          checked={selectedOption === CODE_OPTION}
          saving={savingOption === CODE_OPTION}
          disabled={tableMissing || savingOption !== null}
          onSelect={() => void choose(CODE_OPTION)}
          title="ברירת המחדל מהקוד"
          subtitle={`כרגע: ${codeDefault.label} (CODE_DEFAULT_HOME = '${CODE_DEFAULT_HOME}')`}
        />

        {HOME_PAGES.map((page) => (
          <OptionCard
            key={page.id}
            checked={selectedOption === page.id}
            saving={savingOption === page.id}
            disabled={tableMissing || savingOption !== null}
            onSelect={() => void choose(page.id)}
            title={page.label}
            subtitle={page.description}
            badge={page.id === codeDefault.id ? 'ברירת המחדל בקוד' : undefined}
            trailing={
              <div className="flex shrink-0 items-center gap-1">
                <code className="hidden rounded bg-surface-elevated px-2 py-1 text-xs text-muted sm:inline" dir="ltr">
                  /home/{page.id}
                </code>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyLink(page.id)
                  }}
                  aria-label={`העתקת הקישור ל${page.label}`}
                >
                  {copiedId === page.id ? <Check size={14} /> : <Copy size={14} />}
                </Button>
                <a
                  href={`/home/${page.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center rounded-lg px-2.5 py-1 text-muted hover:bg-surface-elevated hover:text-foreground"
                  aria-label={`פתיחת ${page.label} בלשונית חדשה`}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            }
          />
        ))}
      </div>
    </>
  )
}

function OptionCard({
  checked,
  saving,
  disabled,
  onSelect,
  title,
  subtitle,
  badge,
  trailing,
}: {
  checked: boolean
  saving: boolean
  disabled: boolean
  onSelect: () => void
  title: string
  subtitle?: string
  badge?: string
  trailing?: ReactNode
}) {
  return (
    <Card
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer items-center gap-3 p-4 transition-colors',
        checked ? 'border-primary ring-1 ring-primary' : 'hover:bg-surface-elevated',
        disabled && !checked && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-primary' : 'border-border-strong',
        )}
        aria-hidden="true"
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{title}</span>
          {badge && <Badge label={badge} color="var(--color-secondary-text)" variant="quiet" />}
          {saving && <span className="text-xs text-muted">שומר…</span>}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {trailing}
    </Card>
  )
}
