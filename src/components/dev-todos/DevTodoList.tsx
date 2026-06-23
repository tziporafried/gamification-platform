import { useState, useEffect, useRef } from 'react'
import { Plus, CheckCircle2, Circle, Clock, ChevronDown, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { DevTodo, DevTodoStatus, DevTodoPriority } from '@/types'

interface AdminUser {
  id: string
  email: string
  display_name: string | null
}

const STATUS_CONFIG: Record<DevTodoStatus, { label: string; icon: typeof Circle; color: string }> = {
  todo: { label: 'לביצוע', icon: Circle, color: 'text-gray-400' },
  in_progress: { label: 'בעבודה', icon: Clock, color: 'text-amber-400' },
  done: { label: 'הושלם', icon: CheckCircle2, color: 'text-emerald-400' },
}

const PRIORITY_CONFIG: Record<DevTodoPriority, { label: string; color: string; dot: string }> = {
  low: { label: 'נמוך', color: 'text-gray-400', dot: 'bg-gray-400' },
  medium: { label: 'בינוני', color: 'text-blue-400', dot: 'bg-blue-400' },
  high: { label: 'גבוה', color: 'text-red-400', dot: 'bg-red-400' },
}

export function DevTodoList() {
  const { user } = useAuth()
  const [todos, setTodos] = useState<DevTodo[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [todosRes, adminsRes] = await Promise.all([
        supabase
          .from('dev_todos')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .eq('role', 'super_admin'),
      ])

      setTodos(todosRes.data ?? [])
      setAdmins((adminsRes.data as AdminUser[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [refreshKey])

  function triggerRefresh() { setRefreshKey(k => k + 1) }

  async function addTodo() {
    const trimmed = newTitle.trim()
    if (!trimmed || adding || !user) return
    setAdding(true)
    await supabase.from('dev_todos').insert({
      title: trimmed,
      created_by: user.id,
    })
    setNewTitle('')
    setAdding(false)
    triggerRefresh()
  }

  async function updateField(id: string, field: string, value: any) {
    await supabase.from('dev_todos').update({ [field]: value }).eq('id', id)
    triggerRefresh()
  }

  async function deleteTodo(id: string) {
    await supabase.from('dev_todos').delete().eq('id', id)
    triggerRefresh()
  }

  function getAssigneeName(userId: string | null) {
    if (!userId) return null
    const a = admins.find(a => a.id === userId)
    return a?.display_name || a?.email || null
  }

  const todoItems = todos.filter(t => t.status === 'todo')
  const inProgressItems = todos.filter(t => t.status === 'in_progress')
  const doneItems = todos.filter(t => t.status === 'done')

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add new todo */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-game-border bg-game-card/50 p-3 transition-colors focus-within:border-brand-500/50">
        <Plus size={18} className="shrink-0 text-gray-500" />
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo() } }}
          placeholder="משימה חדשה..."
          className={cn(
            'flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none',
            adding && 'opacity-50',
          )}
          disabled={adding}
        />
        {newTitle.trim() && (
          <button
            onClick={addTodo}
            disabled={adding}
            className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
          >
            הוסף
          </button>
        )}
      </div>

      {/* Sections */}
      {todoItems.length > 0 && (
        <TodoSection title="לביצוע" count={todoItems.length} color="text-gray-400">
          {todoItems.map(todo => (
            <TodoRow key={todo.id} todo={todo} admins={admins} onUpdate={updateField} onDelete={deleteTodo} getAssigneeName={getAssigneeName} />
          ))}
        </TodoSection>
      )}

      {inProgressItems.length > 0 && (
        <TodoSection title="בעבודה" count={inProgressItems.length} color="text-amber-400">
          {inProgressItems.map(todo => (
            <TodoRow key={todo.id} todo={todo} admins={admins} onUpdate={updateField} onDelete={deleteTodo} getAssigneeName={getAssigneeName} />
          ))}
        </TodoSection>
      )}

      {doneItems.length > 0 && (
        <TodoSection title="הושלם" count={doneItems.length} color="text-emerald-400">
          {doneItems.map(todo => (
            <TodoRow key={todo.id} todo={todo} admins={admins} onUpdate={updateField} onDelete={deleteTodo} getAssigneeName={getAssigneeName} />
          ))}
        </TodoSection>
      )}

      {todos.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          אין משימות עדיין. הוסף משימה חדשה למעלה.
        </div>
      )}
    </div>
  )
}

