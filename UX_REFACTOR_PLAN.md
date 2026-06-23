# UX Refactor Plan – Event Setup Wizard

## Scope

**Presentation-layer refactor only.**

- No database schema changes
- No migrations
- No new columns
- No wizard status persistence in DB
- No display tokens
- No relationship modifications

All wizard state is managed client-side (React state + localStorage for persistence).
The existing data model is reused as-is.

Any schema changes will be proposed and approved separately.

## Summary

Convert the current admin dashboard (9-tab navigation) into a guided wizard experience targeting non-technical users (parents, camp counselors, retreat organizers).

---

## 1. Proposed New Navigation Structure

### Before (Current)

```
Login → Dashboard (single event, 9 tabs)
├── Home
├── Leaderboard
├── Score
├── Participants
├── Actions
├── Rewards
├── Groups
├── QR Cards
└── Event Settings
```

### After (New)

```
Login → My Events (multi-event list)
              │
              └── Event Wizard / Control Center
                    ├── Step 1: Event Details
                    ├── Step 2: Participants
                    ├── Step 3: Groups (optional)
                    ├── Step 4: Tasks
                    ├── Step 5: Generate Cards
                    └── Step 6: Control Center
                              ├── Start Event
                              ├── Scan Mode
                              ├── Display Screen
                              └── Export Results
```

### Navigation Removed from Primary UI

| Removed Item | Where It Moves |
|---|---|
| Home (dashboard) | Replaced by "My Events" list |
| Leaderboard | Accessed via "Display Screen" in Control Center |
| Score | Accessed via "Scan Mode" in Control Center |
| Actions | Renamed to "Tasks" — Step 4 in wizard |
| Rewards | Kept as internal logic; no dedicated nav item (auto-awards stay, UI simplified) |

### Top-Level Navigation (Post-Login)

```
┌─────────────────────────────────────┐
│  Header: Logo + User Name + Logout  │
├─────────────────────────────────────┤
│  My Events                          │
│  ┌───────────┐ ┌───────────┐       │
│  │ Event A   │ │ Event B   │       │
│  │ 24 people │ │ Draft     │       │
│  └───────────┘ └───────────┘       │
│                                     │
│  [+ Create New Event]               │
└─────────────────────────────────────┘
```

### Inside an Event (Wizard + Progress Tracker)

```
┌──────────────────────────────────────────────┐
│  ← Back to Events    "Family Vacation 2026"  │
├──────────────────────────────────────────────┤
│  Progress Bar:                               │
│  [✓ Details] [✓ People] [○ Groups]           │
│  [○ Tasks] [○ Review & Generate] [○ Start!]  │
├──────────────────────────────────────────────┤
│                                              │
│  Current Step Content                        │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 2. Updated Route Structure

### Current Routes

| Route | Component |
|-------|-----------|
| `/` | Landing |
| `/login` | Login |
| `/register` | Register |
| `/dashboard` | Dashboard (single page, tab-based) |

### New Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Landing | Public marketing page |
| `/login` | Login | Auth |
| `/register` | Register | Auth |
| `/events` | MyEvents | Event list + create button |
| `/events/new` | EventWizard (step 1) | Create new event |
| `/events/:id` | EventWizard | Wizard with step navigation |
| `/events/:id/step/:step` | EventWizard | Deep link to specific step (1-5) |
| `/events/:id/control` | ControlCenter | Post-setup operational area |
| `/events/:id/scan` | ScanMode | Full-screen scoring (from Control Center) |
| `/events/:id/display` | DisplayScreen | Projector-friendly leaderboard |
| `/events/:id/export` | ExportResults | Export/download results |

### Route Details

- `/events` — Protected. Shows all events for current user.
- `/events/:id` — Redirects to current wizard step (based on event progress state).
- `/events/:id/step/1` through `/events/:id/step/5` — Direct access to any setup step.
- `/events/:id/control` — Post-setup operational area. Unlocked when readiness validation passes.
- `/events/:id/scan` — Full-screen scan mode during event operation.
- `/events/:id/display` — Designed to be projected on a screen during the event.

### Auth Redirects

- Unauthenticated → `/login`
- Authenticated on `/login`, `/register`, `/` → `/events`

---

## 3. Wizard Flow Design

### Wizard State Machine

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────┐    ┌──────────────┐    ┌────────┐    ┌───────┐        │
│  │ Step 1  │───▶│   Step 2     │───▶│ Step 3 │───▶│Step 4 │        │
│  │ Details │    │ Participants │    │ Groups │    │ Tasks │        │
│  └─────────┘    └──────────────┘    └────────┘    └───────┘        │
│                                        │                  │          │
│                                        │ No Groups        │          │
│                                        ▼                  ▼          │
│                                     ┌──────┐    ┌──────────────┐    │
│                                     │Step 4│    │    Step 5     │    │
│                                     │Tasks │    │Review&Generate│    │
│                                     └──────┘    └──────────────┘    │
│                                                         │            │
│                                                         ▼            │
│                                                ┌────────────────┐    │
│                                                │ Control Center │    │
│                                                │ (post-setup)   │    │
│                                                └────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Step Completion Rules

| Step | Required to Advance | Can Revisit |
|------|-------------------|:-----------:|
| 1 – Event Details | Event name filled | ✓ |
| 2 – Participants | At least 1 participant added | ✓ |
| 3 – Groups | User selects a group type or "No Groups" | ✓ |
| 4 – Tasks | At least 1 task created | ✓ |
| 5 – Review & Generate | User reviews and generates cards | ✓ |
| Control Center | N/A — post-setup operational area (not a wizard step) | ✓ |

### Progress Persistence

Wizard navigation state is stored in `localStorage` keyed by event ID. When a user returns to an event, they land on their last-visited step. Completed steps are highlighted and clickable.

### Control Center

The Control Center is **not a numbered wizard step**. It is a post-setup operational area accessible once readiness validation passes. The wizard progress shows 5 setup steps; the Control Center is a separate destination unlocked after setup.

```
Wizard:    [1 Details] [2 People] [3 Groups] [4 Tasks] [5 Review & Generate]
                                                                    │
                                                                    ▼
