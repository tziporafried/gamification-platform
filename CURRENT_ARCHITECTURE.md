# Current Architecture

## Folder Structure

```
gamification-platform/
├── src/
│   ├── App.tsx                              # Router and top-level layout
│   ├── main.tsx                             # React root mount
│   ├── index.css                            # Tailwind directives and global styles
│   ├── vite-env.d.ts                        # Vite client type declarations
│   │
│   ├── types/
│   │   └── index.ts                         # All TypeScript interfaces and type aliases
│   │
│   ├── lib/
│   │   ├── supabase.ts                      # Supabase client singleton
│   │   └── utils.ts                         # slugify(), cn() utilities
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx                   # AuthProvider + useAuth hook
│   │
│   ├── hooks/
│   │   ├── useCountUp.ts                    # Animated number counter
│   │   └── useSound.ts                      # Web Audio API sound effects
│   │
│   ├── pages/
│   │   ├── Landing.tsx                      # Public landing page
│   │   ├── Login.tsx                        # Email/password login
│   │   ├── Register.tsx                     # Email/password registration
│   │   └── Dashboard.tsx                    # Main admin dashboard (protected)
│   │
│   └── components/
│       ├── ProtectedRoute.tsx               # Redirects unauthenticated to /login
│       ├── AuthRedirect.tsx                 # Redirects authenticated to /dashboard
│       │
│       ├── ui/                              # Reusable, domain-agnostic UI primitives
│       │   ├── Button.tsx
│       │   ├── Input.tsx
│       │   ├── Card.tsx
│       │   ├── Modal.tsx
│       │   ├── Badge.tsx
│       │   ├── ColorPicker.tsx
│       │   └── EmptyState.tsx
│       │
│       ├── dashboard/                       # Event management
│       │   ├── DashboardTabs.tsx
│       │   ├── EventForm.tsx
│       │   ├── EventSection.tsx
│       │   └── EventDetails.tsx
│       │
│       ├── participants/                    # Participant CRUD
│       │   ├── ParticipantList.tsx
│       │   ├── ParticipantForm.tsx
│       │   └── ParticipantRow.tsx
│       │
│       ├── groups/                          # Group CRUD + assignments
│       │   ├── GroupList.tsx
│       │   ├── GroupForm.tsx
│       │   ├── GroupCard.tsx
│       │   └── GroupAssignment.tsx
│       │
│       ├── actions/                         # Action CRUD
│       │   ├── ActionList.tsx
│       │   ├── ActionForm.tsx
│       │   └── ActionRow.tsx
│       │
│       ├── scoring/                         # Score entry + transaction log
│       │   ├── ScoreEntry.tsx
│       │   └── TransactionRow.tsx
│       │
│       └── leaderboard/                     # Leaderboard display
│           ├── LeaderboardSection.tsx
│           ├── LeaderboardPodium.tsx
│           ├── LeaderboardTable.tsx
│           ├── LeaderboardRow.tsx
│           ├── PodiumPlace.tsx
│           ├── LeaderboardToggle.tsx
│           ├── LeaderboardEmptyState.tsx
│           └── SoundToggle.tsx
│
├── supabase/
│   └── migrations/
│       ├── 001_create_events.sql
│       ├── 002_create_groups_participants.sql
│       ├── 003_create_actions_transactions.sql
│       ├── 004_create_leaderboard_functions.sql
│       └── 005_auto_codes_remove_email.sql
│
├── index.html                               # SPA entry point
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                           # Path alias: @ -> ./src
├── tailwind.config.js                       # Custom animations: fade-in-up, scale-in
├── postcss.config.js
├── vercel.json                              # SPA rewrite: all routes -> /index.html
└── .env                                     # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## Database Schema

### Entity Relationship Diagram

```
auth.users
│
├──(1:1)── events
│           │
│           ├──(1:N)── groups ──(M:N via participant_groups)── participants
│           │
│           ├──(1:N)── participants
│           │              │
│           │              └──(1:N)── point_transactions
│           │
│           └──(1:N)── actions
│                          │
│                          └──(1:N)── point_transactions
│
└──(1:N)── point_transactions.created_by
```

### Table Definitions

**`events`**
```
id              UUID        PK, auto-generated
owner_admin_id  UUID        FK -> auth.users(id), UNIQUE, NOT NULL
name            TEXT        NOT NULL
slug            TEXT        UNIQUE, NOT NULL
logo_url        TEXT        nullable
theme_color     TEXT        NOT NULL, DEFAULT '#6366f1'
status          event_status NOT NULL, DEFAULT 'draft'
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL, DEFAULT now()
```

**`groups`**
```
id              UUID        PK, auto-generated
event_id        UUID        FK -> events(id) CASCADE, NOT NULL
name            TEXT        NOT NULL
color           TEXT        NOT NULL, DEFAULT '#6366f1', CHECK hex format
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL, DEFAULT now()

