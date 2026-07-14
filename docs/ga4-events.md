# Gamify Platform — GA4 Events Inventory

Build verified: `npm run build` passes. Analytics-only instrumentation (no UI / routing / business-logic changes).

---

## Existing events (already present before expansion)

| Event | Trigger | Params | Location |
|---|---|---|---|
| `page_view` | Every SPA route change | `page_path`, `page_title`, `page_location`, `page_referrer`, `landing_referrer` | `AnalyticsListener` |
| `video_view` | Demo video playback starts (once per mount) | `video_id`, `video_title` | `Landing.tsx` |
| `video_complete` | Demo video reaches end | `video_id`, `video_title` | `Landing.tsx` |
| `login` | Successful login | `method` (`email` \| `google`) | `Login.tsx`, `AuthContext` |
| `sign_up` | Successful sign-up | `method` (`email` \| `google`) | `Login.tsx`, `AuthContext` |
| `view_plans` | User opens `/plans` | `page_path`, `has_linked_event` | `PlansPage.tsx` |
| `contact_click` | Plan option chosen (opened contact form) | — | **Replaced by `select_plan`** (same trigger) |

---

## New events

| Event | Trigger | Params | Location |
|---|---|---|---|
| `cta_click` | Meaningful marketing / upgrade CTA | `cta_name`, `cta_location`, `destination` | `Landing.tsx`, `GlobalHeader.tsx`, `UpgradeModal.tsx`, `ControlCenter.tsx` |
| `video_progress` | Video reaches 25 / 50 / 75% (once per milestone per playback) | `progress_percent`, `video_id`, `video_title` | `Landing.tsx` |
| `select_plan` | User chooses a plan card (opens contact form) | `plan_name`, `has_linked_event` | `PlansPage.handleChoose` |
| `generate_lead` | Contact / upgrade form submitted successfully | `plan_name`, `has_linked_event` | `PlansPage.handleSubmit` |
| `login_view` | Login screen opened | — | `Login.tsx` |
| `login_start` | User starts a login attempt | `method` | `Login.tsx` |
| `login_error` | Login fails | `error_type`, `method` | `Login.tsx` |
| `event_creation_start` | User clicks create event | — | `MyEvents.tsx` |
| `event_created` | Event row inserted successfully | `creation_method` | `MyEvents.tsx` |
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
| `activation_options_viewed` | Plans page opened from trial UX | `event_id`, `source` (`trial_scan_limit` \| `game_home_trial` \| `events_page_trial_badge`) | `PlansPage.tsx` |
| `activation_options_clicked` | Click on My Events trial badge CTA | `event_id`, `source` (`events_page_trial_badge`) | `MyEvents.tsx` |
| `trial_activated` | Event left trial for a real activation mode | `event_id`, `activation_mode`, `trial_scans_used` | `AdminPanel.tsx` (after `update_event_plan`) |
| `trial_data_reset` | Trial runtime scores/rewards wiped on activation | `event_id` | `AdminPanel.tsx` |
| `prize_revealed` | Prize celebration after successful scan | `prize_type` (`milestone`), `prize_count` | `EventKioskPage.tsx` |
| `leaderboard_view` | Leaderboard / display screen opened | — | `EventDisplay.tsx` |
| `app_error` | Significant failure in a core flow | `error_area`, `error_type` | plans / event creation / scanner |
| `event_start_method` | User chooses scratch vs template in the wizard picker | `method` (`scratch` \| `template`) | `EventWizard.tsx` |
| `faq_open` | User expands an FAQ item on the landing page | `question` (full question text), `question_index` | `Landing.tsx` |

---

## CTA parameter reference

### `cta_name` values
| Value | Meaning |
|---|---|
| `create_event` | Footer “create first event” CTA |
| `start_now` | After-video “בואו נשחק” |
| `view_pricing` | Pricing / upgrade CTA |
| `login` | Header login link |
| `open_scanner` | Control center → kiosk |
| `open_leaderboard` | Control center → display |

### `cta_location` values
| Value | Meaning |
|---|---|
| `header` | Global header |
| `after_video` | Below landing demo video |
| `pricing` | FAQ pricing link |
| `footer` | Landing bottom CTA |
| `trial_scan_limit_modal` | Trial scan-quota activation modal |
| `plan_limit_modal` | Paid-plan entity cap modal (e.g. 70 participants) |
| `control_center` | Event control center actions |

---

## Not added (missing in product / intentional)

| Requested event | Reason |
|---|---|
| `view_pricing` | Covered by existing `view_plans` (same moment) |
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
- Tracking limited to meaningful CTAs and core product flows — not every click

---

## Central helpers

All events go through `src/lib/analytics.ts` (`trackEvent` / typed wrappers).
