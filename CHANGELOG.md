# Changelog

All notable changes to OpsDesk. Versions follow [semver](https://semver.org); the data schema is versioned separately (currently v1) and only changes when stored data would need migration.

## 3.0.0 — 2026-09-02

**The slim-down.** Nine tabs was too much to track; five is the point. Breaking release: two modules removed outright.

### Removed
- **Ledger** (money) and **Pipeline** (job hunt) — deleted from the app at the user's request. Existing workspaces keep any old entries in an invisible `archive` section of the data document (it travels with backups; delete it from an exported file or Start blank to purge). Old `#/ledger` and `#/pipeline` links redirect home.

### Changed
- **Projects + Desk merged into one Tasks tab** — projects with highlighted next actions on top, loose to-dos below, and the lesson-powered knowledge base as its *Solved & saved* tab. Old routes redirect; module toggles migrate automatically.
- **Study handles multiple plans** — each track (Network+, CCNA, anything) is a card with its own topics, progress, weekly minutes, and exam-date countdown; topics and study sessions are filed per plan (existing content migrates into a first plan). One daily minutes target still drives the day score.
- **Lean dashboard** — score + tap-to-check habits, streak + 14-day dots, next actions, and activity. The compound curve and weight chart now sit behind a collapsed **Trends** toggle; the tiles row and removed-module cards are gone.
- Settings shows **when you last backed up**; exporting stamps it.

## 2.1.0 — 2026-09-02

The score learns nuance: check-off habits join the calculation, and being over or under target now **adjusts the score accordingly** instead of pass/fail.

### Added
- **Daily habits** — your own check-off goals (seeded with steps / bedtime / water), one point each, tap-to-toggle chips on the dashboard, managed via the *Habits* button or the command palette. Checks are part of the day score and the compound curve.
- **Green bar setting** — choose what keeps a day: 50% *showing up* (new default), 75% *solid*, or 100% *all or nothing*.

### Changed
- **Graded scoring.** Every component now scores 0–1 instead of hit/miss: calories earn full credit inside a goal-aware band (cutting tolerates under-eating, bulking over-eating) and fade linearly outside it; protein scores logged ÷ 90%-of-target; supplements score the fraction taken (2 of 3 = 0.67); study scores minutes ÷ target **with an overshoot bonus up to 1.25**.
- **Graded compounding.** A kept day multiplies by 1% × its score (×1.010 perfect, ×1.0125 max overshoot) rather than a flat ×1.01. Days under the bar still never punish.
- Today's score displays as a percentage with fractional points; chips show ✓ / ◐ / · states with live numbers; Fuel's history badges use the same graded macro score ("on plan" / "close · 74%" / "off plan").

## 2.0.0 — 2026-09-02

OpsDesk grows from an IT-life tracker into a **goals engine** built on the 1%-per-day theory: projects, training, food, and study flow into one dashboard that scores every day automatically from what you log — guidance without micromanagement.

### Added
- **Projects** — outcomes broken into steps; each project surfaces exactly one *next action* (on the dashboard too); ticking steps feeds the activity feed.
- **Training** — weekly routine with presets (Push/Pull/Legs, Upper/Lower, Full body) showing what today is; sets × reps × weight logging with dynamic exercise rows; cardio sessions; body-weight check-ins (lb or kg) with a trend line; automatic PR table (estimated 1RM via Epley).
- **Fuel** — calorie **plan maker** (Mifflin-St Jeor + activity + goal → kcal/protein/carbs/fat, explained in plain words, recalculable) or manual targets; one daily log of protein/carbs/fat plus a supplement checklist (creatine, vitamins — your list); 14-day history with tolerant *on plan* badges (±10% kcal, protein ≥ 90%).
- **Study targets** — a daily minutes goal, quick session logging, and week totals; feeds the day score.
- **The 1% dashboard** — Today's score (auto-derived, component chips), day streak + best, a 14-day consistency strip, and the **compound curve** (every kept day ×1.01). Rest days count as kept; unconfigured areas don't count against you. Cross-module next actions and a unified activity feed (workouts, meals, weigh-ins, study, project steps, tickets, money, applications).
- New chart primitives: line chart (weight, compound curve) and day-dot strip.
- Command palette: new quick actions (log food / workout / weigh-in / study) and search over projects and workouts.

### Changed
- Navigation now leads with the goals cluster: Projects, Training, Fuel, Study — then Lab, Desk, Ledger, Pipeline. All eight modules toggleable in Settings.
- Welcome screen and demo data updated: the pro demo now includes three weeks of training, nutrition, weigh-ins, study sessions, and two projects, so the 1% dashboard demonstrates itself.
- App identity: "1% better every day."

## 1.2.0 — 2026-09-02

## 1.2.0 — 2026-09-02

For everyone who isn't an IT person: OpsDesk no longer assumes you know what a debit or a DMZ is.

### Added
- **Welcome screen** on first run: choose *Keep it simple* (everyday starter, plain language) or *The full IT department* (demo homelab, pro terms). Existing users never see it.
- **Simple mode**: sidebar reads Home / To-dos / Money / Job hunt / Learning; money is entered as **"I spent money" / "I got paid" / "I moved money"** (how much, on what, paid with) while still writing correct double-entry books underneath; to-dos use plain questions ("What needs doing?", "Worth remembering"); the trial balance is replaced by a **"Where it went"** category breakdown; IT-only features (command vault, drills, lab) step out of the way.
- **Module toggles** (Settings → Experience): turn Lab, Desk, Ledger, Pipeline, or Study on and off — navigation, dashboard, and the command palette all follow.
- Simple starter data: everyday accounts, three worked examples, and one "Try me" to-do that teaches the money form.
- Settings gains **Load simple starter** alongside the IT demo and Start blank.

### Changed
- Mode and module choices survive Start blank and backups; switching modes never touches your data.

## 1.1.0 — 2026-09-01

## 1.1.0 — 2026-09-01

### Added
- **Command palette** (`Ctrl+K` or `/`): one search over every module — VMs, zones, tickets, KB text, accounts, transactions, applications, modules, certs, commands — plus navigation and quick "new …" actions. Enter jumps straight to the record.
- **Interview drill** (Study): resolved tickets are dealt as behavioural-interview practice — answer out loud, then check yourself against your own cause/fix/lesson write-up.
- **Ledger CSV export**: all transactions as UTF-8 CSV (with BOM, so Excel behaves), ready for Sheets or real accounting software.
- **Installable PWA with offline support**: web manifest, icons, and a network-first service worker. Install from Chrome/Edge on the live site; keeps working with no connection.
- Dashboard greeting with your name (set it in Settings) and today's date.
- User guide at `docs/guide.md`.

### Changed
- "Drill" renamed **Command drill** to sit beside the new Interview drill.
- Focus returns to where you were when a dialog closes.
- Settings' About panel shows the app version and the `Ctrl+K` hint.

### Fixed
- Job-pipeline funnel bars rendered invisible (inline element ignored its width).
- Ticket numbers no longer wrap mid-number in tables.
- Sample data left the Cash account negative — the demo now funds Cash with an ATM withdrawal before spending from it.

## 1.0.0 — 2026-09-01

Initial release: Dashboard (KPI tiles, 6-month cash-flow chart, job funnel, activity feed), Lab (VM fleet, network zones, firewall policy matrix with one-sentence reasons), Desk (numbered incident/task tickets; resolved tickets with lessons become KB articles), Ledger (double-entry accounts, transactions, trial balance), Pipeline (applications by stage with activity log and resume-version tracking), Study (curriculum modules, cert tracker, command vault with drill), Settings (theme, JSON export/import, reset). Zero dependencies, zero build, light + dark themes, data in localStorage.
