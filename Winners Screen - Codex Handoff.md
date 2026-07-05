# Winners / Ceremony Screen  Implementation Handoff for Codex

---

##  PROMPT TO PASTE TO CODEX (start here)

> You are implementing a full redesign of our winners/ceremony display screen in this repo. A previous attempt was only **partially** completed  this time implement **all of it, end to end**, and do not stop until every item in the "Definition of Done" checklist (15) passes.
>
> Read the full spec below before writing code. Follow the exact files, hooks, and functions named in 1 and 12. **Do not change any ranking/data logic**  only presentation, animation, layout, sequencing, and copy.
>
> Build the new experience as src/components/leaderboard/WinnersCeremony.tsx and render it from the display route (0). Implement the **complete 9-phase sequence** (4), **both** champion reveals, **both** podiums, **both** full leaderboards, **and both** "most missions completed" sections (8)  a subset is not acceptable. Wire applause (9), all three states (10), and responsive/fullscreen (11). Remove the old Recent Activity feed and admin chrome.
>
> When done, self-check against 15 and report which items pass and which don't. If any fail, keep going.

##  Why the last attempt came out partial  avoid these

The most common gaps that make this look "half done"  **do not repeat them**:
- Only groups were celebrated; **participants** block (phases 46) was skipped or stubbed. Both are mandatory.
- The two **"most missions completed"** sections (phases 78) were missing. They are mandatory and rank by mission count, not points.
- The **ambient atmosphere** (drifting orbs, rotating light rays, sparkles, gradient wash, light sweep) was dropped, so it looked like a flat dashboard instead of a live event. All ambient layers are required (2).
- The **phase sequencer** didn't auto-advance/loop, or didn't cross-fade. It must run on timers and loop (4).
- **Champion drama** was reduced to a plain card  the halo glow, confetti, count-up, crown, spotlight, and zoom-in entrance are all required (5).
- **Applause** wasn't wired, or played on every phase. It plays **only** on champion reveals (phases 1 & 4) (9).
- **Fullscreen/cold-load** wasn't verified  screen showed blank or unscaled until interaction (11).

---

## 0. What you are building

Replace the current **EventDisplay** page experience (the /events/:id/display route  EventDisplayPage  LeaderboardSection) with a **grand-finale winners ceremony**: a full-screen, auto-advancing "closing ceremony" that celebrates the competition results with a light, premium, energetic look.

A finished HTML/animation prototype exists in this project: **Winners Display Screen.dc.html**. Treat it as the visual + motion **spec** (colors, glows, sequence, timing, copy). You are porting that experience into the real React/TypeScript/Tailwind/Supabase app  **not** copying the prototype's runtime (it uses a custom DCLogic shell). Rebuild it with the app's existing components, hooks, framer-motion, and Tailwind tokens.

>  **Hard rule:** Do **not** change any ranking/data logic (RPCs, computeRanks, sorting, tie handling). Only presentation, animation, layout, sequencing, and copy change.

---

## 1. Files to reuse (do not reinvent)

