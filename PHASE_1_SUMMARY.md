# Phase 1 Summary: Authentication + Event Management

## What Was Implemented

Phase 1 established the application foundation: project scaffolding, Supabase client initialization, email/password authentication, protected routing, and the ability for an admin to create and manage a single event.

## Database Changes

### Migration: `001_create_events.sql`

**Enum created:**
- `event_status` with values: `draft`, `active`, `finished`, `archived`

**Table created: `events`**

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY, auto-generated |
| `owner_admin_id` | UUID | NOT NULL, FK to `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | NOT NULL |
| `slug` | TEXT | NOT NULL |
| `logo_url` | TEXT | Nullable |
| `theme_color` | TEXT | NOT NULL, DEFAULT `'#6366f1'` |
| `status` | `event_status` | NOT NULL, DEFAULT `'draft'` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` |

**Indexes:**
- `idx_events_owner` — UNIQUE on `owner_admin_id`. Enforces one event per admin.
- `idx_events_slug` — UNIQUE on `slug`. Enforces globally unique slugs.

**Functions:**
- `update_updated_at()` — Generic trigger function that sets `NEW.updated_at = now()`. Reused by later phases.

**Triggers:**
- `events_updated_at` — Calls `update_updated_at()` BEFORE UPDATE on `events`.

**RLS Policies (on `events`):**
- `Admins can view own event` — SELECT where `auth.uid() = owner_admin_id`
- `Admins can create own event` — INSERT where `auth.uid() = owner_admin_id`
- `Admins can update own event` — UPDATE where `auth.uid() = owner_admin_id`
- No DELETE policy exists. Event deletion is denied by default.

**Storage (commented out in migration, manual setup):**
- Bucket: `event-logos` (public)
- Policies for authenticated upload, owner update, and public read

## UI Pages

### Landing Page (`src/pages/Landing.tsx`)
- Hero section with logo, title, description
- Two CTAs: "Log In" (to `/login`) and "Get Started" (to `/register`)
- Gradient background

### Login Page (`src/pages/Login.tsx`)
- Email and password fields
- Calls `useAuth().signIn(email, password)`
- Client-side validation: both fields required
- On success: navigates to `/dashboard`
- On error: displays Supabase error message
- Link to registration page

### Register Page (`src/pages/Register.tsx`)
- Email, password, and confirm password fields
- Calls `useAuth().signUp(email, password)`
- Client-side validation: all fields required, password >= 6 characters, passwords must match
- On success: navigates to `/dashboard`
- On error: displays Supabase error message
- Link to login page

### Dashboard Page (`src/pages/Dashboard.tsx`)
- Protected by `ProtectedRoute` — redirects to `/login` if unauthenticated
- Header with admin email and "Log Out" button
- On load: queries `events` table for the current admin's event
- If no event exists: shows `EventForm` for creation
- If event exists: shows tabbed dashboard interface

## Components

### Auth Components
- **`AuthContext`** (`src/contexts/AuthContext.tsx`) — React context providing `user`, `loading`, `signUp`, `signIn`, `signOut`. Initializes session from Supabase on mount. Subscribes to `onAuthStateChange`.
- **`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`) — Renders children if authenticated, redirects to `/login` if not. Shows spinner while loading.
- **`AuthRedirect`** (`src/components/AuthRedirect.tsx`) — Redirects authenticated users to `/dashboard`. Used on `/`, `/login`, `/register`.

### Event Components
- **`EventForm`** (`src/components/dashboard/EventForm.tsx`) — Create/edit form for events. Fields: name, slug (auto-generated from name unless manually edited), theme color (via `ColorPicker`), logo upload, status (edit mode only). Logo uploads to Supabase Storage bucket `event-logos`. Detects duplicate slug (error code `23505`). Detects duplicate event per admin.
- **`EventSection`** (`src/components/dashboard/EventSection.tsx`) — Toggles between `EventDetails` (view) and `EventForm` (edit).
- **`EventDetails`** (`src/components/dashboard/EventDetails.tsx`) — Displays event card with colored top bar, logo or initials avatar, name, slug, status badge, theme color swatch, creation date, and edit button.
- **`DashboardTabs`** (`src/components/dashboard/DashboardTabs.tsx`) — Tab navigation bar. Tabs: Event, Participants, Groups, Actions, Score, Leaderboards. Shows count badges for participants, groups, and actions.

### UI Components (all created in Phase 1)
- **`Button`** — Variants: primary, secondary, outline, ghost, danger. Sizes: sm, md, lg. Loading state with spinner.
- **`Input`** — Labeled input with optional error text. Forwarded ref.
- **`Card`** — Bordered container with shadow. Forwarded ref.
- **`Modal`** — Portal-rendered dialog. Backdrop click and Escape key to close. Body scroll lock.
- **`Badge`** — Colored label with hex color background at 20% opacity.
- **`ColorPicker`** — 8 preset colors + custom hex input.
- **`EmptyState`** — Dashed border container with icon, title, description, and optional action.

### Utilities
- **`supabase.ts`** (`src/lib/supabase.ts`) — Initializes Supabase client from environment variables.
- **`utils.ts`** (`src/lib/utils.ts`) — `slugify()` for URL-safe slug generation. `cn()` for conditional class name joining.

## APIs / Supabase Queries

| Operation | Table | Method | Details |
|---|---|---|---|
| Fetch admin's event | `events` | SELECT | `.eq('owner_admin_id', user.id).maybeSingle()` |
| Create event | `events` | INSERT | Includes `owner_admin_id`, name, slug, theme_color, status, logo_url |
| Update event | `events` | UPDATE | Name, slug, theme_color, status, logo_url |
| Upload logo | `storage.event-logos` | upload | Path: `{userId}/logo.{ext}`, upsert: true |
| Get logo URL | `storage.event-logos` | getPublicUrl | Returns public URL |
| Sign up | `auth` | signUp | Email + password |
| Sign in | `auth` | signInWithPassword | Email + password |
| Sign out | `auth` | signOut | Revokes refresh token |
| Get session | `auth` | getSession | Reads from localStorage |

## Business Rules

1. **One event per admin.** Enforced by UNIQUE index on `events.owner_admin_id`. The UI shows "You already have an event" if the constraint is violated.
2. **Unique slugs.** Enforced by UNIQUE index on `events.slug`. The UI detects `23505` errors on slug.
3. **Auto-slug generation.** Slug auto-derives from the event name as the admin types, unless the slug field is manually edited.
4. **Event statuses.** Four statuses exist (`draft`, `active`, `finished`, `archived`). The status dropdown is only shown in edit mode. Status defaults to `draft` on creation.
5. **No event deletion.** No DELETE RLS policy exists on the `events` table. Event deletion is not possible via the client.
6. **Session persistence.** Tokens are stored in localStorage by the Supabase client. Sessions survive page refresh via `getSession()`.
7. **Route protection.** Unauthenticated users cannot access `/dashboard`. Authenticated users are redirected away from `/`, `/login`, `/register`.

## What Is Not Implemented

- No password reset / forgot password flow.
- No email confirmation handling in the UI. Whether email confirmation is required depends on Supabase project settings.
- No OAuth or social login.
- No admin profile or settings page.
- No event deletion.