UNIQUE(event_id, name)
```

**`participants`**
```
id              UUID        PK, auto-generated
event_id        UUID        FK -> events(id) CASCADE, NOT NULL
external_id     TEXT        NOT NULL (auto-generated: P-XXXX)
name            TEXT        NOT NULL
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL, DEFAULT now()

UNIQUE(event_id, external_id)
```

**`participant_groups`**
```
participant_id  UUID        FK -> participants(id) CASCADE, NOT NULL
group_id        UUID        FK -> groups(id) CASCADE, NOT NULL
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()

PK(participant_id, group_id)
```

**`actions`**
```
id              UUID        PK, auto-generated
event_id        UUID        FK -> events(id) CASCADE, NOT NULL
code            TEXT        NOT NULL (auto-generated: A-XXXX)
name            TEXT        NOT NULL
points          INTEGER     NOT NULL
description     TEXT        nullable
is_active       BOOLEAN     NOT NULL, DEFAULT true
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL, DEFAULT now()

UNIQUE(event_id, code)
```

**`point_transactions`**
```
id              UUID        PK, auto-generated
event_id        UUID        FK -> events(id) CASCADE, NOT NULL
participant_id  UUID        FK -> participants(id) CASCADE, NOT NULL
action_id       UUID        FK -> actions(id) CASCADE, NOT NULL
points          INTEGER     NOT NULL
created_by      UUID        FK -> auth.users(id), NOT NULL
created_at      TIMESTAMPTZ NOT NULL, DEFAULT now()

IMMUTABLE: triggers block UPDATE and DELETE
```

### Database Triggers

| Trigger | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `events_updated_at` | events | BEFORE UPDATE | `update_updated_at()` | Auto-set `updated_at` |
| `groups_updated_at` | groups | BEFORE UPDATE | `update_updated_at()` | Auto-set `updated_at` |
| `participants_updated_at` | participants | BEFORE UPDATE | `update_updated_at()` | Auto-set `updated_at` |
| `actions_updated_at` | actions | BEFORE UPDATE | `update_updated_at()` | Auto-set `updated_at` |
| `participants_auto_code` | participants | BEFORE INSERT | `generate_participant_code()` | Auto-generate `P-XXXX` code |
| `actions_auto_code` | actions | BEFORE INSERT | `generate_action_code()` | Auto-generate `A-XXXX` code |
| `participant_groups_same_event` | participant_groups | BEFORE INSERT | `check_participant_group_same_event()` | Validate same event |
| `point_transactions_same_event` | point_transactions | BEFORE INSERT | `check_transaction_same_event()` | Validate same event |
| `point_transactions_no_update` | point_transactions | BEFORE UPDATE | `prevent_point_transaction_update()` | Block modifications |
| `point_transactions_no_delete` | point_transactions | BEFORE DELETE | `prevent_point_transaction_delete()` | Block deletions |

### Database Indexes

| Index | Table | Columns | Type |
|---|---|---|---|
| `idx_events_owner` | events | `owner_admin_id` | UNIQUE |
| `idx_events_slug` | events | `slug` | UNIQUE |
| `idx_groups_event_name` | groups | `(event_id, name)` | UNIQUE |
| `idx_groups_event_id` | groups | `event_id` | Regular |
| `idx_participants_event_external_id` | participants | `(event_id, external_id)` | UNIQUE |
| `idx_participants_event_id` | participants | `event_id` | Regular |
| `idx_participant_groups_group_id` | participant_groups | `group_id` | Regular |
| `idx_actions_event_code` | actions | `(event_id, code)` | UNIQUE |
| `idx_actions_event_id` | actions | `event_id` | Regular |
| `idx_point_transactions_event_created` | point_transactions | `(event_id, created_at DESC)` | Regular |
| `idx_point_transactions_event_participant` | point_transactions | `(event_id, participant_id)` | Regular |

## Authentication Flow

```
                    ┌─────────────────────┐
                    │   Supabase Auth      │
                    │   (auth.users)       │
                    └────────┬────────────┘
                             │
               signUp / signInWithPassword / signOut
                             │
                    ┌────────▼────────────┐
                    │   Supabase JS SDK    │
                    │   (src/lib/supabase) │
                    └────────┬────────────┘
                             │
                   stores tokens in localStorage
                             │
                    ┌────────▼────────────┐
                    │   AuthContext        │
                    │   user | loading     │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌─────▼──────┐
     │ Protected  │  │  Auth      │  │ Dashboard  │
     │ Route      │  │  Redirect  │  │ (user.id)  │
     └────────────┘  └────────────┘  └────────────┘
