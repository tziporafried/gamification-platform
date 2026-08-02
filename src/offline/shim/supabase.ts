import {
  OFFLINE_USER_ID,
  awardRewards,
  awardRows,
  deleteScan,
  getEventRow,
  getPack,
  groupLeaderboard,
  lotteryDrawRows,
  participantLeaderboard,
  previewDeleteScan,
  recordLotteryDraw,
  recordLotteryEntrants,
  recordScan,
  scanRows,
  subscribeToTable,
} from './data'

/**
 * A minimal PostgREST/realtime/auth shim that answers exactly the queries the
 * real kiosk, display, useScoreSubmit and AuthContext make - from the embedded
 * pack instead of the network. Lets those components run unchanged offline.
 */

type Result = { data: unknown; error: unknown; count: number | null }
type Filter = { op: 'eq' | 'neq' | 'in'; col: string; val: unknown }

function ok(data: unknown, count: number | null = null): Result {
  return { data, error: null, count }
}

/**
 * The answer for a write this shim does not implement.
 *
 * Shaped like postgres' undefined_table so isMissingTable() reads it the way
 * the caller's own fallback expects, and - far more importantly - so a write
 * aimed at an unknown table fails loudly instead of landing somewhere else. It
 * used to land in the scan log: every lottery draw wrote itself and each of its
 * entrants in as pointless scans, which turned those players' totals into NaN
 * and quietly dropped them out of every points-based lottery afterwards.
 */
function missingTable(table: string): Result {
  return {
    data: null,
    error: { code: '42P01', message: `relation "${table}" does not exist` },
    count: null,
  }
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Filter[]): T[] {
  return rows.filter((row) =>
    filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val
      if (f.op === 'neq') return row[f.col] !== f.val
      if (f.op === 'in') return Array.isArray(f.val) && (f.val as unknown[]).includes(row[f.col])
      return true
    }),
  )
}

class QueryBuilder implements PromiseLike<Result> {
  private selectStr = '*'
  private head = false
  private wantCount = false
  private filters: Filter[] = []
  private orderCol: string | null = null
  private orderAsc = true
  private limitN: number | null = null
  private singleMode: 'single' | 'maybe' | null = null
  private insertRows: Record<string, unknown>[] | null = null

  private table: string

  // Written out rather than as a constructor parameter property, so the file
  // loads under node's type-stripping test runner.
  constructor(table: string) {
    this.table = table
  }

  select(str = '*', opts?: { count?: string; head?: boolean }) {
    this.selectStr = str
    if (opts?.head) this.head = true
    if (opts?.count) this.wantCount = true
    return this
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.insertRows = Array.isArray(rows) ? rows : [rows]
    return this
  }
  eq(col: string, val: unknown) { this.filters.push({ op: 'eq', col, val }); return this }
  neq(col: string, val: unknown) { this.filters.push({ op: 'neq', col, val }); return this }
  in(col: string, val: unknown[]) { this.filters.push({ op: 'in', col, val }); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending ?? true; return this }
  limit(n: number) { this.limitN = n; return this }
  single() { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }

  private has(sub: string) { return this.selectStr.includes(sub) }

  private rows(): Record<string, unknown>[] {
    const pack = getPack()
    switch (this.table) {
      case 'events':
        return [getEventRow() as Record<string, unknown>]
      case 'user_profiles':
        return [{ id: OFFLINE_USER_ID, email: 'offline@local', display_name: 'מפעיל', avatar_url: null, role: 'user' }]
      case 'participants':
        return pack.participants.map((p) => ({
          ...p,
          participant_groups: pack.participantGroups
            .filter((m) => m.participant_id === p.id)
            .map((m) => {
              const g = pack.groups.find((x) => x.id === m.group_id)
              // WinnersCeremony wants nested groups(id,name,color); the kiosk wants group_id.
              return this.has('groups(') && g
                ? { group_id: m.group_id, groups: { id: g.id, name: g.name, color: g.color } }
                : { group_id: m.group_id }
            }),
        }))
      case 'actions':
        return pack.actions.map((a) => ({
          ...a,
          action_groups: pack.actionGroups
            .filter((l) => l.action_id === a.id)
            .map((l) => {
              const g = pack.groups.find((x) => x.id === l.group_id)
              return this.has('groups(') && g
                ? { group_id: l.group_id, groups: { id: g.id, name: g.name, color: g.color } }
                : { group_id: l.group_id }
            }),
        }))
      case 'groups':
        return pack.groups.map((g) => ({ ...g }))
      case 'rewards':
        return pack.rewards.map((r) => ({
          ...r,
          reward_groups: pack.rewardGroups.filter((l) => l.reward_id === r.id).map((l) => ({ group_id: l.group_id })),
        }))
      case 'reward_groups':
        return pack.rewardGroups.map((l) => ({ ...l }))
      case 'action_groups':
        return pack.actionGroups.map((l) => ({ ...l }))
      case 'action_options':
        return (pack.actionOptions ?? []).map((o) => ({ ...o }))
      case 'participant_groups':
        return pack.participantGroups.map((m) => {
          const g = pack.groups.find((x) => x.id === m.group_id)
          return this.has('groups(') && g
            ? { participant_id: m.participant_id, group_id: m.group_id, groups: { id: g.id, name: g.name, color: g.color } }
            : { participant_id: m.participant_id, group_id: m.group_id }
        })
      case 'point_transactions':
        return scanRows() as unknown as Record<string, unknown>[]
      case 'participant_rewards':
        return awardRows() as unknown as Record<string, unknown>[]
      case 'lottery_draws':
        return lotteryDrawRows() as unknown as Record<string, unknown>[]
      default:
        return []
    }
  }

