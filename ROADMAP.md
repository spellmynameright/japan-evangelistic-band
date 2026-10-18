# JBE — Roadmap

**Status as of 2026-05-24:** The project is pivoting from a real-time timer/idle engine to a turn-based **phase + energy simulation** inspired by Dwarf Fortress. This document is the durable record of that direction. Update it whenever a roadmap-level decision changes.

Read `CLAUDE.md` for code/architecture rules. Read `PROGRESS.md` for what's actually shipped. Read `CHARACTERS.md` for NPC bios. This file is the **direction** layer that sits above all three.

---

## 1. Why the pivot

**Pain point:** Real-time timed actions (15–90 seconds each) feel slow and boring on iPhone, even after pacing tweaks. The "idle game" feel doesn't fit a contemplative missionary theme — waiting for a bar to fill isn't authentic to the experience the game is trying to represent.

**Vision:** Move toward a **simulation-driven missionary life** — choices that resolve immediately, Energy as the limiter instead of time, NPCs with hidden inner states that change, locations with dynamic conditions, and emergent stories that combine authored beats with procedural conditions. Inspired by Dwarf Fortress's "losing is fun" / "stories emerge from systems" philosophy, but with the authored heart kept intact.

**Constraints that don't change:**
- Authentic to real missionary life in Japan (Jacob's lived experience)
- Mobile-first PWA on iPhone via GitHub Pages
- Pure vanilla JS / no build step / no framework
- Authored story beats remain — procedural layer is additive, not replacing

---

## 2. Source of the direction

The pivot was sketched in a conversation with Grok (originally captured in `Grok design conversation.md`, since deleted because summarized here).

**Grok's key proposals adopted:**
1. **Remove or minimize timers** — actions resolve immediately
2. **Energy / Spiritual Vitality as the limiter** instead of wall-clock time
3. **Daily cycle** with Morning / Afternoon / Evening phases
4. **Deeper NPC simulation** — hidden moods/needs, not just trust counters
5. **Procedural + authored stories** — outcomes depend on stats + NPC state + environment + past choices
6. **Dynamic location conditions** — weather, crowd level, time of day
7. **Apartment / base-building lite** — upgrade your space to host gatherings
8. **End-of-day reflection** — quiet summary screen, on-theme for the missionary experience

**Grok's framing on the middle ground we want:**
> "Keep your authentic missionary heart and NPC depth while borrowing DF's simulation spirit for more emergence and reduced grind."

---

## 3. Design decisions (locked in during 2026-05-24 planning)

These were resolved through Q&A. They are the ground rules for Step 1 and most of what follows.

| Decision | Choice | Rationale |
|---|---|---|
| Day structure | 3 phases (Morning/Afternoon/Evening) × Energy budget per phase | Phases give narrative rhythm; Energy lets the player do multiple lightweight things per phase |
| UI flow | Activity cards include their location; bottom location tabs removed | Phase becomes the primary mental model, not location |
| Dual resources | Time (per-phase) + Energy (per-day) | Time gates phase length; energy gates daily total. Different ratios on different actions force real choices. |
| Time refill | Refills at the start of each phase | Each phase has its own time budget — independent of energy |
| Energy refill | Refills ONLY at start of new day | Saving energy actually compounds across phases (fixes "no point saving" issue) |
| End of day | Explicit reflection screen | Surfaces emergent events; matches missionary theme |
| Phase end | Explicit "End Phase" button + auto-end when time hits 0 | Time, not energy, drives phase boundary |
| Phase skip | Allowed (End Phase with zero actions taken) | Freedom to skip ahead |
| Action animation | Brief 0.5–1s flash | Responsive feel without timer wait |
| Saves | Wipe on `meta.version < 2`; graceful migration within v2 | Early playtesting — clean break is fine |
| Time budget | 6 time units per phase (tunable in `data/timing.json`) | Abstract units; can map to real-world minutes later without changing model |
| Energy budget | 14 energy per day (tunable) | Roughly 7–9 actions per day at average cost; forces tradeoffs |
| Rest action | Costs 3 time + 0 energy, gives +3 energy | Half-a-phase commitment for real recovery; can't be spammed because of time cost |
| Pray as filler | 1 time + 0 energy + small faith | Always-available "quiet moment" action; absorbs leftover time naturally |

---

## 4. The multi-step roadmap

Build incrementally. Don't one-shot. Pause between steps to validate.

### Step 1: Phase-based day engine + Energy ← **CURRENT**

Replace the real-time tick engine with a turn-based phase engine. Introduce Energy as the per-phase limiter. Keep all existing actions, NPCs, stories, milestones — they just resolve instantly with an energy cost instead of a timer.

**Why first:** The wall-clock action timer is the spine of the current engine. Until it's replaced, no other DF-style system has a "when does it happen" hook to attach to. NPC moods, weather, world events, persecution, base-building — all need a turn-based clock to fire on.

**Architects in advance** (empty placeholders for future steps):
- `state.world` (empty object) — future weather + events
- `state.npcs.*.lastSeenDay` (null) — future mood/decay computation
- `hooks.onBetweenPhases` / `hooks.onEndOfDay` — empty wiring for future systems

**Out of scope for Step 1:** NPC moods, procedural stories, weather, base-building, multi-district, persecution.

### Step 2: NPC moods + life events ← **SHIPPED v29 (first pass)**

Add hidden emotional state per NPC: `mood`, `stress`, `burden`. Stats change only from real events — never from blanket timers.

- **stress** (busyness): blocks visits, reduces trust. HIGH stress = they're too distracted.
- **burden** (weariness/need): opens gospel. HIGH burden = more receptive. "Come to me, all who are weary."
- **mood** (-5 to +5): warmth in the relationship. Changed by visit quality and life events (both positive and negative).
- **Visit quality**: visits aren't automatically good. A stressed NPC with low player language = mood can drop.
- **Life events**: scripted arc events (2-3/NPC, fire once on conditions) + random texture (sparse, silent).
- **Story conditions**: `moodMin/Max_*`, `stressMin/Max_*`, `burdenMin/Max_*`, `daysNotSeenMin_*` — all extend the existing condition system in `stories.js`.
- **Trust scaling**: stress reduces from all visits (×0.6 at max stress); burden boosts deep visits only (×1.5 at max burden).

State: `state.npcs[id].{ mood, stress, burden, firedEvents[] }`. Data: `data/npcEvents.json`. No UI changes — system is invisible, expressed through story beats and end-of-day toasts.

### Step 3: Procedural story layer

Extend the condition vocabulary in `data/stories.json` to support new keys: `moodMin_X`, `weatherIs`, `phaseIs`, `consecutiveDaysSeen_X`, etc. Story selection logic in `js/stories.js` learns to score matches by specificity (more conditions matched = better fit) rather than pure random. Authored beats stay — just more combinations now produce unique moments.

### Step 4: Dynamic location conditions

Roll `state.world` each morning: weather (`sunny` / `rainy` / `snowy` / `humid`), crowd level per location, time-of-year flavor. Affects action outcomes (rainy day at station = fewer contacts but deeper conversations; festival day at park = high crowds, lots of contacts but no deep moments).

### Step 5: Apartment improvements (first base-building loop)

Spend money on apartment upgrades: better study chair (+wisdom bonus), prayer corner (+faith regen), hosting space (unlocks "host friend for dinner" actions), language tapes (+lang XP per study). Visible "your apartment" view that gradually fills with detail. First taste of meta-progression beyond personal stats.

### Step 6: Second district

Duplicate the location + NPC pattern to a new area (e.g., Akihabara or Shibuya). Travel between districts costs Energy. Tests whether the foundation scales — if Step 1 was architected right, this should be mostly content work, not engine work.

### Step 7: Persecution / hardship events

Fired from `onEndOfDay`. Visa anxiety, opposition from a shrine priest, a contact's family pulling them away, your own spiritual dryness. Force tough choices and surface real missionary stress. This is where the "losing is fun" DF feel finally arrives — setbacks become as memorable as wins.

### Outcome/notification depth — Phase A (SHIPPED v32) + Phases B–C (planned)

Independent of Steps 3–7, this track expands the **complexity of outcomes, notifications, and story beats** — adding real downside, player-side inner state, and richer feedback. Phase A shipped 2026-05-26. Phases B–C are designed and queued.

**Phase A — SHIPPED v32 (2026-05-26):**

- **Negative rewards.** `applyRewards()` in `actions.js` and `gain()` in `resources.js` now accept signed deltas (stats floor at 0). New `lose(stat, amount)` clarity mirror.
- **`penalty` field on story beats.** New beat-level field, distinct from `rewards`. Apply via `applyPenalty()`. Schema: `{ faith?, wisdom?, contacts?, spiritDry?, trust?: {id, amount}, npcMood?: {id, amount}, npcStress?: {id, amount}, npcBurden?: {id, amount} }`. Stat magnitudes are positive numbers (deducted); NPC mood/stress/burden are signed.
- **NPC trust loss with stage floor.** `addNPCTrust()` accepts negatives but never drops below the current stage's threshold — NPCs cool off, they don't forget you.
- **`state.character.spiritDry` (0–10).** Player-side inner state. Ticks up from penalty beats and zero-contact days; comes down with `pray` (−1), `rest` (−1), `onsen_visit` (−2). When `spiritDry >= 6`, the story picker doubles the weight of penalty beats on preaching/tract/study actions ("the words feel hollow"). Subtle ⛅ HUD indicator shows at ≥5.
- **New story condition keys.** `wisdomMax`, `contactsMin`, `contactsMax`, `spiritDryMin`, `spiritDryMax`.
- **~18 new authored beats** across 12 actions, covering hostile crowds, low-language stumbles, stressed-NPC visits, shrine etiquette mistakes, empty English events, and dry-spell hollowness.
- **Setback feedback.** Story popup now renders a red chip-row under the green reward row showing what was lost. `playSetback()` plays a descending minor third when a beat has a penalty. Journal logs every setback (`type: 'setback'`, icon ⛅).
- **Save migration.** `v32` adds `character.spiritDry` defaulting to 0 on load; no save wipe.

**Phase B — Richer notifications (SHIPPED v33, 2026-05-28):**

- ✅ **`stageAdvance` notification type** — sakura-ringed modal for stages 1–4. Dedicated `showStageAdvanceModal` in `ui.js` mirrors `showConversionModal` but with a softer sakura ring instead of gold. Stage 5 (Believer / conversion) still uses the gold conversion modal + milestone sound.
- ✅ **`playStageAdvance()`** — warm major-7 arpeggio (G4/B4/D5) softer than `playMilestone`. Plays alongside the sakura modal.
- ✅ **`npcStateShift` notification type** — bottom-anchored card with NPC portrait + name eyebrow + headline + description. Replaces the 3 generic threshold toasts in `checkNPCEndOfDay` (mood pulling back, burden ready, Kenji crushed by work).
- ✅ **Story popup mood delta** — every NPC visit/deep action snapshots mood/stress/burden before rewards run, then shows the delta as a sakura-tinted chip row under the rewards/setback rows. The player can finally see what visits do to inner state.
- ⏭ **`letter` notification type** — deferred. Will land alongside Step 7 (persecution / hardship arcs) so the renderer ships with real content rather than as dead infrastructure.
- ⏭ **Animated chip transitions** — deferred. Pure polish; no gameplay impact.

**Phase C — Carryover + reflections (SHIPPED v34, 2026-05-28):**

- ✅ **Tiny per-NPC flag system.** `state.npcs.<id>.flags = {}` stores the day each flag was set. A beat sets one with `"setsFlag": "left_early"` (implicit on the action's own NPC), consumes with `"clearsFlag": "left_early"`. Other beats gate on it with `"flagSet_<npcId>": "left_early"` (explicit, cross-NPC reads supported). First demonstration: Yuki's "She closes her notebook early" penalty beat now sets `left_early`; the next visit fires a one-time callback ("Last time — sorry…") that consumes it.
- ✅ **`lastBeatByAction`.** New `state.flags.lastBeatByAction = { actionId: beatId }` written by `actions.doAction` whenever a beat with an explicit `id` fires. New story condition: `prevBeatId_<actionId>: "beat_id"`.
- ✅ **Conditional reflections.** `data/reflections.json` is now `{ reflections: [{ conditions, text }] }` with the same specific-3×-over-catch-all weighting as stories.js. New picker condition keys: `dayMin/Max`, `spiritDryMin/Max`, `contactsTodayMin/Max`, `paydayToday`, `setbackToday`, `langLevelUpToday`, `noActionsToday`, `hadDeepVisitToday_<npcId>`. State.dayLog now carries `startContacts`, `paydayToday`, `setbackToday`, `langLevelUpToday` flags written by engine.endDay + actions.doAction + main.onLangLevelUp. Shipped with 15 new conditional reflections (paydays, setbacks, level-ups, contact-heavy/empty days, deep visits per NPC, dry days, day-30/60 milestones) alongside the existing 10 catch-alls.

### Beyond Step 7 (long-term ideas, no commitments)

- Co-worker / spouse NPC who interacts WITH you across phases (not just on visits)
- Inter-NPC interactions (Kenji mentions Yuki to you, invites Hiro to study)
- Church planting: appoint an elder, district runs semi-independently
- Multiple cities (Osaka, Kyoto, Sapporo)
- Real illustrated location art (currently CSS gradients)
- Real NPC portrait images (currently kanji fallback)
- Prayer request system, home church relationship system, BGM

---

## 5. Architectural principles to preserve through every step

These are why the foundation matters. Step 1 enforces them. Every subsequent step must honor them.

1. **State as single source of truth.** All systems mutate one `state` object. New fields are added to state, not stored elsewhere.
2. **Hooks for emergence.** New systems plug into the existing engine via hooks (`onBetweenPhases`, `onEndOfDay`, `onActionComplete`, `onNewDay`, `onMilestone`, `onNPCMeet`). Don't bypass them.
3. **Authored content stays authored.** Procedural layers combine authored beats — they never replace them. `stories.json` remains hand-written.
4. **Data over code.** Tuning lives in `data/*.json` (actions, timing, stories, reflections, future: weather, moods). Code defines mechanics; data defines balance.
5. **Mobile-first.** Every UI change is tested on iPhone before merge. Touch targets ≥ 44px. No hover-only states.
6. **Authenticity is the spine.** When in doubt, ask: "does this match a real missionary experience in Japan?" If not, cut it or rework it.

---

## 6. Decision log

Append new entries here as roadmap-level decisions are made. Date format YYYY-MM-DD.

- **2026-05-24** — Pivoted from real-time timer/idle to phase + energy simulation (this document). Locked decisions in Section 3. Step 1 plan written.
- **2026-05-24 (later same day)** — Step 1 refinement after first playtest: introduced **Time** as a per-phase resource alongside **Energy** as a daily resource. Fixed two issues — (1) `rest` could loop infinitely because it had no real cost, (2) per-phase energy refill made conservation pointless. New model: actions cost both time and energy; rest costs time (half a phase) but recovers energy; pray is the 1-time / 0-energy "filler" action. Phase auto-advances when time runs out (with a toast). Bumped APP_VERSION to 16. Save format still v2 — gracefully migrates by initializing missing fields.
- **2026-05-26** — Shipped Step 2: NPC moods + life events (v29). Added `mood`, `stress`, `burden` per NPC; scripted arc events + random texture in `data/npcEvents.json`; visit quality formula (stressed NPC + low language = mood can drop); trust scaling from stress/burden; 7 new story condition types; ~20 new story beats across all NPC visit/deep actions. Design decision: stress and burden are spiritually opposite (stress blocks, burden opens — "come to me, all who are weary"). Event-driven only — no blanket timers. Scales cleanly to many NPCs.
- **2026-05-26 (v30)** — Three improvements from TODO triage: (1) Renamed generic `deep_*` actions to character-specific IDs (`evening_kenji`, `questions_yuki`, `pray_hiro`) with narrative names and icons matching each character's arc. `NPC_ACTION_MAP` in `actions.js` replaces fragile ID-prefix regex for portrait/lastSeenDay lookups. (2) Variable outcome rewards: `getStoryBeat()` in `stories.js` returns the full beat object; if a beat has `rewards`, those override the action's blanket reward. `pray`, `study_scripture`, and `open_air_preach` now have outcome ranges from nothing (dry prayer, hostile crowd) to significant bonuses. NPC trust is unchanged — only non-trust rewards vary. (3) Conversion popup: when an NPC reaches Stage 5, a dedicated gold-bordered full-screen modal fires instead of a regular story popup — `✝️` icon, gold portrait ring, NPC name in gold, "Bear Witness" button. Partially shipped Step 3 (procedural story layer via variable rewards).
- **2026-05-26 (v32)** — Shipped **Phase A** of the outcome-depth track: real player-stat penalties (faith/wisdom/contacts can now drop), NPC trust loss (with stage floor), `state.character.spiritDry` (0–10) as player-side inner state, ~18 new authored beats with `penalty` fields covering hostile preaching, low-language stumbles, stressed-NPC visits, shrine etiquette mistakes, and dry-spell hollowness. Setbacks land as red chip-rows under the story popup with a descending-third sound and a journal entry. Phases B (richer notifications) and C (carryover + conditional reflections) are designed and documented in Section 4 for the next session. Decision: integrate setback chips into the existing story popup rather than a second dedicated popup — keeps UX clean while preserving the sound + visual + journal signal.
- **2026-05-28 (v33)** — Shipped **Phase B** of the outcome-depth track: stage advances (1–4) now fire a dedicated sakura-ringed modal (`showStageAdvanceModal`) with a new warmer `playStageAdvance()` chord — promoted out of the generic story popup. End-of-day NPC threshold moments (mood pulling back, burden ready, Kenji crushed) consolidated from generic toasts into a new `npcStateShift` notification with portrait + headline + description. Story popup gains a sakura-tinted shift row under the rewards/setback rows — every NPC visit snapshots mood/stress/burden before mutation and surfaces the delta so the player can see what their visit did to inner state. Letter renderer and animated chip transitions deferred (letter ships with Step 7 content; chip animations are polish-only).
- **2026-05-28 (v34)** — Shipped **Phase C** of the outcome-depth track: per-NPC flag carryover (`state.npcs.<id>.flags`) with `setsFlag` / `clearsFlag` on beats and `flagSet_<npcId>` in story conditions; `state.flags.lastBeatByAction` writes the last beat ID per action so beats can chain via `prevBeatId_<action>`; reflections.json promoted to conditional shape with 15 new context-aware lines keyed on day events (paydays, setbacks, level-ups, contact counts, deep visits, dry spells, day-30/60 markers). Day-event tracking lives in `state.dayLog` as `startContacts/paydayToday/setbackToday/langLevelUpToday` — set by `engine.endDay`, `actions.doAction`, and `main.onLangLevelUp`. First flag demonstration: Yuki's "closes notebook early" penalty beat sets `left_early`; her next visit fires a one-time apology callback that consumes it. Save migration adds the new fields without wiping. Outcome-depth track (Phases A→B→C) is now complete.
- **2026-05-28 (v35)** — Shipped **Phase D1** of the new **post-conversion depth track**: NPC stages extended from 6 to 9 (added Disciple/Servant/Elder); `addNPCTrust` ceiling lifted from stage 5→8, trust clamp 100→200; new per-NPC `roleProgress` counters (`servicesAttended` / `studiesCoTaught` / `othersShepherded`) act as Stage 8 (Elder) gates — counters stay at 0 until D3 (hostable events) ships, so Stage 8 is correctly unreachable until then. Three new `disciple_*` actions (`disciple_kenji` 🛡️, `disciple_yuki` 📖, `disciple_hiro` 🕯️) replace the pre-conversion deep actions once an NPC becomes a Believer (one deep action per NPC at a time — cleaner UI). New `reqStage` builder for unlock requirements. `showStageAdvanceModal` eyebrow now switches by stage ("Relationship deepening" / "Growing in faith" / "An elder rises"); Stage 8 adds a gold accent on the sakura ring + new `playElderChord` (fuller variant of `playStageAdvance` with octave bass + shimmer). 9 new stage-advance moments + 27 new authored story beats covering Believer→Disciple→Servant→Elder per NPC, all tied to each character's arc (Kenji's father / Yuki's grandmother / Hiro's Emiko + chrysanthemums). Disciple actions announce in the existing `unlocks.js` ANNOUNCEABLE list — the conversion modal has already fired by the time they unlock, so a fresh unlock toast is welcome. Save migration adds `roleProgress: {0,0,0}` per NPC for pre-v35 saves; no wipe. **Theology decision (Jacob):** all three NPCs are appointed Elder at Stage 8 (plural eldership reflects real NT church practice); their **giftings** differ (Kenji=organizational, Yuki=teaching, Hiro=pastoral, per CHARACTERS.md) and shape story beats now + will drive different passive effects in Phase D2. **Phase order locked:** D1 (this) → D3 (hostable events: host_potluck / host_bible_study / host_sunday_service) → D2 (Elder passive effects by gifting) → D4 (church entity + naming moment + organic NPC spawning at maturity). Building D3 before D2 because the host_sunday_service / host_bible_study events are what increment the `roleProgress` counters that gate Stage 8 — otherwise D2 ships passive effects "lit but unreachable." Endgame goal (D4): a self-propagating church that grows without your direct action; sets the hook for Step 6 (second district) via daughter-church planting.
- **2026-05-29 (v36)** — Shipped the **Direction D ("Immersive, Anchored") UI redesign** (handoff from a Claude design session; plan in `docs/redesign-direction-d.md`). Full-bleed location scene with a glass editorial **day-beat header** (Day · weekday · Zen Old Mincho phrase + phase kanji + time bar), an always-present **5-cell stats bar** (Faith · Energy · Wisdom · Language · Support), a Scene bottom zone of **travel-rail pills + "You are here" anchor card + horizontal action dock**, and a floating **segmented nav** (Scene / People / Journal). The old bottom-sheet + floating "↑ Activities" button + duplicated top-bar phase strip are removed — actions are always docked. **Jacob's decisions:** (1) Contacts dropped from the stat bar (moved to the top of the People view) so Language could take a permanent slot; (2) on People/Journal the day-beat is hidden and the stats bar pins to the very top (fixes day-text bleeding through the transparent overlay cards); (3) build the ★ recommendation rule (`js/recommend.js`): nearest trust-only breakthrough among met, not-yet-Elder NPCs, tie-broken by longest-since-seen, with rest/study/pray fallbacks — the dock stars it at-location, the travel rail rings its pill otherwise. New `data/dayBeats.json` + `js/dayBeats.js` (phase phrases); `ACTION_DESC` added to `language.js` for dock-card flavor; `LOCATION_DEFS` gained `short` + `accent`; two new fonts (Zen Old Mincho, Zen Maru Gothic). People "Visit" now navigates (Scene + travel) rather than auto-running the action. UI-only — no save-format change, no migration. APP_VERSION/sw cache → v36.
- **2026-05-29 (v37)** — Shipped two grounding additions (Jacob's request): (1) **Cinematic travel** — every trip now plays a ~5s full-screen train-interior video (`assets/video/travel.MP4`) via `showTravelOverlay`; all trips route through a new `main.runTravel()` helper (rail pills, People "Visit", and the new Go-Home button). Decision: full ~5s, **not skippable** for now (a skip/off toggle is queued); `TRAVEL_VIDEOS` array in `ui.js` is the seam for adding more clips for variety. (2) **Go-home end-of-day gate** — the day can only end from home. When the **evening ends** while away from home, `endPhase` sets `flags.pendingGoHome` + fires `onGoHomeReady` → a forced `goHome` modal (🌙 "It's getting late" + **Go Home**, no dismissal); trying any action re-surfaces it. The trip home is **free** (`travelTo(loc, free)` / `doTravel(loc, {free})` skip the time cost since the phase is spent); arriving home auto-fires the reflection. Evenings already at the apartment reflect immediately (unchanged). Save migration adds `flags.pendingGoHome` defaulting false; no wipe. APP_VERSION/sw cache → v37.
- **2026-05-24 (third update same day)** — Reversed the earlier "locations are flavor" call. **Travel is now real navigation.** `state.location` is where you ARE; actions filter by it. Travel costs time only (destination-based: home/station/shrine = 1, café/park = 2, onsen = 3). Each morning resets you to apartment. People-tab cards have Visit / Heart-to-Heart buttons that auto-travel before running the action. Same session also shipped: notification queue (fixes end-of-day-vs-popup race), Journal tab (replaces Goals, populated by milestones + meets + stage advances + lang level-ups), stage-advance notifications + per-stage moment text, and a "no conflicting cost+reward on same stat" rule. APP_VERSION bumped to 17.
- **2026-10-18** — **Exploring a from-scratch rethink: a walking game.** Jacob asked for a 10× rethink. Direction being tested: a top-down walkable neighborhood based on **Kunitachi** (where Jacob served), told over a **two-year term with an ending + extended free play afterwards**. Core ideas: (1) the world starts unreadable — signs/speech are Japanese and become readable as you learn words; (2) **words are the currency** — conversation options are locked until you know the words, so you can see what you *want* to say before you can say it; (3) NPCs keep schedules and lives you don't control (miss Hiro's bench time and he's gone); (4) time moves only when you do. Built a throwaway vertical slice, **"One Morning"** (`walk/`), with code-drawn placeholder art, to test whether walking feels better on iPhone before committing. The current game stays live and untouched. **Art plan if it proceeds:** build the town in 3D and render it to 2D ("miniature diorama" look): Tripo Studio for characters (same pipeline as the champion repo — Studio website via Claude in Chrome, no API), Blender scripts for props/buildings/style-unification/lighting/seasons, and Codex/image tools only for conversation portraits. Sign text is always rendered by the game, never baked into art (needed for the readable-signs mechanic). Decision pending on Jacob's iPhone playtest.
