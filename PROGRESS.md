# JBE — Progress

Status of what's shipped + ideas backlog. Architecture lives in `CLAUDE.md`. Design direction lives in `ROADMAP.md`. NPC bios live in `CHARACTERS.md`.

---

## Shipped systems — status

| System | Mechanics | Content | Played? |
|---|---|---|---|
| Phase + time + energy engine (Step 1) | ✅ | n/a | ✅ |
| Travel + location system | ✅ | n/a | ✅ |
| Notification queue | ✅ | n/a | ✅ |
| Journal tab | ✅ | n/a | ✅ |
| Stage-advance notifications (upgraded to sakura modal in v33) | ✅ | ⚠️ first draft | ✅ |
| NPC reveal system | ✅ | n/a | ✅ |
| Story popups (90+ beats) | ✅ | ⚠️ text not reviewed | ⚠️ |
| Language barrier UI | ✅ | ⚠️ text not reviewed | ⚠️ |
| NPC language-tiered trust (langWeight) | ✅ | n/a | ⚠️ balance untested |
| Stat multipliers (lang→contacts, wisdom→faith) | ✅ | n/a | ⚠️ balance untested |
| Portrait system | infrastructure only | ❌ no real images | n/a |
| Immersive scene UI — floating button + bottom sheet (v20–v28) | ⛔ superseded by Direction D (v36) | n/a | ✅ |
| NPC mood/stress/burden system (Step 2, v29) | ✅ | ⚠️ first draft | ❌ not yet |
| Character-specific deep action names (v30) | ✅ | n/a | ❌ not yet |
| Variable outcome rewards — pray/preach/study (v30) | ✅ | ⚠️ first draft | ❌ not yet |
| Conversion popup — Stage 5 gold modal (v30) | ✅ | ✅ | ❌ not yet |
| Negative outcomes + spiritDry + setback popup (Phase A, v32) | ✅ | ⚠️ ~18 beats — needs play-tuning | ❌ not yet |
| Stage-advance sakura modal + warm chord (Phase B, v33) | ✅ | n/a | ❌ not yet |
| npcStateShift card with portrait (Phase B, v33) | ✅ | n/a | ❌ not yet |
| Story popup mood/stress/burden shift row (Phase B, v33) | ✅ | n/a | ❌ not yet |
| NPC flag system + lastBeatByAction (Phase C, v34) | ✅ | ⚠️ 1 demo callback (Yuki) | ❌ not yet |
| Conditional reflections — keyed on day events (Phase C, v34) | ✅ | ✅ 15 new lines | ❌ not yet |
| Discipleship — stages 6–8 (Disciple/Servant/Elder) per NPC (Phase D1, v35) | ✅ | ✅ 9 stage moments | ❌ not yet |
| 3 disciple_* actions w/ pre-conv hide + REQUIREMENT_BUILDERS (Phase D1, v35) | ✅ | n/a | ❌ not yet |
| Elder modal — sakura+gold ring + playElderChord (Phase D1, v35) | ✅ | n/a | ❌ not yet |
| Disciple story beats — 27 beats across 3 NPCs × stages 5–8 (Phase D1, v35) | ✅ | ⚠️ first draft | ❌ not yet |
| **Direction D UI redesign — full-bleed scene, day-beat, anchor card, dock, seg-nav (v36)** | ✅ | ✅ | ❌ not yet |
| Stats bar = 5 cells (Faith/Energy/Wisdom/Language/Support); contacts moved to People (v36) | ✅ | n/a | ❌ not yet |
| ★ Recommendation engine + dock card / travel-pill ring (v36) | ✅ | n/a | ❌ not yet |
| Editorial day-beat header + dayBeats.json phrases (v36) | ✅ | ✅ 20 lines | ❌ not yet |
| Cinematic travel overlay — ~5s train video on every trip (v37) | ✅ | ✅ 1 clip (travel.MP4) | ❌ not yet |
| Go-home end-of-day gate — must travel home before the day ends (v37) | ✅ | ✅ | ❌ not yet |
| **Walking prototype "One Morning" (`walk/`) — Kunitachi map, tap-to-walk, readable signs, word-locked choices, Hiro + neighbor schedules** | ✅ prototype | ⚠️ placeholder art | ❌ not yet |

---

## Polish backlog (small open fixes)

- **Station video asset** — code for video background + ambient audio is wired (v24) but current shinjuku.MP4 doesn't loop well. Need a better video clip, or decide on a different approach (still image? looping GIF? different scene?). Infrastructure stays; just swap the asset.
- **Touch targets** — ✅ done in v36 (⚙ gear + ✕ settings-close are now 44px). Re-audit any remaining small hit areas on iPhone.
- **Faith balance** — faith regen feels fast enough that costs are trivial; consider raising costs or slowing regen
- **Payday countdown** — no way to know when support arrives; add "Support in X days" somewhere
- **Travel popup skip/off toggle** — v37 ships the ~5s travel video as always-full / not-skippable. Add a Settings toggle (and/or tap-to-skip) once it's been played enough to know the right default. More travel clips can be added to `TRAVEL_VIDEOS` in `js/ui.js` for variety.

---

## Ideas captured (not yet started)

*Jacob's design notes. Order is roughly by dependency.*

**NPC backstory & future church role** — Each NPC arc should hint at their eventual role: Kenji → elder/leader, Yuki → theologian/teacher, Hiro → pastoral heart. Plant seeds in deeper story beats now.

**Cultural Understanding as a stat** — Separate from Wisdom, or part of it? Affects how NPCs respond, what actions unlock, story variations. Makes Wisdom feel richer.

**Branching / sequential story system** — Currently one beat per action per condition match. Future: branches based on choices, or sequential beats that build. Approach landed on: conditional text table (Hades-style) — ~200–300 sentences that recombine based on state. Full branching trees = much larger commitment, do separately.

**NPC speech progressively more readable** — At low language level, NPC dialogue is mostly Japanese text you can't parse. As language rises, the text literally changes. Already done for first-meet intros; apply to story popup text. The `langMin` condition already supports this.

**Stats should change what's *possible*, not just effectiveness** — High wisdom unlocks a different "Pray" beat; high language → NPCs say things they wouldn't at lower levels. Condition system already supports this; just needs content.

**Name change?** — deferred. Keep "Japan Evangelistic Band" for now.

---

## NPC portrait assets (still wanted)

System ready — just drop files in `assets/images/npcs/`. Needed:
- `kenji.png` — Salaryman, 34, weary but kind
- `yuki.png` — University student, 21, curious and earnest
- `hiro.png` — Retired man, 68, quiet grief, dignity

Free sources: https://itch.io/game-assets/free/tag-visual-novel · https://opengameart.org/content/npc-characters · prioritize consistent art style + CC0/free-use license.
