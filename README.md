# Security Schedule — Full Cloudflare App

Start with **START-HERE.md** for new GitHub / Cloudflare / D1 setup.

Worker: `security-schedule-sandbox-full`
Database: `security-schedule-sandbox-full-db`

Role-based authentication, shared schedules, Master template, attendance/coverage, payroll previews, guard requests, saved deleted-row images, PDF/email, backups and audit history. No default password, no old-app bindings.

Run `npm test` and `npm run build` with Node 22.13+.

This app starts with an empty Master. It is a new implementation of the mockup, not a copy or migration of the existing production app. See START-HERE.md for feature boundaries and validation status.

Hours & Payroll has Missing pay, Leave balances, Payroll & reports, and Seniority tabs. Missing-hours requests accept start/end times and calculate the amount on the server (earlier end time means next day; equal times are rejected). Reviewing a request opens its schedule week and highlights its work date. Approval creates one payroll correction; partial/full payment records track settlement without creating another correction. Old amount-only requests remain supported.

Set annual sick/personal allowances and hire dates from these tabs. No allowances or hire dates are assumed. Leave use comes from saved attendance, combines linked portions, caps each day at eight hours and excludes test schedules. Guards see only their own balances and payment status. Reports can be printed or downloaded as CSV. Existing weekly/Master Excel and PDF exports remain available.

Weekly schedules also keep extra-hours / covering notes in a collapsible section. Add from the section or a guard’s cell → Shift note. Notes keep the original guard, date, post and time, combine linked shifts, support edit/delete, and do not alter payroll. They are manager records and are not included in guard responses.

Coverage notes now fill automatically from the weekly assignments, absence records and Master comparison. They refresh as assignments change and combine linked coverage once. Managers may add or clear comments while keeping the generated coverage details. Existing weeks show automatic coverage notes without manual re-entry.

The weekly page has a collapsible Why hours differ section below the three totals. It reconciles current Master assignments to the weekly schedule, then scheduled work to payroll work, following the selected guard/day filters. It lists changed assignments, absence reasons, affected guard/date/post/times and payroll-week transfer records. Totals reconcile overlapping minutes and show paid leave / adjustments separately; the explanation is read-only.

Weekly staffing cards show Master total, Weekly total, Assigned to guards and Still open. Staffing counts required post positions; payroll worked is shown separately and reconciles overlaps and payroll-week transfers. Covering or changing a vacation replacement moves coverage to the new guard while preserving the original vacation and its leave credit.

Guard phone temporary codes do not expire. Each code works once; generating a replacement invalidates the previous code. Unused saved codes also remain valid regardless of their old expiry timestamp. Temporary passwords still require a new password at first sign-in.

Returning a guard to a full shift cancels their matching full-shift absence rather than recording an absence for the outgoing covering guard. Worked and leave hours update together. A vacation return removes that date from the saved range (splitting it when needed); other dates remain. Existing full-shift returns with stale leave records reconcile when the selected week renders. Partial-day attendance and holiday records are retained. Replacing coverage with a different guard preserves the original guard’s leave.