| Concern | Existing file | How to use |
|---|---|---|
| Route/page shell | src/pages/EventDisplay.tsx | Keep fetching the event; keep the bg-app-radial wrapper. You may replace the <LeaderboardSection> render with the new ceremony component, or heavily rework LeaderboardSection in place. Prefer a **new** component src/components/leaderboard/WinnersCeremony.tsx and swap it in, so the old code stays diffable. |
| Data + ranking | src/components/leaderboard/LeaderboardSection.tsx + src/lib/missionUtils.ts | **Lift the data layer verbatim**: the leaderboard-fetch useEffect and the two RPC calls get_participant_leaderboard / get_group_leaderboard, the point_transactions query, the participant_groups mapping, and the memos. computeRanks() is **already shared** in src/lib/missionUtils.ts  import it (import { computeRanks } from '@/lib/missionUtils'), exactly as EventKioskPage.tsx does. See 12. |
| Sound | src/hooks/useSound.ts | Reuse playApplause(rank) for the champion reveals. See 9. |
| Celebration chime | src/hooks/useCelebrationSound.ts | Optional extra fanfare layered under the applause. |
| Count-up number | AnimatedNumber (local fn in LeaderboardSection.tsx, ~line 51) or the useCountUp hook (src/hooks/useCountUp.ts) | Reuse for the champion point count-up (the current code already uses <AnimatedNumber value={champ.total_points} duration={2500} />). Extract AnimatedNumber to its own file if you want to share it. |
| Empty state | src/components/leaderboard/LeaderboardEmptyState.tsx | Reuse for the empty state (10). |
| Error / loader | src/components/ui/ErrorAlert.tsx, CenteredLoader, Spinner, FullPageLoader | Reuse; restyle to match the ceremony (10). |
| Avatars | src/components/ui/AvatarCircle.tsx | Use for participant avatars; pass ringColor. |
| Sound toggle | src/components/leaderboard/SoundToggle.tsx | Keep as the ONLY admin-ish control (mute). Remove refresh/back/expandable-modal chrome from the display experience. |
| Design tokens | src/styles/design-tokens.css, tailwind.config.js | Use semantic tokens/keyframes already defined (see 2, 3). |

**Do NOT** import from Winners Display Screen.dc.html, support.js, or Event Display Screen.dc.html. Those are prototypes; read them for reference values only.

---

## 2. Design direction & atmosphere

One cohesive "display screen" family with the existing **Event Display Screen** (kiosk). Warm, bright, premium  **not dark**.

- **Base background:** warm cream #FFF8F3 (token --color-background) with soft radial glows in the corners (orange top-right, gold top-left, teal bottom). This is already the .bg-app-radial / --gradient-background treatment  reuse it.
- **Palette (from design-tokens.css):**
  - Primary orange #AB3500, accent orange #FF6B35, warm orange #FF9366 / #EF8A4E
  - Gold #FFB800 / deep gold #C8890B / #E09A1F (1st place, points emphasis)
  - Teal secondary #50A49D / #3E8F88 / #5FB3AA (participants theme)
  - Green #45CF6B (success / lower ranks)
  - Ink text #2E221E, muted #7D706A
- **Type:** Heebo (already the app font), weights 700900 for headings, big and readable from across a room. On a 19201080 canvas nothing important is below ~24px; hero numbers 100px+.
- **Atmosphere / "always alive" ambient layers** (behind all content, non-interactive):
  1. Animated shifting linear-gradient wash (very slow, ~24s).
  2. 34 large blurred **drifting color orbs** (orange/gold/teal) for depth.
  3. A slow rotating **light-ray fan** (repeating-conic-gradient, masked to fade at edges, ~90s rotation, low opacity).
  4. A periodic diagonal **light sweep**.
  5. Floating **sparkles/particles** (twinkle + float).
- **Festive top strip:** 8px full-width gradient bar #FF9366#FFB84D#FFD68A#8FCFA0#5FB3AA.
- **Direction:** RTL Hebrew throughout (dir="rtl").

Keep it elegant: glows and motion are subtle and layered, never flashing or noisy.

---

## 3. Reusable animation keyframes

Prototype defines these (see <style> in the .dc.html). Port the ones you need into Tailwind keyframes/animation (several already exist in tailwind.config.js: confetti-fall, glow-pulse, glow-pulse-gold, shimmer, pop-in, crown-glow, fade-in-up, celebration-bounce). Add as needed:

- spin (light rays), float/bob (sparkles, trophy), twinkle (sparkles)
- pulse-glow / halo-pulse (champion halo), orb-drift (background orbs), sweep (light sweep)
- race (leaderboard bar scaleX fill, transform-origin on the RTL start edge)
- row-in (leaderboard rows stagger in  translateX(34px)), pop (podium/cards), rise (podium pedestals scaleY)
- crown (crown wobble), number-glow (points text-shadow pulse), champ-in (dramatic scale+blur entrance)