Post-Setup:                                              [🎮 Control Center]
```

### Step 3 – Group Type Selection

Replace the simple Yes/No question with a group type selector:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  How do you want to organize participants?              │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  🚫 No       │  │  👨‍👩‍👧‍👦 Families │  │  ⚽ Teams    │ │
│  │   Groups     │  │              │  │              │ │
│  │  Everyone    │  │  Organize by │  │  Organize by │ │
│  │  together    │  │  family      │  │  team        │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐                                      │
│  │  ✏️ Custom    │                                      │
│  │   Groups     │                                      │
│  │  Define your │                                      │
│  │  own groups  │                                      │
│  └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Selection | Behavior |
|-----------|----------|
| No Groups | Skip group setup entirely. Tasks available to all. |
| Families | Pre-labels groups as "Family ___". Prompts for family names. |
| Teams | Pre-labels groups as "Team ___". Prompts for team names. |
| Custom Groups | Free-form group creation (current behavior). |

All options lead to the same underlying `groups` table — the selection only affects UI labels and pre-fill behavior.

### Group Membership – Matrix Editor

Group membership is managed via a **matrix/grid editor** on desktop and a **card-based list** on mobile.

**Desktop (≥768px):** Matrix grid

```
┌─────────────────────────────────────────────────────┐
│              │ Family Cohen │ Family Levi │ Boys Team │
├──────────────┼──────────────┼─────────────┼──────────┤
│ Yossi        │      ✓       │             │     ✓    │
│ Sarah        │      ✓       │             │          │
│ David        │              │      ✓      │     ✓    │
│ Michal       │      ✓       │             │          │
└─────────────────────────────────────────────────────┘
```

- Rows = participants, columns = groups
- Single click toggles membership
- Sticky first column and header row for scrolling
- Color-coded column headers matching group colors

**Mobile (<768px):** Card-based (participant → groups)

```
┌─────────────────────────────┐
│ Yossi                       │
│ ☑ Family Cohen  ☑ Boys Team │
│ ☐ Family Levi              │
├─────────────────────────────┤
│ Sarah                       │
│ ☑ Family Cohen              │
│ ☐ Family Levi  ☐ Boys Team │
└─────────────────────────────┘
```

This replaces the separate `GroupToMembers` and `MemberToGroups` components with a single responsive `MembershipMatrix` component.

---

## 4. Component Hierarchy

### New Page Components

```
src/pages/
├── Landing.tsx              (keep)
├── Login.tsx                (keep)
├── Register.tsx             (keep)
├── MyEvents.tsx             (NEW — replaces Dashboard)
├── EventWizard.tsx          (NEW — wizard container)
├── ScanMode.tsx             (NEW — full-screen scoring)
├── DisplayScreen.tsx        (NEW — projector leaderboard)
└── ExportResults.tsx        (NEW — export/download)
```

### New Component Tree

```
src/components/
├── events/                          (NEW)
│   ├── EventCard.tsx                — Event card in "My Events" list
│   └── CreateEventButton.tsx        — Large CTA
│
├── wizard/                          (NEW)
│   ├── WizardLayout.tsx             — Progress bar + step container
│   ├── WizardProgress.tsx           — Visual step indicator (5 steps + control center)
│   ├── WizardStepWrapper.tsx        — Step navigation (Next/Back)
│   │
│   ├── StepEventDetails.tsx         — Step 1
│   ├── StepParticipants.tsx         — Step 2
│   ├── StepGroupsDecision.tsx       — Step 3 (group type selector)
│   ├── StepGroupsSetup.tsx          — Step 3 (group creation + matrix)
│   ├── StepTasks.tsx                — Step 4
│   ├── StepReviewGenerate.tsx       — Step 5 (Review & Generate)
│   └── ControlCenter.tsx            — Post-setup operational area
│
├── participants/                    (REFACTOR)
│   ├── ParticipantCard.tsx          — Card-based display (replaces table row)
│   ├── AddParticipantInline.tsx     — Simple inline add
│   ├── BulkAddParticipants.tsx      — Quick multi-add
│   └── CsvImportParticipants.tsx    — CSV import (keep logic)
│
├── groups/                          (REFACTOR)
│   ├── GroupCard.tsx                — Visual group card with member count
│   ├── MembershipMatrix.tsx         — Desktop: grid matrix / Mobile: card list
│   └── GroupTypeSelector.tsx        — No Groups / Families / Teams / Custom
│
├── tasks/                           (NEW — replaces actions/)
│   ├── TaskCard.tsx                 — Visual task card (emoji + points)
│   ├── TaskForm.tsx                 — Create/edit task
│   ├── BonusTasks.tsx              — Pre-generated bonus tasks section
│   └── TaskGroupRestriction.tsx     — Optional group restriction
│
├── cards/                           (REFACTOR from qr-cards/)
│   ├── CardPreview.tsx              — Single card preview
│   ├── CardGenerationSummary.tsx    — Stats before generation
│   └── CardPrintLayout.tsx          — Print-optimized layout
│
├── control-center/                  (NEW)
│   ├── ControlActionCard.tsx        — Large action button card
│   ├── EventStatusBanner.tsx        — Active/Draft/Finished status
│   └── QuickStats.tsx              — Participant count, scores, etc.
│
├── scoring/                         (KEEP — used by ScanMode)
│   ├── QrScanner.tsx
│   ├── CelebrationModal.tsx
│   └── ParticipantPreview.tsx
│
├── leaderboard/                     (KEEP — used by DisplayScreen)
│   ├── LeaderboardSection.tsx
│   ├── RevealPodium.tsx
│   ├── WinnersReveal.tsx
│   └── PodiumPlace.tsx
│
├── ui/                              (KEEP — shared primitives)
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Badge.tsx
│   ├── Toast.tsx
│   ├── EmptyState.tsx
│   └── ... (other shared UI)
│
└── layout/                          (REFACTOR)
    ├── AppHeader.tsx                — Simple header (logo + user + logout)
    └── WizardLayout.tsx             — Wizard page layout
