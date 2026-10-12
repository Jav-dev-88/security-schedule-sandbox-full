# Security Schedule — Full Cloudflare App

Start with **START-HERE.md** for new GitHub / Cloudflare / D1 setup.

Worker: `security-schedule-sandbox-full`
Database: `security-schedule-sandbox-full-db`

Role-based authentication, shared schedules, Master template, attendance/coverage, payroll previews, guard requests, saved deleted-row images, PDF/email, backups and audit history. No default password, no old-app bindings.

Run `npm test` and `npm run build` with Node 22.13+.

This app starts with an empty Master. It is a new implementation of the mockup, not a copy or migration of the existing production app. See START-HERE.md for feature boundaries and validation status.
