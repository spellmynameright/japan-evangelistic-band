# File map

walk/                 — "One Morning" walking prototype (2026-10-18) — separate from the main game, served at /walk/
walk/index.html       — prototype shell: canvas, HUD, talk card, notebook sheet, intro + noon summary
walk/walk.css         — prototype styles (light card UI over the canvas)
walk/js/main.js       — boot, render loop, tap-to-walk input, camera, pathing, interactions, NPC schedule watch
walk/js/state.js      — prototype state (clock, known words, items, flags) + TILE/NOON/MIN_PER_TILE constants
walk/js/maps.js       — town (Kunitachi sketch) + apartment maps, blocked(), findPath() BFS, npcPresent()
walk/js/render.js     — draws the pre-rendered art: ground bands, depth-sorted sprites + people, fade-when-behind, power lines, sign plaques (text is always game-drawn), tap marker, petals
walk/art/             — the art pipeline (Blender 4.2, run headless; in a cloud session download it from download.blender.org/release/Blender4.2/ into /home/user/tools — CPU renders take ~25 min for the town, ~2 min for the apartment, ~3 min for characters). Re-run it whenever maps.js changes:
                          node walk/art/export_maps.mjs
                          blender -b --python walk/art/build_scene.py -- town <tmp>      (then apartment)
                          python3 walk/art/split_layers.py <tmp> walk/assets/town
                          blender -b --python walk/art/build_characters.py -- <tmp_chars>
                          python3 walk/art/pack_characters.py <tmp_chars> walk/assets/characters
walk/art/export_maps.mjs     — writes art/maps.json from js/maps.js so Blender builds the exact walkable map
walk/art/maps.json           — generated; don't edit
walk/art/build_scene.py      — builds a map in 3D (houses, station, trees, poles…) and renders ground / objects / object-id passes
walk/art/split_layers.py     — cuts the renders into ground bands + per-object sprite atlases + art.json; colour grade lives here
walk/art/build_characters.py — chibi characters (player walk cycle ×4 directions, old man + pigeons, neighbor sweeping, cyclist)
walk/art/pack_characters.py  — packs character frames into characters.webp + characters.json
walk/assets/<map>/    — generated art for each map (ground-N.webp, sprites-N.webp, art.json)
walk/assets/characters/ — generated character sheet
walk/js/talk.js       — conversation/object scripts (node format documented at top), sign cards, word-locked choices
walk/js/words.js      — vocabulary (WORDS), START_WORDS, "{id}" markup parse()/wordsIn()/plain()
walk/js/hud.js        — clock/place HUD, toasts, notebook sheet, fade, noon summary
```
ROADMAP.md            — design direction, locked decisions, multi-step roadmap (Steps 1–7)
PROGRESS.md           — what's actually shipped, ideas backlog
CHARACTERS.md         — NPC bios (read before any NPC change)
data/actions.json     — action defs: timeCost, energyCost, energyReward, cost, reward, npcChance
data/timing.json      — timePerPhase, energyPerDay, faithPerDay, payday config
data/stories.json     — story beat text keyed by action + conditions (editable content)
data/reflections.json — end-of-day reflections; conditional shape (specific matches weight 3× catch-alls) — see Phase C condition keys
data/stageAdvances.json — text shown when an NPC advances to a new relationship stage (per NPC, per stage)
data/npcEvents.json   — scripted arc events + random texture pools per NPC (loaded by gameData.js)
data/dayBeats.json    — editorial day-beat phrases per phase (Direction D header)
data/README.md        — how to edit the JSON files
index.html            — full game shell (all DOM structure, all IDs)
css/style.css         — all styles (dark theme, cherry blossom + gold palette)
js/main.js            — entry point: boot, intro screen, startGame(), engine hooks
js/gameData.js        — loads data/*.json at startup
js/state.js           — single mutable state object (source of truth, imported everywhere)
js/engine.js          — event-driven engine: doAction, endPhase, endDay; hooks
js/save.js            — localStorage save/load/reset (key: 'tokyo_called_v2')
js/language.js        — JP→EN translation, XP thresholds, addLangXP(), TAB_LABELS, ACTION_DESC (dock card flavor)
js/resources.js       — spend/gain (incl. spendTime + spendEnergy + refillTime + refillEnergyDaily)
js/actions.js         — ACTION_DEFS, ACTION_UNLOCK, ACTION_VISIBLE, doAction, hasFittingAction
js/locations.js       — LOCATION_DEFS (incl. short + accent), LOCATION_ORDER, TRAVEL_COSTS, travelTo()
js/npcs.js            — NPC_DEFS (incl. line), getIntroText(), getStageAdvanceHint(), addNPCTrust()
js/recommend.js       — getRecommendation() → next-action hint behind the ★ dock card
js/dayBeats.js        — dayBeat()/weekdayFor() — picks the editorial header phrase per day+phase
js/stories.js         — getStoryBeat(actionId, state) → { text, rewards? }
js/reflections.js     — pickReflection() — picks end-of-day line matching state vs conditions
js/milestones.js      — MILESTONE_DEFS, checkMilestones() (called after each action + on new day)
js/journal.js         — addJournalEntry / getJournalEntries / markJournalRead
js/unlocks.js         — checkUnlocks() polls action unlock conditions and notifies on newly-unlocked actions
js/audio.js           — playTap/ActionComplete/Milestone/LevelUp/NPCMeet/Payday, toggleMute(); startStationAmbience()/stopStationAmbience()
js/ui.js              — Direction D rendering: stats bar, day-beat, scene, anchor, travel rail, dock,
                        people/journal overlays, setView() view-switching, all modals/popups; renderFrame() on rAF;
                        showTravelOverlay() (cinematic travel) + showGoHomeModal() (end-of-day go-home gate)
js/notifications.js   — sequential notification queue: events show one at a time, next blocks until current dismissed
js/version.js         — APP_VERSION (bump when deploying); hardRefreshApp()
js/parseDuration.js   — (legacy, unused — kept for possible future "real minutes" time UI)
manifest.json         — PWA config (display: standalone)
sw.js                 — caches all JS/CSS/HTML; bump CACHE version to match APP_VERSION; MP4/video files are bypassed
assets/images/npcs/   — NPC portrait images (kenji/yuki/hiro.png); kanji fallback if missing
assets/video/shinjuku.MP4 — looping 10s video of Shinjuku Station; used as animated background + ambient audio source
assets/video/travel.MP4   — train-interior clip for the ~5s travel-transition overlay (TRAVEL_VIDEOS in ui.js; add more clips here for variety)
```
