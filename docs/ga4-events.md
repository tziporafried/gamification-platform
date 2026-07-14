# Gamify Platform — GA4 Events Inventory

Build verified: `npm run build` passes.

---

## Existing events (already present before expansion)

| Event | Trigger | Params | Location |
|---|---|---|---|
| `page_view` | Every SPA route change | `page_path`, `page_title`, `page_location`, `page_referrer`, `landing_referrer` | `AnalyticsListener` |
| `video_view` | Demo video playback starts (once per mount) | `video_id`, `video_title` | `Landing.tsx` |
| `video_complete` | Demo video reaches end | `video_id`, `video_title` | `Landing.tsx` |
| `login` | Successful login | `method` (`email` \| `google`) | `Login.tsx`, `AuthContext` |
| `sign_up` | Successful sign-up | `method` (`email` \| `google`) | `Login.tsx`, `AuthContext` |
| `view_plans` | User opens the Plans / activation modal | `page_path` (`plans_modal`), `has_linked_event` | `PlansModal.tsx` |
| `contact_click` | Plan option chosen (opened contact form) | — | **Replaced by `select_plan`** (same trigger) |

---

## New events

| Event | Trigger | Params | Location |
|---|---|---|---|
| `cta_click` | Meaningful marketing / upgrade CTA | `cta_name`, `cta_location`, `destination`, optional `contact_source` | `Landing.tsx`, `GlobalHeader.tsx`, `UpgradeModal.tsx`, `ControlCenter.tsx`, `TrialActivationBadge.tsx`, `FloatingContactButton.tsx` |
| `video_progress` | Video reaches 25 / 50 / 75% (once per milestone per playback) | `progress_percent`, `video_id`, `video_title` | `Landing.tsx` |
| `select_plan` | User chooses a plan card (opens contact form) | `plan_name`, `has_linked_event` | `PlansModal.tsx` |
| `contact_form_open` | Contact / plan lead form opened | `contact_source`, `cta_location` | `FloatingContactButton`, `Landing`, `PlansModal`, `MyEvents` |
| `generate_lead` | Contact / upgrade form submitted successfully | `plan_name`, `has_linked_event`, optional `contact_source` | `ContactForm` |
| `login_view` | Login screen opened | — | `Login.tsx` |
| `login_start` | User starts a login attempt | `method` | `Login.tsx` |
| `login_error` | Login fails | `error_type`, `method` | `Login.tsx` |
| `event_creation_start` | User clicks create event | — | `MyEvents.tsx`, `PlansModal.tsx` |
| `event_created` | Event row inserted successfully | `creation_method` | `MyEvents.tsx`, `PlansModal.tsx` |
| `wizard_step_view` | Wizard step shown | `step_number`, `step_name` | `EventWizard.tsx` |
| `wizard_step_complete` | User advances / finishes a step | `step_number`, `step_name` | `EventWizard.tsx`, `StepReviewGenerate.tsx` |
| `wizard_back` | User goes to previous wizard step | `from_step`, `to_step` | `EventWizard.tsx` |
| `wizard_exit` | User leaves wizard without finishing | `step_number`, `step_name` | `AnalyticsListener` |
| `event_open` | Manager opens control center or resumes wizard | `destination` (`control` \| `wizard`) | `EventControlCenter.tsx`, `EventBySlug.tsx`, `MyEvents.tsx` |
| `event_edit_start` | Edit started from control center | `was_active` | `ControlCenter.tsx` |
| `event_updated` | Event details saved successfully | — | `StepEventDetails.tsx` |
| `event_deleted` | Event archived successfully | — | `MyEvents.tsx` |
| `scanner_view` | Kiosk / scanner screen opened | `plan` | `EventKioskPage.tsx` |
| `scan_success` | Successful QR scan or manual entry | `source` (`qr_scan` \| `manual_entry`) | `EventKioskPage.tsx` |
| `scan_failed` | Scan / score submit failed | `error_type`, `source` | `EventKioskPage.tsx` |
| `trial_scan_completed` | Successful scan while event is in trial (`plan=free`) | `event_id`, `scan_number` | `EventKioskPage.tsx` |
| `trial_scan_limit_reached` | Scan attempted after trial quota exhausted | `event_id`, `allowed_scans` | `EventKioskPage.tsx` |
| `activation_options_viewed` | Plans modal opened with a linked event + known source | `event_id`, `source` | `PlansModal.tsx` |
| `activation_options_clicked` | Click on trial activation badge CTA | `event_id`, `source` (`events_page_trial_badge` \| `wizard_trial_badge`) | `TrialActivationBadge.tsx` |
| `trial_activated` | Event left trial for a real activation mode | `event_id`, `activation_mode`, `trial_scans_used` | `AdminPanel.tsx` (after `update_event_plan`) |
| `trial_data_reset` | Trial runtime scores/rewards wiped on activation | `event_id` | `AdminPanel.tsx` |
| `prize_revealed` | Prize celebration after successful scan | `prize_type` (`milestone`), `prize_count` | `EventKioskPage.tsx` |
| `leaderboard_view` | Leaderboard / display screen opened | — | `EventDisplay.tsx` |
| `app_error` | Significant failure in a core flow | `error_area`, `error_type` | plans / event creation / scanner |
| `event_start_method` | User chooses scratch vs template in the wizard picker | `method` (`scratch` \| `template`) | `EventWizard.tsx` |
| `faq_open` | User expands an FAQ item on the landing page | `question` (full question text), `question_index` | `Landing.tsx` |

### `activation_options_viewed` — `source` values