```

### Startup Sequence

1. `AuthProvider` mounts.
2. `supabase.auth.getSession()` reads tokens from localStorage.
3. If tokens are valid (or refreshable), `user` is set. Otherwise `user` is `null`.
4. `loading` is set to `false`.
5. `onAuthStateChange` subscription keeps `user` in sync for the lifetime of the app.

### Sign Up

1. `Register.tsx` validates fields (email, password >= 6 chars, passwords match).
2. Calls `supabase.auth.signUp({ email, password })`.
3. Supabase creates row in `auth.users`, returns session.
4. `onAuthStateChange` fires `SIGNED_IN`, sets `user`.
5. `navigate('/dashboard')`.

### Sign In

1. `Login.tsx` validates fields (both non-empty).
2. Calls `supabase.auth.signInWithPassword({ email, password })`.
3. Supabase verifies bcrypt hash, returns session.
4. `onAuthStateChange` fires `SIGNED_IN`, sets `user`.
5. `navigate('/dashboard')`.

### Sign Out

1. Dashboard header "Log Out" button calls `supabase.auth.signOut()`.
2. Supabase revokes refresh token, SDK clears localStorage.
3. `onAuthStateChange` fires `SIGNED_OUT`, sets `user` to `null`.
4. `ProtectedRoute` detects `!user`, redirects to `/login`.

### Token Management

- **Storage:** localStorage (key: `sb-<project-ref>-auth-token`)
- **Access token:** JWT with `sub` (user UUID), expiration (default 1 hour)
- **Refresh token:** Opaque, used to obtain new access tokens
- **Auto-refresh:** Handled transparently by the Supabase JS client

## Data Flow

### Score Entry (the core transaction flow)

```
Admin enters:
  Participant Code: "P-1001"
  Action Code: "A-1003"
         │
         ▼
ScoreEntry.tsx
  1. SELECT participants WHERE event_id = X AND external_id = 'P-1001'
     → returns { id, name }
  2. SELECT actions WHERE event_id = X AND code = 'A-1003'
     → returns { id, name, code, points, is_active }
  3. Validate: participant exists? action exists? action active?
  4. INSERT point_transactions { event_id, participant_id, action_id, points, created_by }
     → trigger validates same-event constraint
  5. Refetch recent 20 transactions (joined with participant + action names)
         │
         ▼
  Success: "Awarded +10 points to Jane Doe for Complete a Quiz"
```

### Leaderboard Computation

```
LeaderboardSection.tsx
  │
  ├─ supabase.rpc('get_participant_leaderboard')
  │     → Function resolves event via auth.uid()
  │     → LEFT JOIN participants ← point_transactions
  │     → SUM(points), GROUP BY participant
  │     → ORDER BY total_points DESC, name ASC
  │
  └─ supabase.rpc('get_group_leaderboard')
        → Function resolves event via auth.uid()
        → LEFT JOIN groups ← participant_groups ← point_transactions
        → SUM(points), GROUP BY group
        → ORDER BY total_points DESC, name ASC
         │
         ▼
  Client-side: computeRanks() assigns dense ranks
  Split into: podium (rank <= 3) + table (rank > 3)
```

### Event Data Loading

```
Dashboard.tsx mounts
  │
  ├─ useAuth() → user.id
  │
  └─ SELECT events WHERE owner_admin_id = user.id
       │
       ├─ null → show EventForm (creation)
       │
       └─ event → show DashboardTabs
            │
            ├─ Event tab      → EventSection (view/edit event)
            ├─ Participants   → ParticipantList (CRUD + group assignment)
            ├─ Groups         → GroupList (CRUD)
            ├─ Actions        → ActionList (CRUD + toggle active)
            ├─ Score          → ScoreEntry (submit scores)
            └─ Leaderboards   → LeaderboardSection (ranked display)
