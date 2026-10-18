# Japan Evangelistic Band — Claude Context

This file is the entry point for Claude. The auto-loaded companions are:

@ROADMAP.md
@PROGRESS.md
@CHARACTERS.md

**Read-on-demand docs (`docs/`)** — open the one the task touches:
- `docs/architecture.md` — engine, state shape, hooks, action flow, notification queue, time + energy, save versions
- `docs/files.md` — file map (what every file does)
- `docs/ui.md` — UI layout (DOM tree) + CSS design tokens
- `docs/gameplay.md` — locations, travel, actions, language, milestones
- `docs/npcs.md` — NPC system, language-tiered trust, stage thresholds, **New NPC checklist**
- `docs/stories.md` — story beats (fields, conditions, flags), journal, reflections
- `docs/recipes.md` — locked design decisions + "how to continue building" recipes

`TODO.md` is read on demand when Jacob says "process todo" — see the TODO workflow section below.

---

## Keeping docs in sync (IMPORTANT)

When a change ships in a session, update the matching doc **in the same session, before declaring done**. Don't let `docs/` drift from the code.

| If the change touches… | Update this file |
|---|---|
| State shape, hooks, engine flow, notification queue, save format | `docs/architecture.md` |
| Adding/removing/renaming a JS or data file | `docs/files.md` |
| DOM structure, CSS tokens, layout, new UI element IDs | `docs/ui.md` |
| Actions, locations, travel rules, language thresholds, milestone defs | `docs/gameplay.md` |
| NPC system code, stage thresholds, langWeights, NPC action conventions | `docs/npcs.md` |
| Story beat fields, story conditions, journal triggers, reflection conditions | `docs/stories.md` |
| New "how to extend" recipes, new locked design decisions | `docs/recipes.md` |
| Roadmap-level direction change or shipped roadmap step | `ROADMAP.md` (Section 6 decision log) + `PROGRESS.md` (Shipped table) |
| NPC bio, arc, personality, church role | `CHARACTERS.md` |
| **Anything else changes the project rules / coding guidelines / project entry-point info** | `CLAUDE.md` |

**Rule of thumb:** if a future Claude session would need to know about this change to do its job correctly, it must end up in one of these files — not just in the commit message. The commit message explains *why*; the docs are the durable *what*.

---

## About me

- Beginner — no coding experience. Prefer plain-language explanations.
- I work in the local folder `jbe` (GitHub repo: `trimmja/japan-evangelistic-band`).
- I lean on Claude for everything — planning, design, code, commits.
- Ask before pushing to GitHub unless I say to publish / push / save to GitHub.
- **Hosting & testing:** GitHub Pages — https://trimmja.github.io/japan-evangelistic-band/ (not `claude-mobile`). Mostly test on **iPhone**. Push then refresh; stale PWA → Settings → **Load latest update** or reinstall Home Screen shortcut.
- Real missionary experience in Japan — keep the game culturally authentic.

---

## Coding guidelines (AI)

Behavioral guidelines to reduce common LLM coding mistakes. **Bias toward caution over speed** — for trivial tasks, use judgment.

**Project rules:** plain-language explanations; ask before push; for balance changes, edit `data/*.json` → push → refresh on iPhone to verify.

**1. Think before coding** — Don't assume or hide confusion. State assumptions; present multiple interpretations; suggest simpler approaches; stop and ask when unclear.

**2. Simplicity first** — Minimum code for the ask. No extra features, single-use abstractions, unrequested configurability, or impossible-case error handling. If 200 lines could be 50, rewrite.

**3. Goal-driven execution** — Turn asks into verifiable goals (tests, repro steps, before/after checks). Multi-step work gets a short plan with a verify line per step. Prefer strong success criteria over "make it work."

**4. No conflicting cost+reward on the same stat** — Never define an action's `reward` in `data/actions.json` to both cost AND reward the same resource (e.g. `cost.faith: 5, reward.faith: 3` is forbidden — that's a net-negative on faith). Story beats in `data/stories.json` are the exception: a beat's `rewards` field CAN give faith back even if the action costs faith — that's the variable-outcome design. The ban is on the base `reward` object in `actions.json`. Caught once on `study_scripture` — don't reintroduce.

---

## What this project is
A PWA simulation game about being an American missionary in Tokyo, Japan.
Built by someone with real missionary experience in Japan — authenticity matters.
Playable on iPhone via GitHub Pages (Add to Home Screen as a standalone app).

**Game model:** Turn-based **phase + time + energy** simulation (NOT a real-time idle game). Each day has three phases — Morning / Afternoon / Evening. Each phase has a **time budget** (default 6 units); when time runs out the phase auto-advances. Across the whole day you have an **energy budget** (default 14) that refills only at the next morning. Every action costs both time AND energy in different ratios. See `ROADMAP.md` for the full design direction and the multi-step plan (Steps 1–7).

## Live game
Deploy via: GitHub repo → Settings → Pages → branch `claude/environment-selection-iphone-EohwW` → root
URL: `https://trimmja.github.io/japan-evangelistic-band/` (not `claude-mobile` — that URL 404s)

## Tech stack
- Pure HTML/CSS/Vanilla JS — no build step, no framework, no package.json
- ES modules (`<script type="module">`) — works on GitHub Pages as-is
- localStorage for save/load
- Web Audio API for procedural sounds (no audio files needed)
- PWA: `manifest.json` + `sw.js` service worker for iPhone "Add to Home Screen"

---

## TODO workflow

`TODO.md` is a frictionless brain-dump for bugs and ideas Jacob notices mid-play (especially on iPhone). It's a scratch pad, not a third progress log — it's expected to fill up between sessions and get cleared.

When Jacob says **"process todo"** (or "triage todo" / "clear todo" / similar), do this:

1. Read `TODO.md`
2. For each item, propose a triage:
   - **Fix now** — small bug or quick polish, do it this session
   - **Add to `PROGRESS.md`** — polish backlog item or new idea
   - **Add to `ROADMAP.md`** — direction-level decision or roadmap step
   - **Drop** — already done, duplicate, or not worth keeping
3. Confirm the plan with Jacob before moving anything
4. Apply the triage — write items into target files, then reset `TODO.md` back to the empty template (`## Bugs` / `## Ideas` headers, nothing under them)

Never auto-clear without confirmation. The point of triage is that Jacob sees each item get a home.

---

## Local testing

**Cloud sessions:** Playwright works (verified 2026-10-18). It's installed globally, so import it by path: `import { chromium, devices } from '<npm root -g>/playwright/index.mjs'`, serve the repo with `python3 -m http.server`, and screenshot with `devices['iPhone 13']`. Use it to check layout/flows before pushing — iPhone testing by Jacob is still the final word. (On Jacob's local machine, the older note in memory `feedback_no_playwright.md` may still apply.)

The render loop in `js/ui.js` wraps each render in `safeRender(name, fn)` so a single throw doesn't kill the loop. If Jacob reports `[render:Foo]` errors in the console, that's safeRender catching them — read the file and find the underlying error.