  /** Writes, per table. Anything else is a table this shim does not have. */
  private insertRun(rows: Record<string, unknown>[]): Result {
    switch (this.table) {
      case 'point_transactions': {
        const inserted = rows.map((r) => recordScan(r as never))
        return ok(this.singleMode ? inserted[0] : inserted)
      }
      case 'lottery_draws': {
        const inserted = rows.map((r) => recordLotteryDraw(r))
        return ok(this.singleMode ? inserted[0] : inserted)
      }
      case 'lottery_draw_entrants': {
        const inserted = recordLotteryEntrants(rows)
        return ok(this.singleMode ? inserted[0] : inserted)
      }
      default:
        return missingTable(this.table)
    }
  }

  private run(): Result {
    if (this.insertRows) return this.insertRun(this.insertRows)

    let rows = applyFilters(this.rows(), this.filters)

    if (this.orderCol) {
      const col = this.orderCol
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number
        const bv = b[col] as string | number
        if (av === bv) return 0
        return (av < bv ? -1 : 1) * (this.orderAsc ? 1 : -1)
      })
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN)

    if (this.head && this.wantCount) return ok(null, rows.length)

    if (this.singleMode) return ok(rows[0] ?? null, this.wantCount ? rows.length : null)
    return ok(rows, this.wantCount ? rows.length : null)
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    } catch (error) {
      return Promise.resolve({ data: null, error, count: null } as Result).then(onfulfilled, onrejected)
    }
  }
}

function rpc(name: string, params?: Record<string, unknown>): PromiseLike<Result> {
  try {
    if (name === 'get_participant_leaderboard') return Promise.resolve(ok(participantLeaderboard()))
    if (name === 'get_group_leaderboard') return Promise.resolve(ok(groupLeaderboard()))
    if (name === 'check_and_award_rewards') {
      const pid = (params?.p_participant_id as string) ?? ''
      return Promise.resolve(ok(awardRewards(pid)))
    }
    if (name === 'preview_delete_event_scan') {
      return Promise.resolve(ok(previewDeleteScan((params?.p_transaction_id as string) ?? '')))
    }
    if (name === 'delete_event_scan') {
      return Promise.resolve(
        ok(
          deleteScan(
            (params?.p_transaction_id as string) ?? '',
            (params?.p_transfers as { reward_id: string; participant_id: string }[]) ?? [],
          ),
        ),
      )
    }
    // Unknown RPCs (e.g. analytics/affiliate) are harmless no-ops offline.
    return Promise.resolve(ok(null))
  } catch (error) {
    return Promise.resolve({ data: null, error, count: null } as Result)
  }
}

interface ChannelFilter { event?: string; table?: string }
class Channel {
  private unsub: (() => void)[] = []
  name: string
  constructor(name: string) {
    this.name = name
  }
  on(_type: string, filter: ChannelFilter, cb: (payload: { new: Record<string, unknown> }) => void) {
    const table = filter?.table
    if (table === 'point_transactions' || table === 'participant_rewards' || table === 'events') {
      this.unsub.push(subscribeToTable(table, cb))
    }
    return this
  }
  subscribe() { return this }
  teardown() { this.unsub.forEach((fn) => fn()); this.unsub = [] }
}

const auth = {
  async getSession() {
    return { data: { session: { user: { id: OFFLINE_USER_ID, email: 'offline@local' } } }, error: null }
  },
  async getUser() {
    return { data: { user: { id: OFFLINE_USER_ID, email: 'offline@local' } }, error: null }
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } }
  },
  async signInWithOAuth() { return { data: null, error: null } },
  async signInWithPassword() { return { data: null, error: { message: 'offline' } } },
  async signUp() { return { data: null, error: { message: 'offline' } } },
  async signOut() { return { error: null } },
}

export const supabase = {
  from(table: string) { return new QueryBuilder(table) },
  rpc,
  channel(name: string) { return new Channel(name) },
  removeChannel(ch: Channel) { ch.teardown() },
  auth,
}