framer-motion is already used in LeaderboardSection  you can drive entrance/stagger with motion instead of CSS where cleaner. Continuous ambient loops are best as CSS keyframes.

---

## 4. Ceremony flow (the sequence)

A **phase state machine** drives a single full-screen stage. Phases auto-advance on timers, then loop. Order:

| # | Phase | ~Duration | Notes |
|---|---|---|---|
| 0 | **Suspense** | 3.0s | Trophy 🏆 + "רגע האמת" eyebrow + "מי יזכה בגביע?" pulsing headline. |
| 1 | **Champion GROUP reveal** | 5.5s | Dramatic single-winner moment. Applause fires here. |
| 2 | **Top-3 GROUPS podium** | 5.5s | 1st center/tallest, 2nd & 3rd flank. |
| 3 | **Full GROUPS leaderboard** | 9.0s | All groups, top-3 highlighted, race bars. |
| 4 | **Champion PARTICIPANT reveal** | 5.5s | Same treatment, teal-themed. Applause fires here. |
| 5 | **Top-3 PARTICIPANTS podium** | 5.5s | |
| 6 | **Full PARTICIPANTS leaderboard** | 9.0s | Shows each participant's group name. |
| 7 | **Most missions  GROUPS** | 6.5s | Recognition by mission count (see 8). |
| 8 | **Most missions  PARTICIPANTS** | 6.5s | Recognition by mission count. |

- Phases cross-fade (opacity + slight scale) over ~0.7s. Champion phases (1, 4) use a stronger zoom-in for drama.
- A revealSpeed multiplier scales all durations (prototype default 1, range 0.52).
- An autoLoop flag returns to phase 0 after phase 8.
- Bottom chrome: 9 progress dots (active = orange, animated width) + a subtle " הצג שוב" (replay) button. **No** back button, no refresh, no clickable expand-to-modal  this is a display, not an admin panel.
- If there are **no groups** in the event, skip the group phases (13) gracefully and run only participant + missions phases. (The current data logic already tells you hasGroups = groupData.length > 0.)

**Sequencer implementation:** a useEffect that, given the current phase, sets a setTimeout for the next phase using durs[phase] / revealSpeed. Clear timers on unmount and on manual replay. When entering phase 1 or 4, kick off the champion count-up and call playApplause(1).

---

## 5. Champion reveal (phases 1 & 4)  the "wow" moment