```

### Components to REMOVE

| Component | Reason |
|-----------|--------|
| `DashboardLayout.tsx` | Replaced by `WizardLayout` |
| `SidebarNav.tsx` | No more sidebar navigation |
| `BottomTabBar.tsx` | No more tab bar |
| `MoreDrawer.tsx` | No more drawer |
| `DashboardHome.tsx` | Replaced by MyEvents |
| `HomeLeaderboard.tsx` | Moved to DisplayScreen |
| `QuickScoreCard.tsx` | Moved to Control Center |
| `EventSection.tsx` | Merged into StepEventDetails |
| `ActionList.tsx` | Replaced by StepTasks |
| `ActionRow.tsx` | Replaced by TaskCard |
| `ActionForm.tsx` | Replaced by TaskForm |
| `RewardList.tsx` | Rewards become background logic (no dedicated view) |
| `RewardRow.tsx` | Same |
| `RewardForm.tsx` | Same |
| `RewardGroupAssignment.tsx` | Same |
| `StatCard.tsx` | Replaced by QuickStats |
| `XPBar.tsx` | Not needed in wizard UX |
| `RankBadge.tsx` | Only needed in DisplayScreen |

---

## 5. Required UI Changes

### A. TypeScript Type Additions (No Schema Change)

```typescript
// New client-side types — no DB columns added
export type StepStatus = 'not_started' | 'in_progress' | 'completed';
export type WizardStepId = 'details' | 'participants' | 'groups' | 'tasks' | 'cards' | 'control';

