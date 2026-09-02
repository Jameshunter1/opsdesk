# OpsDesk user guide

OpsDesk is a **local-first** app: everything you enter lives in your browser, on your machine. This guide walks through every module, the scoring engine, and how to keep your data safe.

- [Where your data actually lives](#where-your-data-actually-lives)
- [Two modes: Simple and Pro](#two-modes-simple-and-pro)
- [Getting around](#getting-around)
- [The 1% dashboard](#the-1-dashboard)
- [Tasks](#tasks)
- [Training](#training)
- [Fuel](#fuel)
- [Study](#study)
- [Lab](#lab)
- [Backups & moving machines](#backups--moving-machines)
- [Install it like an app](#install-it-like-an-app)
- [FAQ](#faq)

---

## Where your data actually lives

Worth understanding once, because it's unusual (in a good way):

- **GitHub Pages hosts the *code*** — static HTML, CSS, and JavaScript files. That's all the server ever serves; it cannot see, store, or receive your entries.
- **Your *data* lives in your browser's `localStorage`**, on your device, under the key `opsdesk.v1` — one JSON document holding every log, habit, plan, and setting. Nothing is ever transmitted; you can verify with DevTools → Network while using the app.
- **State management** is deliberately simple: every screen reads that one document and saves after every change, so there's no sync to break and no session to expire. A service worker caches the app itself, so it opens offline too.
- The flip side: data is **per-browser, per-site**. Edge and Chrome are separate workspaces; the live site and a local copy are separate workspaces. The bridge between them is the backup file — see [Backups](#backups--moving-machines).

## Two modes: Simple and Pro

On first run, OpsDesk asks what it should be for you:

- **Simple** — plain everyday language: *Home, Tasks, Workouts, Food, Learning*. To-dos ask "What needs doing?"; nothing assumes you're an IT person.
- **Pro** — ops vocabulary (tickets, modules) plus the homelab Lab tab, loaded with demo data.

Same data underneath; switch anytime in **Settings → Experience**, where you can also turn whole modules on or off.

## Getting around

Five tabs — **Dashboard, Tasks, Training, Fuel, Study** (+ Lab for homelabbers) — with Settings and the theme toggle at the bottom. Modules you've switched off simply don't appear.

The fastest way to anything is the command palette: <kbd>Ctrl</kbd>+<kbd>K</kbd> (or <kbd>/</kbd>) searches every record and carries quick actions — *Log today's food, Log workout, Weigh-in, Log study time, New project, Manage habits, Export backup*. <kbd>↑</kbd><kbd>↓</kbd> then <kbd>Enter</kbd>; <kbd>Esc</kbd> closes anything.

## The 1% dashboard

One idea: **get 1% better on the days you show up, and let it compound.**

**How a day is scored — graded, mostly automatic:**

| Component | Counts when… | Score (0–1 each) |
|---|---|---|
| Macros | you've made a food plan | Average of a calorie score and a protein score. Calories get full credit inside a goal-aware band (cutting tolerates under-eating to −20%, bulking tolerates over to +20%, ±10% otherwise) and fade toward 0 the further outside you land. Protein is logged ÷ (90% of target), capped at 1. |
| Supplements | your list isn't empty | The fraction you ticked — 2 of 3 taken scores 0.67. |
| Training | you've set a weekly routine | Planned day: 1 if a workout is logged. **Rest day: 1 automatically.** |
| Study | you've set a daily minutes target | Minutes ÷ target, with an overshoot **bonus up to 1.25**. |
| Habits | your habit list isn't empty | **1 point each, tapped off by hand** — the chips on the dashboard toggle on click. Manage the list via the *Habits* button. |

- **Green day** = your chosen share of points — the **green bar** in Settings: 50% *showing up*, 75% *solid*, or 100% *all or nothing*. Green days extend the **streak**.
- **The compound curve is graded**: a kept day multiplies you by 1% × its score (×1.010 perfect, up to ×1.0125 with overshoot). Days under the bar never punish — they just don't multiply.
- **Trends** (the compound curve and body weight) sit behind one toggle, collapsed by default. Numbers when you want them, calm when you don't.
- **Next actions** shows one step per active project plus your top open to-dos; **Recent activity** merges everything you've logged.

## Tasks

One tab answers "what should I do next?":

- **Projects** — anything with more than one step. Each active project highlights exactly its **next** unfinished step (here and on the dashboard); tick steps off, add new ones inline, give it a one-line *why* for the days motivation doesn't show up.
- **Loose to-dos** — numbered one-off items (`T-0001`, …) with priority and status: open → in progress → done. For problems, there's room for the symptom, the root cause, the fix, and the **lesson**.
- **Solved & saved** — every finished item that has a lesson becomes a searchable article: your own answer book. The Study tab's *interview drill* deals these back as practice questions.

## Training

- **Routine** — name each weekday (blank = rest) or tap a preset (Push/Pull/Legs, Upper/Lower ×4, Full body ×3). The week strip shows every day with checkmarks where you trained; rest days count as kept.
- **Workouts** — date, label (pre-filled with today's planned session), lifting (any number of exercise rows: sets × reps × weight) or cardio (minutes).
- **PRs** — best set per exercise with an estimated 1RM (Epley), computed automatically.
- **Weigh-ins** — quick entries in lb or kg; the trend line is what matters, not single days.

## Fuel

- **The plan maker** asks four things — body, age, height/weight, activity, goal — and computes daily calories (Mifflin-St Jeor × activity, then −20% to cut / +10% to build), protein (~0.8 g/lb), fat (25% of calories), carbs (the rest), each explained in plain words. *Recalculate* when your weight moves; *Edit targets* if you know your numbers.
- **The daily log** is one 20-second entry: protein, carbs, fat (calories compute themselves) plus a tick per supplement — creatine, vitamins, whatever's on your editable list.
- The 14-day history grades each day with the same math as the dashboard: *on plan*, *close · 74%*, *off plan*.

## Study

Built for working toward more than one thing at once:

- **Plans** — one card per track (*CompTIA Network+*, *CCNA*, *French*…), each with its own status, topic progress bar, minutes this week, and an **exam-date countdown**. Click a card to edit; deleting a plan keeps its topics and sessions, refiled under General.
- **Topics** — the curriculum table, filterable by plan. Each topic carries status, hours, details, and a **proof of work**: the demonstrable thing that says it's done.
- **The daily target** — one minutes-per-day number across all plans (pick one you can hit on a *bad* day). *+ Log study* records a session against a plan; hitting the target earns the study point, overshooting earns the bonus.
- **Drills** — the command vault quiz (Pro), and the **interview drill** that turns your solved Tasks into behavioural-question practice.
- **Certifications** — planned / studying / scheduled / passed, with dates.

## Lab

Homelab inventory for the IT-inclined: VM fleet (specs, zones, IPs, status, RAM-committed counter), network zones, and a firewall policy matrix where every rule needs a one-sentence reason and unset cells read as default-deny. Not your thing? Settings → untick Lab.

## Backups & moving machines

- **Settings → Export backup** downloads the entire workspace as one JSON file; **Import backup** restores it. Settings shows **when you last backed up** — glance at it now and then.
- Export before clearing browser data (that's the one way to lose localStorage), before switching browsers or computers, and after any big data-entry session.
- Two devices? No live sync by design (sync means servers and accounts). Export on one, import on the other.
- If your workspace predates v3 and had Money or Job-hunt entries, they're preserved invisibly in an `archive` section of the document — they travel with your backups, and deleting that section from an exported file (or starting blank) purges them for good.

## Install it like an app

From the live site, Chrome and Edge offer **Install** (icon in the address bar). You get a windowed app with its own icon, working **offline** — fitting, since your data never needed the network in the first place.

## FAQ

**Is anything sent to GitHub?**
Requests for the app files themselves (HTML/CSS/JS), nothing else. Your entries never leave the device — the code contains no analytics and no network calls.

**I cleared my browser data and lost everything.**
That's the one failure mode. Restore from your exported JSON; if you don't have one, the last-backup line in Settings exists to make sure you will next time.

**Can two devices share one workspace?**
Not live — export/import is the bridge.

**Where did Money and Job hunt go?**
Removed in v3 to keep the app focused. Old entries are archived inside your data file (see Backups).

**Why classic `<script>` tags instead of a framework?**
So the app runs from `file://` with a double-click, forever, with nothing to install or break. Zero dependencies is the feature.