Structure (centered on stage):
1. Small eyebrow: 🏆 אליפות המשפחות (groups) /  אלוף המשתתפים (participants).
2. A **premium card**: linear-gradient(150deg,#FFFDF7,#FFF1D2) (gold, groups) or ,#EAF7F5 (teal, participants), 2px themed border, layered shadow **+ a pulsing radial halo glow behind it** (halo-pulse), plus a diagonal shine sweep across the card.
3. Inside: crown 👑 (wobble) above a large avatar/initial circle (themed gradient, white ring, breathing scale), champion label, huge name (~104px), a **count-up** points number (~120px, gold for groups / teal for participants, number-glow), and a pill:
   - Groups: 🥇 מקום ראשון  🔥 הפרש של 20 נק בלבד (or compute real gap: champ.total_points - runnerUp.total_points).
   - Participants: 🥇 מקום ראשון   שוברת שיאים!
4. **Confetti** rain overlay during the reveal (reuse the confetti approach already in LeaderboardSection, or the prototype's).
5. Background: gold/teal spotlight cone from top + faster rotating rays behind the card.

The champion is rankedG[0] (group) / rankedP[0] (participant) from the unchanged ranking. Colors switch by block: **groups = gold/orange**, **participants = teal/gold**. 1st place is always gold-accented.

---

## 6. Top-3 podium (phases 2 & 5)

- Three pedestals, **1st centered and tallest** (~300px), 2nd (~212px) and 3rd (~168px) flanking. In RTL, order children [2nd, 1st, 3rd] so 1st stays centered.
- Each column: avatar (themed gradient, white ring) with a medal badge (🥇/🥈/🥉), name, points, and a pedestal block showing the big rank numeral. 1st column gets a crown + gold pedestal + shine.
- Entrance: 1st pops first, then 2nd/3rd stagger (pop / motion delays). Pedestals rise (scaleY from bottom).
- Data: rankedG.find(r => r.rank === 2) etc. (participants: rankedP). Handle missing 2nd/3rd (fewer than 3 entrants) gracefully.

---

## 7. Full leaderboards (phases 3 & 6)

- Header: "טבלת המשפחות" / "טבלת המשתתפים" + "דירוג מלא" + a live "מתעדכן בזמן אמת" pill.
- Rows for **all** ranked entries with total_points > 0 (match current filter). Show up to what fits (~8 rows at 19201080); if more, the extra rows can scroll/paginate or shrink  keep readable. Highlight top-3 rows (gold/silver/bronze border on the RTL start edge, subtle tinted bg + glow); ranks 4+ are plain white cards.
- Each row: rank (medal for top-3, else numeral), avatar/initial, name, an animated **race bar** (scaleX fill, width = points / topPoints), a secondary metric (groups: mission count via taskCountByPgroupTaskCounts; participants: their group name via pgMap), and the points number (gold for #1).
- Rows stagger in (row-in, incrementing delay). **Remove the old "Recent Activity" feed entirely**  the screen is dedicated to results.

---

## 8. "Most missions completed" recognition (phases 7 & 8)

Purpose: recognize effort, not just points, so **more people get a moment**. These rank by **number of completed missions/actions**, which is a *different* ordering than points.

- Compute counts from the same transactions you already fetch:
  - Participant mission counts = taskCountByP (already built in LeaderboardSection: count of point_transactions per participant_id).
  - Group mission counts = groupTaskCounts (already built: sum of member counts via pgMap).
- Sort **descending by count** and take the top 3 for each. (New sorting for *display only*  it does not touch the points ranking logic.)
- Layout: three celebration cards, center (1st) larger with a crown + "🎯 אלופת/אלוף המשימות" badge; cards show 🎯, name, and a big **mission count** number, with label "משימות הושלמו". Groups phase themed teal/gold, participants phase themed orange/gold.
- Eyebrow: 🎯 אלופי ההתמדה; headline: "המשפחות/המשתתפים שהשלימו הכי הרבה משימות"; sub: encouraging line ("כי לא רק נקודות  גם ההשקעה נספרת").

---

## 9. Applause sound

Use useSound()  playApplause(rank) (Web Audio: bandpass-filtered noise "crowd" + it already respects muted). Optionally layer useCelebrationSound().play() for a short rising fanfare chime.

Rules (already satisfied by useSound, keep them):
- **Only on champion reveal**  call once when entering phase 1 and phase 4, synchronized ~200ms into the reveal animation. Do **not** play on podiums, leaderboards, or missions phases.
- **Short, non-looping** (~2.8s), modest volume, ceremony feel.
- **Autoplay-safe:** AudioContext starts suspended; useSound.getCtx() calls resume() and everything is wrapped so it **fails silently** if blocked. Because the display auto-plays with no gesture, the first reveal may be silent until any interaction resumes the context  that is expected and must not throw. Respect the existing muted state + SoundToggle + localStorage('leaderboard-sound-muted').

---

## 10. Empty / loading / error states

Match the ceremony's light style; full-screen centered.

- **Loading:** gold spinner + "טוענים את התוצאות". (phase === 'loading' in current code, or a simple loading boolean. Reuse CenteredLoader/Spinner.)
- **Empty** (no scores yet  rankedP.length === 0 && rankedG.length === 0): reuse LeaderboardEmptyState ("הזירה מוכנה" + guidance). Do not run the sequence.
- **Error** (RPC failure): reuse ErrorAlert styled to match  headline "שגיאה בטעינת הנתונים" + "טבלת הדירוג בהכנה". Keep the existing error copy/logic from fetchAll.

The prototype includes all three overlays for reference styling.

---

## 11. Responsive / fullscreen behavior

The prototype composes on a fixed **19201080 stage** and scales it to fit the viewport (transform: scale(min(vw/1920, vh/1080)), centered), which guarantees the layout and readability on any display/projector.

In React you have two acceptable options  pick one:
1. **Fluid layout** (preferred for a web app): build with responsive units (clamp(), vw, flex/grid) so it fills any screen naturally, and add a proper browser **Fullscreen API** toggle. This avoids fixed-scale pitfalls.
2. **Fixed-stage-and-scale** (mirrors prototype exactly): if you replicate it, **learn from the prototype's bug**: on mount the iframe/container can report 00 for several frames and a ResizeObserver on documentElement may never fire. Use a **resilient measure**: initial measure + a retry burst (setTimeout at ~0/60/120/250/400/700/1000ms) **and** a requestAnimationFrame loop that keeps re-measuring until a valid (>0) scale is applied, observe window resize + document.body (not just documentElement), and default scale to a sane fallback so it's never blank.

Either way: verify a **cold load with no interaction** shows the whole composition, centered, on a 16:9 screen, and re-fits on resize.

---

## 12. Data & ranking  MUST NOT CHANGE

Lift these from LeaderboardSection.tsx unchanged (ranking helper is already shared in src/lib/missionUtils.ts):

- computeRanks<T>()  the exact tie-aware ranking (rank stays equal for equal total_points, then jumps). It lives in **src/lib/missionUtils.ts**; **import** it, do **not** re-implement or alter. EventKioskPage.tsx already imports it the same way.
- RPCs (inside the leaderboard-fetch useEffect): supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }) and ('get_group_leaderboard', { p_event_id: eventId }).
- point_transactions query (last 200, with participant + action joins).
- participant_groups  pgMap (participant  {id,name,color}), batched in chunks of 100.
- computeRanks<T>()  the exact tie-aware ranking. **Import from src/lib/missionUtils.ts** (already shared); never re-implement or alter.
- Derived memos to reuse as-is: rankedP, rankedG, hasGroups, taskCountByP, groupTaskCounts, topPByGroup, taskStats.
- Types: ParticipantLeaderboardEntry, GroupLeaderboardEntry from src/types.

The **only** new derived data is display-side sorting of the existing mission counts for phases 78 (8). No new queries required.

Champion/podium selections must come straight from the ranked arrays:
champGroup = rankedG[0], g2 = rankedG.find(r=>r.rank===2), g3 = ===3; same for participants with rankedP.

---

## 13. Suggested build steps (safe order)

1. **Scaffold** WinnersCeremony.tsx; copy the data layer (the fetch useEffect + memos) out of LeaderboardSection, and import { computeRanks } from '@/lib/missionUtils'. (Cleanest: extract a shared useLeaderboardData(eventId) hook so both the old and new screens use it.) Confirm numbers match the current screen before touching visuals.
2. Build the **stage + ambient background** layers (gradient wash, orbs, rays, sparkles, top strip, header, LIVE badge)  static first.
3. Add the **phase state machine** + timers + progress dots + replay, with plain placeholder phase content. Verify it advances and loops.
4. Implement phases in order: suspense  group champion (+count-up +confetti +applause)  group podium  group leaderboard  participant champion  participant podium  participant leaderboard  missions groups  missions participants.
5. Wire **applause** on phases 1 & 4 via useSound; keep SoundToggle.
6. Implement **loading / empty / error** states and the **no-groups** skip path.
7. Implement **responsive/fullscreen** (11) and test a cold load + resize.
8. Remove the old **Recent Activity** section and admin chrome from the display route.
9. QA against Winners Display Screen.dc.html for look, timing, copy, RTL.

## 14. Acceptance checklist (high level)

- [ ] Ranking numbers/order identical to the current LeaderboardSection (logic untouched).
- [ ] Full 9-phase sequence runs, cross-fades, and loops; champion phases feel dramatic.
- [ ] Groups vs participants clearly distinguished (gold/orange vs teal/gold), both fully celebrated.
- [ ] Top-3 podiums + full leaderboards + both "most missions" sections present and correct.
- [ ] Applause plays only on champion reveals; muteable; never throws if audio blocked.
- [ ] Recent Activity removed; no back/refresh/expand admin chrome (only mute + replay).
- [ ] Empty / loading / error states styled to match; no-groups path skips group phases.
- [ ] Cold load with no interaction fills and centers on a 16:9 display; re-fits on resize.
- [ ] RTL Hebrew correct; readable from across a room.

---

## 15. Definition of Done  do NOT stop until every box is checked

Go phase by phase. A partial build (e.g. groups only, or missing the missions sections) is **not** done.

**Data & logic**
- [ ] computeRanks imported from @/lib/missionUtils  not re-implemented, not modified.
- [ ] Same RPCs, point_transactions query, and pgMap as LeaderboardSection; leaderboard numbers match the old screen exactly.
- [ ] Memos rankedP, rankedG, hasGroups, taskCountByP, groupTaskCounts all present and used.

**Sequencer**
- [ ] All 9 phases exist and auto-advance on timers, then loop when autoLoop.
- [ ] Cross-fade between phases; champion phases (1 & 4) use the stronger zoom-in.
- [ ] 9 progress dots + " הצג שוב" replay work; timers cleared on unmount/replay.
- [ ] revealSpeed multiplier scales all durations.

**Phase 0  Suspense**: [ ] trophy + eyebrow + pulsing headline.

**Phase 1  Champion GROUP**: [ ] premium gold card, [ ] pulsing halo glow, [ ] crown + breathing avatar, [ ] huge name, [ ] **count-up** points, [ ] confetti, [ ] spotlight/rays, [ ] **applause fires once**.

**Phase 2  Top-3 GROUPS podium**: [ ] 1st centered/tallest with crown, [ ] 2nd & 3rd flanking with medals, [ ] staggered pop-in + pedestal rise, [ ] handles <3 entrants.

**Phase 3  Full GROUPS leaderboard**: [ ] all groups with points>0, [ ] top-3 highlighted, [ ] animated race bars, [ ] mission-count secondary metric, [ ] rows stagger in.

**Phase 4  Champion PARTICIPANT**: [ ] same as phase 1 but **teal-themed**, [ ] **applause fires once**.

**Phase 5  Top-3 PARTICIPANTS podium**: [ ] mirrors phase 2 for participants.

**Phase 6  Full PARTICIPANTS leaderboard**: [ ] all participants with points>0, [ ] each row shows its **group name** via pgMap.

**Phase 7  Most-missions GROUPS**: [ ] top-3 groups sorted by groupTaskCounts (descending), [ ] big mission-count numbers, [ ] "כי לא רק נקודות" framing.

**Phase 8  Most-missions PARTICIPANTS**: [ ] top-3 participants sorted by taskCountByP (descending), [ ] big mission-count numbers.

**Atmosphere (all required  this is what makes it feel live)**
- [ ] Animated gradient wash, [ ] 34 drifting blurred orbs, [ ] rotating light-ray fan, [ ] diagonal light sweep, [ ] floating sparkles, [ ] 8px festive top strip.

**States & chrome**
- [ ] Loading, empty (LeaderboardEmptyState), and error (ErrorAlert) states styled to match.
- [ ] hasGroups === false  group phases (13) skipped cleanly.
- [ ] Recent Activity feed removed; no back/refresh/expand controls; only mute + replay remain.

**Delivery**
- [ ] Cold load on a 16:9 display shows the whole composition centered, no interaction needed; re-fits on resize; a real Fullscreen toggle works.
- [ ] RTL Hebrew correct throughout; readable from across a room.
- [ ] Report back which boxes pass; if any fail, keep working until all pass.
