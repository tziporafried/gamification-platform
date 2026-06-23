# Gamification Platform — Product Requirements Document

## Overview

A **React 18 + TypeScript SPA** (Vite) that connects directly to **Supabase** (PostgreSQL + Auth + Storage). No custom backend — all data access via Supabase JS client with Row Level Security (RLS). The UI is **Hebrew RTL**, styled with Tailwind CSS, deployed to Vercel.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (PostgREST + Auth + Storage) — no custom server |
| Database | PostgreSQL (via Supabase) |
| Auth | Supabase Auth (email/password) |
| Deploy | Vercel (static SPA) |
| Font | Heebo (Hebrew) |

---

## Data Model

### Entity Relationship

```
auth.users (Supabase-managed)
    │
    └── events (1:1, one event per admin)
            │
            ├── groups ──(M:N via participant_groups)── participants
            │       │
            │       └──(M:N via reward_groups)── rewards
            │
            ├── participants
            │       ├── point_transactions
            │       └── participant_rewards
            │
            ├── actions ── point_transactions
            │
            └── rewards
```

### Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| **events** | `owner_admin_id`, `name`, `slug`, `logo_url`, `theme_color`, `status`, `qr_scoring_mode` | Status: `draft\|active\|finished\|archived`; QR mode: `combined\|separate` |
| **participants** | `event_id`, `external_id` (P-XXXX auto), `name` | Auto-generated codes via trigger |
| **groups** | `event_id`, `name`, `color` (hex) | UNIQUE(event_id, name) |
| **participant_groups** | `participant_id`, `group_id` | M:N junction |
| **actions** | `event_id`, `code` (A-XXXX auto), `name`, `points`, `is_active` | Scoring rules/tasks |
| **point_transactions** | `event_id`, `participant_id`, `action_id`, `points`, `created_by` | **Immutable** — no UPDATE/DELETE |
| **rewards** | `event_id`, `name`, `required_points`, `is_active` | Threshold-based unlocks |
| **reward_groups** | `reward_id`, `group_id` | Empty = global reward |
| **participant_rewards** | `participant_id`, `reward_id`, `score_at_award` | UNIQUE(participant_id, reward_id) |

### RPC Functions

| Function | Purpose |
|----------|---------|
| `get_participant_leaderboard()` | Live SUM from point_transactions, ranked |
| `get_group_leaderboard()` | Aggregate member points per group |
| `check_and_award_rewards(p_participant_id)` | Auto-award eligible rewards after scoring |

---

## Authentication & Authorization

- **Single role: Admin** — every authenticated user is an admin
- **One event per admin** (enforced by unique index)
- **No participant login** — participants are data records
- **RLS on all tables** — checks `owner_admin_id = auth.uid()`
- **Route guards:** `ProtectedRoute` (unauthenticated → `/login`), `AuthRedirect` (authenticated → `/dashboard`)

---

## Views / Pages

### Routes

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | Landing | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard (tab-based) | Yes |

### Dashboard Tabs

| Tab | Feature | Key Operations |
|-----|---------|---------------|
| **Home** (בית) | Stats, top-10 leaderboard, quick score, recent activity/rewards | Read-only overview |
| **Event** (אירוע) | View/edit event settings, logo upload | UPDATE event |
| **Participants** (משתתפים) | CRUD + CSV import + group assignment | Full CRUD |
| **Groups** (קבוצות) | CRUD groups with color | Full CRUD |
| **Actions** (פעולות) | CRUD + CSV import + toggle active | Full CRUD |
| **Rewards** (פרסים) | CRUD + group eligibility + toggle active | Full CRUD |
| **Score** (ניקוד) | Manual/QR score entry + transaction log | INSERT transactions |
| **QR Cards** (כרטיסי QR) | Generate/print QR cards for participants/actions | Read + print |
| **Leaderboard** (לוח תוצאות) | Animated podium reveal (participants/groups) | Read + animation |

---

## Gamification Logic

### Points System

- Admins define **Actions** with point values
- Score submission: participant code + action code → immutable `point_transaction`
- After each score, `check_and_award_rewards` RPC runs automatically

### Rewards

- **Threshold-based** — awarded when participant reaches `required_points`
- Can be scoped to specific groups via `reward_groups` (empty = global)
- Auto-awarded, no duplicates (unique constraint)
- Celebration modal + animations on award

### Leaderboards

- **Computed live** from transactions (no cached totals)
- Participant leaderboard: SUM(points), tie-break by name
- Group leaderboard: aggregate all members' points
- Animated podium (top 3), reveal sequence, sound effects

### QR Scoring

- Two modes: `combined` (participant+action in one scan) or `separate` (two scans)
- QR card generator with filtering and print layout

---

## What's NOT Implemented

- Badges / achievements system
- Time-bound challenges
- Participant-facing app/portal (no participant login)
- Real-time WebSocket updates (leaderboard fetched on demand)
- Stored/cached score totals
- Multi-event per admin
- RBAC / multiple roles
- Docker / CI/CD config
- Test suite

---

## Layout & UI

### Desktop
- Sidebar navigation (9 items) + main content area

### Mobile
- Bottom tab bar (4 primary tabs) + "More" drawer for secondary tabs

### UI Components

| Category | Components |
|----------|-----------|
| Primitives | Button, Input, Card, Modal, Badge, Toast |
| Gamification | RankBadge, XPBar, StatCard, PointsFlyUp, AnimatedCounter, PodiumPlace |
| Data Display | AvatarCircle, ColorPicker, EmptyState |

### Gamification UI Features
- Podium places with medals/crown
- Confetti/celebration animations
- Sound effects toggle
- Count-up number animations
- Reveal sequence for leaderboard

---

## Technical Details

### Dependencies

```json
{
  "@supabase/supabase-js": "^2.45.4",
  "date-fns": "^4.4.0",
  "html5-qrcode": "^2.3.8",
  "lucide-react": "^1.21.0",
  "qrcode.react": "^4.2.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2"
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Build & Deploy

- **Dev:** `npm run dev`
- **Build:** `tsc -b && vite build` → `dist/`
- **Deploy:** Vercel with SPA rewrite

### Path Alias
- `@` → `./src`

---

## Database Migrations

| Migration | Purpose |
|-----------|---------|
| `001_create_events.sql` | `events` table, status enum, RLS, `update_updated_at()` trigger |
| `002_create_groups_participants.sql` | `groups`, `participants`, `participant_groups`, RLS |
| `002_add_qr_scoring_mode.sql` | Adds `qr_scoring_mode` column to events |
| `003_create_actions_transactions.sql` | `actions`, `point_transactions`, immutability triggers |
| `004_create_leaderboard_functions.sql` | RPC functions for leaderboards |
| `005_auto_codes_remove_email.sql` | Auto-generate P-XXXX/A-XXXX codes; drop email column |
| `006_create_rewards.sql` | `rewards`, `reward_groups`, `participant_rewards`, `check_and_award_rewards` RPC |

---

## Security

- **Immutable audit trail:** `point_transactions` cannot be modified or deleted (DB triggers)
- **RLS enforced on all tables:** Admin can only access their own event data
- **No direct DB access from participants**
- **Single-tenant per admin:** Complete data isolation via RLS
- **Denied operations (by design):** Delete events, delete/update actions, update/delete point_transactions
