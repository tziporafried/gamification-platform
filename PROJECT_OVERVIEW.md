# Project Overview

## Product Purpose

The Gamification Platform is a web application that allows event administrators to create interactive, points-based competitions for live events. An admin creates a single event, registers participants, defines scoring actions, and records point transactions in real time. Participants are ranked on a live leaderboard.

The platform is designed for scenarios such as conferences, workshops, hackathons, or classroom activities where engagement is driven by awarding points for completed tasks.

## User Roles

The system has a single user role: **Admin**.

- Every authenticated user is an admin.
- There is no role column, no roles table, and no role-based access control.
- Each admin can own exactly one event (enforced by a UNIQUE constraint on `events.owner_admin_id`).
- There are no participant-facing accounts. Participants do not log in. They are records managed by the admin.
- Authorization is enforced entirely through Supabase Row Level Security (RLS). Every RLS policy checks that `event.owner_admin_id = auth.uid()`.

## Main Workflows

### 1. Event Setup
Admin registers, logs in, and creates a single event with a name, slug, theme color, and optional logo.

### 2. Participant Management
Admin adds participants by name. The system auto-generates a unique participant code (format: `P-1001`, `P-1002`, ...). Participants can be edited (name only), deleted, and assigned to groups.

### 3. Group Management
Admin creates groups with a name and color. Participants can belong to multiple groups. Group membership is managed through a toggle interface.

### 4. Action Definition
Admin defines scoring actions with a name, point value, and optional description. The system auto-generates a unique action code (format: `A-1001`, `A-1002`, ...). Actions can be activated or deactivated.

### 5. Score Entry
Admin enters a participant code and an action code. The system validates both exist and that the action is active, then records an immutable point transaction. Recent transactions are displayed below the form.

### 6. Leaderboard
Live-computed leaderboard showing participant rankings and group rankings. Top 3 are displayed on a podium with animated point counters. Ranks 4+ are shown in a table. Sound effects can be toggled on/off.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.5.4 |
| Build Tool | Vite | 5.4.2 |
| Styling | Tailwind CSS | 3.4.10 |
| Routing | React Router DOM | 6.26.2 |
| Backend / Auth | Supabase (JS SDK) | 2.45.4 |
| Database | PostgreSQL (via Supabase) | Managed |
| Deployment | Vercel | SPA rewrite config |

There is no custom backend server, no API routes, no middleware, and no server-side rendering. The application is a single-page app that communicates directly with Supabase.

### Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) API key |

### Build & Deploy

- **Dev:** `npm run dev` (Vite dev server)
- **Build:** `npm run build` (`tsc -b && vite build`)
- **Output:** `dist/` directory
- **Deployment:** Vercel with SPA rewrite (`vercel.json` rewrites all routes to `index.html`)

## Database Overview

The database consists of 5 application tables plus Supabase's managed `auth.users` table.

```
auth.users (Supabase-managed)
    |
    |-- 1:1 --> events (one event per admin)
                    |
                    |-- 1:N --> participants
                    |               |
                    |               |-- M:N --> participant_groups --> groups
                    |               |
                    |               |-- 1:N --> point_transactions
                    |
                    |-- 1:N --> actions
                    |               |
                    |               |-- 1:N --> point_transactions
                    |
                    |-- 1:N --> groups
```

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed authentication. Stores admin credentials. |
| `events` | One event per admin. Holds name, slug, theme, status, logo. |
| `participants` | Event participants. Auto-generated code (`P-XXXX`), name. |
| `groups` | Named groups with a color. Participants can belong to multiple groups. |
| `participant_groups` | Junction table linking participants to groups. |
| `actions` | Scoring rules. Auto-generated code (`A-XXXX`), name, point value, active flag. |
| `point_transactions` | Immutable audit log of awarded points. Cannot be updated or deleted. |

Two RPC functions (`get_participant_leaderboard`, `get_group_leaderboard`) compute rankings live from `point_transactions` without stored totals.

All tables use UUID primary keys and have RLS enabled. Every policy scopes access to the admin's own event.
