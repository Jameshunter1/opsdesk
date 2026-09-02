# OpsDesk user guide

OpsDesk is a **local-first** app: everything you enter lives in your browser, on your machine. This guide walks through every module, the keyboard shortcuts, and how to keep your data safe.

- [Two modes: Simple and Pro](#two-modes-simple-and-pro)
- [Getting around](#getting-around)
- [Dashboard](#dashboard)
- [Lab](#lab)
- [Desk](#desk)
- [Ledger](#ledger)
- [Pipeline](#pipeline)
- [Study](#study)
- [Your data: backups, moving machines](#your-data)
- [Install it like an app](#install-it-like-an-app)
- [FAQ](#faq)

---

## Two modes: Simple and Pro

On first run, OpsDesk asks what it should be for you:

- **Simple** — plain everyday language. The sidebar reads *Home, To-dos, Money, Job hunt, Learning*. Money is recorded as **"I spent money," "I got paid,"** or **"I moved money"** — how much, on what, paid with, done. To-dos ask "What needs doing?" instead of showing ticket jargon, and the homelab module doesn't appear at all. You start with everyday accounts (Chequing, Credit card, Groceries…) and three worked examples you can delete.
- **Pro** — the full IT-department experience: tickets with root causes, a double-entry ledger with a trial balance, the homelab tracker with its firewall matrix, and command drills. Starts loaded with a demo homelab to explore.

**It's the same data underneath.** A simple-mode purchase is stored as a correct double-entry transaction, so nothing is lost switching between modes — change anytime in **Settings → Experience**, where you can also turn individual modules on or off (want Money and To-dos but no Job hunt? Untick it).

![The simple money form](simple-money.png)

## Getting around

The sidebar is the map — in Pro mode **Dashboard → Lab → Desk → Ledger → Pipeline → Study**, in Simple mode **Home → To-dos → Money → Job hunt → Learning** — with Settings and the theme toggle at the bottom. The theme cycles System → Light → Dark. Modules you've turned off in Settings simply don't appear.

**The fastest way to anything is the command palette.** Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (or <kbd>/</kbd>) and type. It searches every module at once — VM names, ticket text, KB lessons, transaction descriptions, companies, study topics, commands — and <kbd>Enter</kbd> jumps straight to the record. It also carries quick actions: type "new" to see *New ticket*, *New transaction*, *New VM*, *New application*, *New module*, and *Export backup*.

| Key | Does |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> or <kbd>/</kbd> | Open the command palette |
| <kbd>↑</kbd> <kbd>↓</kbd> then <kbd>Enter</kbd> | Move and open in the palette |
| <kbd>Esc</kbd> | Close any dialog |

Everywhere in the app, **clicking a table row opens that record** for viewing or editing, and the buttons in the top-right corner create new records for the current module.

## Dashboard

The morning-coffee view. Five tiles (VMs running, open tickets, net cash this month with a comparison to last month, active applications, study progress), six months of income vs. expenses, the job funnel by stage, your open tickets sorted by priority, and a recent-activity feed that merges events from every module.

On first run the whole app is filled with **sample data** modeled on a small VirtualBox + pfSense homelab, so every screen demonstrates itself. Dismiss the banner and edit anything — or wipe it in **Settings → Start blank**.

## Lab

Three registers that mirror how a segmented lab is actually designed:

- **Network zones** — name, interface, subnet, gateway, DHCP range. WAN is treated as where the internet comes from, not a place rules originate.
- **VM fleet** — OS, zone, IP, RAM/vCPU/disk, role, and a status: `running`, `stopped`, `planned`, or `template` (golden images that never join the lab network). The *RAM committed* tile totals what's running versus what the whole fleet would need — useful when the host has 16 GB and you run only what the current module needs.
- **Firewall policy matrix** — the design-first heart of the Lab. Rows are source zones, columns are destinations plus Internet. Click a cell to set **allow / limited / block**; *limited* takes a port list (e.g. `80, 443, 53`). Every rule requires a **one-sentence reason**, shown on hover — if you can't explain a rule in one sentence, it isn't designed yet. Cells you haven't designed read `unset`, which means implicit default-deny.

The matrix mirrors how pfSense evaluates traffic: rules decide who may *start* a conversation; the stateful firewall lets replies come back on their own.

## Desk

A personal service desk with two ticket types:

- **Incidents** — something broke. Record the *symptom* (what it looked like), the *root cause* (the actual reason, not the first scary error line), the *fix*, and the **lesson** — the one-liner future-you needs.
- **Tasks** — planned work, tracked with the same numbering.

Tickets get sequential numbers (`T-0001`, …) and move **open → in-progress → resolved** (quick buttons in the ticket detail). 

**The knowledge base builds itself:** every resolved ticket that has a lesson appears in the *Knowledge base* tab as an article — cause, fix, lesson — full-text searchable. This is the habit that turns troubleshooting into experience you can point at.

## Ledger

Real double-entry bookkeeping, not a budget toy:

- **Accounts** have one of five types — *asset, liability, equity, income, expense* — following the accounting equation. Assets and expenses grow with debits; the other three grow with credits.
- **Every transaction is one debit and one credit** of the same amount. Spending on the lab? Debit *Lab & hardware*, credit *Chequing* (or *Visa*). Payday? Debit *Chequing*, credit *Pay*. The form's hints say exactly this, and it refuses a transaction whose debit and credit are the same account.
- **The trial balance proves it.** Total debits always equal total credits — the *balanced* badge is computed, not decorative.
- **Export CSV** (top-right) writes every transaction to a file that opens cleanly in Excel, Google Sheets, or real accounting software.

Balances are shown from each account's natural perspective, so a liability with money owing reads as a positive "you owe this," and a negative number always means something worth investigating.

## Pipeline

The job hunt as a funnel: **saved → applied → screening → interview → offer**, closing out as *accepted* or *rejected*.

Each application records the company, role, source, posting URL, salary, and — the part that pays off later — **which resume version you used** and a **dated activity log**. Open an application and use *Log it* to note every call, email, and follow-up; use *Move to* to change stage (which also logs itself). The table sorts by last touch, so the application going stale is always visible.

## Study

Three tools for deliberate learning:

- **Curriculum** — modules with a status, hours logged, topics, and a **proof of work**: the demonstrable thing that says it's done ("fresh clone to SSH prompt, timed"). Progress feeds the dashboard meter.
- **Certifications** — planned / studying / scheduled / passed, with target dates.
- **Command vault** — the "commands I know cold" list. **Command drill** shuffles the vault and quizzes you description-first. **Interview drill** goes one better: it deals your *resolved tickets* as behavioural-interview practice — say your answer out loud (situation, diagnosis, what you did, takeaway), then check it against your own write-up. Your homelab war stories become interview answers.

## Your data

- Everything is stored in the browser's `localStorage` under the key `opsdesk.v1`. Nothing is sent anywhere, ever.
- **Settings → Export backup** downloads the entire workspace as one JSON file. **Import backup** restores it (replacing what's there). Export before clearing browser data, switching browsers, or moving machines.
- Storage is per-browser *and* per-site: the live site and a local copy are separate workspaces. Move between them with export/import.
- **Reset to sample data** restores the demo homelab; **Start blank** gives an empty workspace. Both warn first.

## Install it like an app

From the live site, Chrome and Edge offer **Install** (the icon in the address bar, or menu → *Apps → Install OpsDesk*). You get a windowed app with its own icon, and a service worker keeps it working **offline** — fitting, since your data never needed the network in the first place.

## FAQ

**Is my financial/job data visible to anyone?**
No. There's no server and no telemetry — the page is static files. Data stays in your browser. (Verify it yourself: DevTools → Network.)

**I cleared my browser data and lost everything.**
That's the one way to lose it — localStorage went with the cache. Restore from your exported JSON. If you don't have one: Settings → Export backup takes five seconds; make it a habit after big entries.

**Can two devices share one workspace?**
Not live — by design there's no sync server. Export on one, import on the other.

**The ticket numbers skip after I delete tickets.**
Intentional: numbers are never reused, like a real ticketing system.

**Why classic `<script>` tags instead of ES modules?**
So the app runs from `file://` with a double-click, no server needed. Zero install is the feature; the shared `OD` namespace is the price, paid once.