```

## Key Components

### Route Guards

| Component | Route(s) | Behavior |
|---|---|---|
| `ProtectedRoute` | `/dashboard` | If not authenticated → redirect to `/login`. Shows spinner while loading. |
| `AuthRedirect` | `/`, `/login`, `/register` | If authenticated → redirect to `/dashboard`. Shows spinner while loading. |

### Dashboard Tabs

The dashboard is a single page with 6 tabs, each rendering a different feature component. Tab state is managed in `Dashboard.tsx` via `activeTab` state. Participant, group, and action counts are passed up via callbacks and shown as badges on the tab buttons.

| Tab | Component | Data Source |
|---|---|---|
| Event | `EventSection` | `events` table |
| Participants | `ParticipantList` | `participants` + `participant_groups` + `groups` |
| Groups | `GroupList` | `groups` + `participant_groups(count)` |
| Actions | `ActionList` | `actions` table |
| Score | `ScoreEntry` | `participants`, `actions`, `point_transactions` |
| Leaderboards | `LeaderboardSection` | RPC functions |

### UI Primitives

All in `src/components/ui/`. These are stateless (or internally-stated) presentational components with no Supabase dependencies:

- **`Button`** — 5 variants (primary, secondary, outline, ghost, danger), 3 sizes, loading spinner
- **`Input`** — Labeled input with error state, forwarded ref
- **`Card`** — Bordered container, forwarded ref
- **`Modal`** — Portal-rendered, Escape to close, backdrop click to close, body scroll lock
- **`Badge`** — Colored pill with semi-transparent background
- **`ColorPicker`** — 8 preset colors + custom hex input
- **`EmptyState`** — Centered placeholder with icon, title, description, action

## Key Hooks

| Hook | File | Purpose |
|---|---|---|
| `useAuth()` | `src/contexts/AuthContext.tsx` | Access auth state (`user`, `loading`) and methods (`signUp`, `signIn`, `signOut`). Must be used within `AuthProvider`. |
| `useCountUp(target, duration?)` | `src/hooks/useCountUp.ts` | Animates a number from 0 to `target` over `duration` ms (default 1200). Cubic ease-out. Returns current value. Used in leaderboard podium. |
| `useSound()` | `src/hooks/useSound.ts` | Web Audio API sound player. Returns `{ play, muted, toggleMute }`. Generates ascending chord (C5-E5-G5). Mute state persisted in localStorage. Used in leaderboard. |

## RPC Functions

| Function | Parameters | Returns | Security | Purpose |
|---|---|---|---|---|
| `get_participant_leaderboard()` | None | `(participant_id, participant_name, external_id, total_points)[]` | SECURITY INVOKER | Ranked participant leaderboard. Resolves event via `auth.uid()`. |
| `get_group_leaderboard()` | None | `(group_id, group_name, group_color, total_points)[]` | SECURITY INVOKER | Ranked group leaderboard. Resolves event via `auth.uid()`. |

Both functions:
- Accept no event_id parameter — they determine the admin's event via `WHERE owner_admin_id = auth.uid()`.
- Use `SECURITY INVOKER` to keep RLS active.
- Are marked `STABLE` (no side effects, safe for read replicas).
- Return empty result set if no event exists for the calling user.
- Compute totals live from `point_transactions` — no stored/cached scores.

## RLS Policies

All policies follow the same pattern: the admin can only access rows belonging to their own event. The ownership chain is:

```
Row → event_id → events.owner_admin_id → auth.uid()
```

### events

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event | `auth.uid() = owner_admin_id` |
| INSERT | Admins can create own event | `auth.uid() = owner_admin_id` |
| UPDATE | Admins can update own event | `auth.uid() = owner_admin_id` (USING + WITH CHECK) |
| DELETE | *No policy* | Denied by default |

### groups

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event groups | `event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())` |
| INSERT | Admins can create groups for own event | Same check |
| UPDATE | Admins can update own event groups | Same check (USING + WITH CHECK) |
| DELETE | Admins can delete own event groups | Same check |

### participants

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event participants | `event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())` |
| INSERT | Admins can create participants for own event | Same check |
| UPDATE | Admins can update own event participants | Same check (USING + WITH CHECK) |
| DELETE | Admins can delete own event participants | Same check |

### participant_groups

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event assignments | `participant_id IN (SELECT id FROM participants WHERE event_id IN (...))` |
| INSERT | Admins can create assignments for own event | Same check |
| UPDATE | *No policy* | Denied by default |
| DELETE | Admins can delete own event assignments | Same check |

### actions

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event actions | `event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())` |
| INSERT | Admins can create actions for own event | Same check |
| UPDATE | Admins can update own event actions | Same check (USING + WITH CHECK) |
| DELETE | *No policy* | Denied by default |

### point_transactions

| Operation | Policy | Condition |
|---|---|---|
| SELECT | Admins can view own event transactions | `event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())` |
| INSERT | Admins can create transactions for own event | Same check |
| UPDATE | *No policy* | Additionally blocked by immutability trigger |
| DELETE | *No policy* | Additionally blocked by immutability trigger |

### Summary of Denied Operations

| Table | Denied Operation | Enforcement |
|---|---|---|
| events | DELETE | No RLS policy (default deny) |
| participant_groups | UPDATE | No RLS policy (default deny) |
| actions | DELETE | No RLS policy (default deny) |
| point_transactions | UPDATE | No RLS policy + trigger |
| point_transactions | DELETE | No RLS policy + trigger |