function TodoSection({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className={cn('text-sm font-semibold', color)}>{title}</h3>
        <span className="text-[11px] text-gray-500 bg-gray-800 rounded-full px-1.5 py-0.5">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function TodoRow({
  todo,
  admins,
  onUpdate,
  onDelete,
  getAssigneeName,
}: {
  todo: DevTodo
  admins: AdminUser[]
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
  getAssigneeName: (userId: string | null) => string | null
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [statusOpen, setStatusOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)

  useEffect(() => { setTitle(todo.title) }, [todo.title])

  const statusConf = STATUS_CONFIG[todo.status]
  const StatusIcon = statusConf.icon
  const priorityConf = PRIORITY_CONFIG[todo.priority]
  const assigneeName = getAssigneeName(todo.assigned_to)

  function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === todo.title) {
      setTitle(todo.title)
      setEditing(false)
      return
    }
    onUpdate(todo.id, 'title', trimmed)
    setEditing(false)
  }

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border border-game-border bg-game-card px-3 py-2.5 transition-all hover:border-brand-700/50 group/todo',
      todo.status === 'done' && 'opacity-60',
    )}>
      {/* Status toggle */}
      <button
        onClick={() => {
          const next: DevTodoStatus = todo.status === 'todo' ? 'in_progress' : todo.status === 'in_progress' ? 'done' : 'todo'
          onUpdate(todo.id, 'status', next)
        }}
        className={cn('shrink-0 transition-colors', statusConf.color)}
        title={statusConf.label}
      >
        <StatusIcon size={18} />
      </button>

      {/* Title */}
      <div className="min-w-0 flex-1" onClick={() => !editing && setEditing(true)} role="button" tabIndex={-1}>
        {editing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(todo.title); setEditing(false) } }}
            onBlur={saveTitle}
            autoFocus
            className="w-full bg-transparent text-sm text-white outline-none border-b border-brand-500 pb-0.5"
          />
        ) : (
          <span className={cn(
            'block w-full text-sm text-gray-200 hover:text-white transition-colors cursor-text truncate',
            todo.status === 'done' && 'line-through',
          )}>
            {title}
          </span>
        )}
      </div>

      {/* Priority dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setPriorityOpen(!priorityOpen); setStatusOpen(false); setAssigneeOpen(false) }}
          title="עדיפות"
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all border border-game-border hover:border-gray-600',
            priorityConf.color,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', priorityConf.dot)} />
          {priorityConf.label}
        </button>
        {priorityOpen && (
          <DropdownMenu onClose={() => setPriorityOpen(false)}>
            <div className="px-3 py-1.5 text-[10px] text-gray-500">עדיפות</div>
            {(['high', 'medium', 'low'] as DevTodoPriority[]).map(p => (
              <button
                key={p}
                onClick={() => { onUpdate(todo.id, 'priority', p); setPriorityOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
                  todo.priority === p ? PRIORITY_CONFIG[p].color : 'text-gray-400',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', PRIORITY_CONFIG[p].dot)} />
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </DropdownMenu>
        )}
      </div>

      {/* Assignee dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setAssigneeOpen(!assigneeOpen); setStatusOpen(false); setPriorityOpen(false) }}
          title="אחראי"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all border border-game-border hover:border-gray-600 text-gray-400"
        >
          {assigneeName ? (
            <span className="text-brand-400 max-w-[80px] truncate">{assigneeName}</span>
          ) : (
            <span className="text-gray-500">לא משויך</span>
          )}
          <ChevronDown size={10} />
        </button>
        {assigneeOpen && (
          <DropdownMenu onClose={() => setAssigneeOpen(false)}>
            <div className="px-3 py-1.5 text-[10px] text-gray-500">שיוך לאחראי</div>
            <button
              onClick={() => { onUpdate(todo.id, 'assigned_to', null); setAssigneeOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
                !todo.assigned_to ? 'text-brand-400' : 'text-gray-400',
              )}
            >
              לא משויך
            </button>
            <div className="mx-2 my-1 border-t border-game-border" />
            {admins.map(a => (
              <button
                key={a.id}
                onClick={() => { onUpdate(todo.id, 'assigned_to', a.id); setAssigneeOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
                  todo.assigned_to === a.id ? 'text-brand-400' : 'text-gray-400',
                )}
              >
                <span className="truncate">{a.display_name || a.email}</span>
              </button>
            ))}
          </DropdownMenu>
        )}
      </div>

      {/* Status dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setStatusOpen(!statusOpen); setAssigneeOpen(false); setPriorityOpen(false) }}
          title="סטטוס"
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all border border-game-border hover:border-gray-600',
            statusConf.color,
          )}
        >
          {statusConf.label}
          <ChevronDown size={10} />
        </button>
        {statusOpen && (
          <DropdownMenu onClose={() => setStatusOpen(false)}>
            <div className="px-3 py-1.5 text-[10px] text-gray-500">סטטוס</div>
            {(['todo', 'in_progress', 'done'] as DevTodoStatus[]).map(s => {
              const conf = STATUS_CONFIG[s]
              const Icon = conf.icon
              return (
                <button
                  key={s}
                  onClick={() => { onUpdate(todo.id, 'status', s); setStatusOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5',
                    todo.status === s ? conf.color : 'text-gray-400',
                  )}
                >
                  <Icon size={14} />
                  {conf.label}
                </button>
              )
            })}
          </DropdownMenu>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(todo.id)}
        className="shrink-0 p-1 rounded-lg text-gray-600 opacity-0 group-hover/todo:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
        title="מחיקה"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function DropdownMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} className="absolute z-50 top-full mt-1 left-0 w-40 rounded-xl border border-game-border bg-game-card shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
      {children}
    </div>
  )
}