export interface WizardState {
  details: StepStatus;
  participants: StepStatus;
  groups: StepStatus;
  tasks: StepStatus;
  cards: StepStatus;
  control: StepStatus;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
}

export interface EventCounts {
  participants: number;
  groups: number;
  tasks: number;
  transactions: number;
}

// Existing types remain unchanged (Event, Action, etc.)
// Remove DashboardTab type
```

### B. Terminology Changes (UI Labels)

| Old Term | New Term | Hebrew |
|----------|----------|--------|
| Actions | Tasks | משימות (same) |
| Dashboard | My Events | האירועים שלי |
| Event Settings | Event Details | פרטי האירוע |
| QR Cards | Cards | כרטיסים |
| Score Entry | Scan Mode | מצב סריקה |
| Leaderboard | Display Screen | מסך תצוגה |
| Point Transactions | (hidden) | — |
| Rewards | (background, no label) | — |

### C. UI Pattern Changes

| Current | New | Reason |
|---------|-----|--------|
| Data tables | Card grids/lists | Less intimidating |
| Sidebar + tabs | Wizard progress bar | Linear flow |
| Forms in modals | Inline forms / bottom sheets | Less context switching |
| Dense stat cards | Large, simple counts | Clarity |
| Technical codes (P-1001) | Hidden from user (internal only) | Reduce noise |
| CRUD buttons (Edit/Delete) | Swipe actions or contextual menus | Cleaner cards |

### D. Visual Design Changes

| Aspect | Change |
|--------|--------|
| Color scheme | Keep dark theme but add more white-space |
| Typography | Larger text, bolder headings |
| Buttons | Larger touch targets (min 48px height) |
| Cards | Rounded corners, subtle shadows, more padding |
| Progress | Colorful step indicator with checkmarks |
| Empty states | Friendly illustrations + single CTA |
| Animations | Gentle transitions between steps |

---

## 6. Migration Plan (Presentation-Layer Only)

### Phase 1 — New Types & Utilities

1. Add client-side types: `WizardState`, `StepStatus`, `WizardStepId`, `ReadinessCheck`, `EventCounts`
2. Create `computeWizardState()` utility (derives step status from existing data)
3. Create `calculateReadiness()` utility
4. Create localStorage helpers for wizard prefs
5. Remove `DashboardTab` type

### Phase 2 — New Pages & Routes

1. Create `MyEvents` page (shows current event; multi-event ready for future)
2. Create `EventWizard` page with `WizardLayout`
3. Create `WizardProgress` component
4. Update `App.tsx` with new route structure
5. Add redirect: `/dashboard` → `/events` (backward compat)

### Phase 3 — Wizard Steps (One at a Time)

1. **Step 1 – Event Details:** Extract from `EventForm` + simplify
2. **Step 2 – Participants:** Refactor `ParticipantList` into card-based UI
3. **Step 3 – Groups:** Add decision prompt + refactor `GroupList` with bidirectional editing
4. **Step 4 – Tasks:** Rebuild `ActionList` as visual task cards
5. **Step 5 – Cards:** Refactor `QrCardGenerator` with generation summary
6. **Step 6 – Control Center:** New component with large action cards + readiness validation

### Phase 4 — Operational Screens

1. `ScanMode` — Extract from `ScoreEntry`, make full-screen
2. `DisplayScreen` — Extract from `LeaderboardSection`, full-screen for projection
3. `ExportResults` — New (CSV export of final standings)

### Phase 5 — Cleanup

1. Remove old components (DashboardLayout, SidebarNav, BottomTabBar, etc.)
2. Remove old `Dashboard.tsx` page
3. Remove `DashboardTab` type
4. Update `Landing.tsx` copy to match new product positioning
5. Delete unused imports and dead code

### Phase 6 — Polish

1. Mobile-optimize wizard steps
2. Add step transition animations
3. Test bidirectional group membership UX
4. End-to-end flow testing

---

## Architecture Decisions (Confirmed)

### 1. Rewards
- Do NOT add as a wizard step
- Keep hidden from primary workflow
- Rewards logic continues to run in background (existing RPC)
- Celebration modal still fires on reward unlock
- No UI changes to rewards — simply not exposed in wizard navigation

### 2. Display Screen
- Reuses existing `LeaderboardSection` component
- Accessible as a dedicated route within the app
- Full-screen layout, no nav chrome
- Auth still required (public token deferred to schema phase)

### 3. Multi-Event Per Admin
- Confirmed as a goal — but requires schema change (unique index removal)
- **Deferred to schema phase**
- For now: UI assumes single event per admin (current behavior)
- `MyEvents` page will show one event; multi-event support activates after schema approval

### 4. Existing Events
- Current event renders in wizard view with all steps treated as editable
- Wizard step state is derived from existing data (not stored):
  - Has name → details complete
  - Has participants → participants complete
  - Has groups → groups complete (or skipped if zero)
  - Has actions → tasks complete
- No DB persistence of wizard state

### 5. Branding
- No branding work at this stage
- Keep current naming temporarily

---

## Wizard Status (Client-Side Only)

Since no schema changes are allowed, wizard state is **computed from existing data**.

### Computed Step Status

```typescript
function computeWizardState(event: Event, counts: EventCounts): WizardState {
  return {
    details: event.name ? 'completed' : 'not_started',
    participants: counts.participants > 0 ? 'completed' : 'not_started',
    groups: counts.groups > 0 ? 'completed' : 'not_started',
    tasks: counts.tasks > 0 ? 'completed' : 'not_started',
    cards: 'not_started', // No way to know from existing schema; always editable
    control: 'not_started',
  };
}
```

### Readiness Validation (Client-Side)

```typescript
function calculateReadiness(event: Event, counts: EventCounts): ReadinessCheck[] {
  return [
    { id: 'event_name', label: 'לאירוע יש שם', passed: !!event.name, required: true },
    { id: 'has_participants', label: 'לפחות משתתף אחד', passed: counts.participants > 0, required: true },
    { id: 'has_tasks', label: 'לפחות משימה אחת', passed: counts.tasks > 0, required: true },
  ];
}
```

### Local Storage (Optional UX Enhancement)

Wizard navigation preferences (last visited step, group decision "yes/no") can be stored in `localStorage` keyed by event ID:

```typescript
interface WizardPrefs {
  lastStep: number;
  groupsDecision: 'yes' | 'no' | null;
}
// Key: `wizard_prefs_${eventId}`
```

---

## Updated Route Structure (Final)

| Route | Component | Auth | Notes |
|-------|-----------|:----:|-------|
| `/` | Landing | No | Public |
| `/login` | Login | No | |
| `/register` | Register | No | |
| `/events` | MyEvents | Yes | Shows current event (multi-event after schema phase) |
| `/events/:id` | EventWizard | Yes | Redirects to appropriate step |
| `/events/:id/step/:step` | EventWizard | Yes | Direct step access (1-5) |
| `/events/:id/control` | ControlCenter | Yes | Post-setup operational area |
| `/events/:id/scan` | ScanMode | Yes | Full-screen scoring |
| `/events/:id/display` | DisplayScreen | Yes | Full-screen leaderboard (public access deferred) |
| `/events/:id/export` | ExportResults | Yes | Export data |
| `/dashboard` | Redirect → `/events` | — | Backward compat |

---

## Risk Notes

| Risk | Mitigation |
|------|-----------|
| Single-event constraint still enforced | MyEvents page shows one event; ready for multi-event after schema approval |
| Wizard state not persisted in DB | Derive from data (has participants? → step done). localStorage for nav prefs |
| Rewards system hidden from UI | Keep auto-award logic running; celebration modal still fires |
| Mobile wizard UX on small screens | Each step is a single-scroll page; progress bar collapses to dots |
| Existing users lose familiar navigation | All existing functionality still accessible via wizard steps |

---

## File Impact Summary

| Category | Count |
|----------|-------|
| New files to create | ~20 components + 4 pages + utilities |
| Files to heavily refactor | ~8 (participants, groups, actions/tasks, QR cards) |
| Files to delete | ~15 (dashboard layout, sidebar, old tabs) |
| Files unchanged | ~15 (UI primitives, auth, scoring core, leaderboard core, types mostly) |
| Schema changes | **0** (deferred) |
| Migrations | **0** (deferred) |

---

## Confirmation Needed Before Implementation

All architecture decisions confirmed. Ready to implement (presentation-layer only).
