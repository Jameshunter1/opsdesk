# Changelog

All notable changes to OpsDesk. Versions follow [semver](https://semver.org); the data schema is versioned separately (currently v1) and only changes when stored data would need migration.

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