| Value | Entry point |
|---|---|
| `trial_scan_limit` | Trial scan-quota modal → Plans |
| `game_home_trial` | Control center activation CTA |
| `events_page_trial_badge` | My Events badge |
| `wizard_trial_badge` | Wizard header badge |
| `plan_limit_modal` | Paid-plan entity cap modal |
| `header` | Global header “הפעלת המשחק” (when an event is in context) |
| `post_wizard` | After wizard finish with pending activation |
| `deep_link` | Legacy `/plans?...` deep link with `event` |

---

## Admin Analytics dashboard (Plans + Contact)

UI: Admin panel → **ניתוח נתונים** (`AdminAnalyticsDashboard.tsx`).  
Data: Edge Function `ga4-dashboard` (`supabase/functions/ga4-dashboard`).

### Section: Plans ואפשרויות הפעלה

| UI metric | GA4 event / dimension |
|---|---|
| פתחו את מודל ההפעלה | `view_plans` (unique users) |
| בחרו מסלול | `select_plan` |
| השאירו פרטים (כולל) | `generate_lead` (all sources in range) |
| צפייה מהפעלת ניסיון | `activation_options_viewed` |
| לחיצה על באדג׳ הפעלה | `activation_options_clicked` |
| הופעלו מניסיון | `trial_activated` |
| משפך: פתיחה → בחירה → ליד | `view_plans` → `select_plan` → `generate_lead` |
| בחירת מסלול לפי תוכנית | `select_plan` × `customEvent:plan_name` |
| פתיחת מודל לפי מקור כניסה | `activation_options_viewed` × `customEvent:source` |

> Note: the funnel’s lead step uses **all** `generate_lead` users in the date range (contact + plans), not only plan leads. Use “לידים לפי מקור” below to separate.

### Section: יצירת קשר

| UI metric | GA4 event / dimension |
|---|---|
| פתחו טופס יצירת קשר | `contact_form_open` |
| השאירו פרטים | `generate_lead` |
| המרה מפתיחה לשליחה | leads ÷ form opens |
| פתיחות טופס לפי מקור | `contact_form_open` × `customEvent:contact_source` |
| לידים לפי מקור פנייה | `generate_lead` × `customEvent:contact_source` |

### Custom dimensions required in GA4 (event-scoped)

Register these params as Custom Dimensions so breakdown charts work in the admin dashboard:

| Param | Used by |
|---|---|
| `cta_name` | `cta_click` |
| `cta_location` | `cta_click`, `contact_form_open` |
| `contact_source` | `contact_form_open`, `generate_lead` |
| `plan_name` | `select_plan`, `generate_lead` |
| `source` | `activation_options_viewed`, `activation_options_clicked` |
| `question` | `faq_open` |
| `creation_method` | `event_created` |

If a dimension is missing, the matching chart shows an “unavailable” state; KPIs from core event counts still work.

### Deploy note

After changing `supabase/functions/ga4-dashboard`, redeploy the function so the admin UI receives the expanded payload:

```bash
supabase functions deploy ga4-dashboard
```

---

## CTA parameter reference

### `cta_name` values
| Value | Meaning |
|---|---|
| `create_event` | Footer “create first event” CTA |
| `start_now` | After-video “בואו נשחק” |
| `view_pricing` | Pricing / activation CTA (opens Plans modal) |
| `view_activation_options` | Explicit activation-options CTA |
| `login` | Header login link |
| `contact_us` | Floating / FAQ / footer / trial contact CTA |
| `open_scanner` | Control center → kiosk |
| `open_leaderboard` | Control center → display |

### `cta_location` values
| Value | Meaning |
|---|---|
| `header` | Global header |
| `after_video` | Below landing demo video |
| `pricing` | FAQ pricing link / Plans modal CTA |
| `footer` | Landing bottom CTA / contact secondary |
| `floating` | Landing floating “יש לכם שאלה?” |
| `faq` | Landing FAQ “דברו איתנו” |
| `events` | My Events floating contact (trial) |
| `wizard` | Wizard floating contact (trial) |
| `control` | Control center floating contact (trial) |
| `events_page_trial_badge` | Trial badge on My Events |
| `wizard_trial_badge` | Trial badge in wizard header |
| `trial_scan_limit_modal` | Trial scan-quota activation modal |
| `plan_limit_modal` | Paid-plan entity cap modal (e.g. 70 participants) |
| `control_center` | Event control center activation actions |

### `contact_source` values
| Value | Meaning |
|---|---|
| `homepage_contact` | Opened from landing / marketing contact CTAs |
| `trial_contact` | Opened from in-app trial floating contact |
| `custom_solution` | Organizations / custom solution from Plans modal |
| `independent` / `full` / `organizations` | Plan card chosen on Plans (also sent as `plan_name`) |

---

## Not added (missing in product / intentional)

| Requested event | Reason |
|---|---|
| `view_pricing` (event name) | Covered by existing `view_plans` (same moment); CTA uses `cta_name=view_pricing` |
| `begin_checkout` | No purchase / checkout flow (contact request only) |
| `purchase` | No purchase success path |
| `video_pause` | Too noisy with native video controls |
| `contact_click` | Renamed to `select_plan` (same trigger) |
| Event UUIDs / PII | Not sent on new events (no emails, names, phones, barcode values, prize titles) |

---

## Anti-noise / double-tracking decisions

- ~800ms dedupe for: `page_view`, `view_plans`, `login_view`, `wizard_step_view`, `scanner_view`, `leaderboard_view`, `app_error`
- SPA `page_view` is manual only (`send_page_view: false` in GA config)
- `prize_revealed` never sends user-authored prize text
- `wizard_exit` only on explicit leave (not when finishing into control)
- `activation_options_viewed` is fired once from `PlansModal` (entry points should not double-fire it)
- Tracking limited to meaningful CTAs and core product flows — not every click

---

## Central helpers

All events go through `src/lib/analytics.ts` (`trackEvent` / typed wrappers).
