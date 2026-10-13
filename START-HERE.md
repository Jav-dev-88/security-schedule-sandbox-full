# Security Schedule — Full Cloudflare Version

This is a new app built from your working mockup. It uses its own Cloudflare Worker, D1 database, and GitHub repository. It does not connect to your old app or migrate old app records.

## What is included

- Admin, Manager, and Guard sign-in with hashed passwords, 8-hour sessions, temporary-password changes, account disable and password reset.
- Admin manages Admin/Manager/Guard accounts; Manager manages Guard accounts.
- Shared saving in a separate D1 database. If two managers edit the same version, the second save is stopped rather than overwriting someone else's work. Download the unsaved copy and refresh.
- Master Template, lock/unlock, weekly generation, saved-week selection and backup before reset/delete.
- All three platoons; Monday–Sunday columns; Sunday week ending labeled W-E mm-dd-yyyy.
- Existing rows keep their original order. New rows appear after existing rows in their platoon. Type letters to complete guard names.
- Attendance: vacation, sick, personal, call-out, unpaid leave, left early, and came late. Coverage, paid/unpaid/review leave status, notes and up to 8 paid leave hours per guard/day.
- Worked/billable/non-billable hours, payroll CSV, overlap removal, split shifts and return to original post.
- Sunday 23:00–Monday 07:00 entered in the Sunday column remains in that Sunday week. It is not copied as work into the next week.
- Guard portal showing only the guard's own assigned shifts and attendance. Guards can request vacation or switches. The other guard and Manager must approve a switch before schedules change.
- Delete a row only after its SVG image and row data are saved to the database. Images can be viewed, downloaded and the row restored.
- Paid-holiday list, automatic schedule version backups (last 100), backup download/restore and audit history.
- Test-schedule flag excludes that week from payroll CSV.
- Downloadable landscape schedule PDF, browser Print / Save PDF, and optional schedule PDF email through the included relay.

## 1. Create the NEW GitHub repository

Create a new repository called **security-schedule-sandbox-full**. Public or private is your choice. Passwords and setup/email tokens are entered as secrets, not committed.

If you already created the new `security-schedule-sandbox-new` repository, you may use that new repository for these files instead. The Cloudflare Worker name must still be **security-schedule-sandbox-full**, matching `wrangler.jsonc`.

Unzip this download. Upload the CONTENTS of the extracted folder, not the outer folder. The top-level files should include:

- `wrangler.jsonc`
- `package.json`
- `src/`
- `public/`
- `migrations/`
- `scripts/`
- `tests/`
- `START-HERE.md`

## 2. Create a NEW Cloudflare database

In Cloudflare, open **Storage & Databases → D1** and create a database named:

`security-schedule-sandbox-full-db`

Copy its Database ID. In your NEW GitHub repository, edit `wrangler.jsonc` and replace `REPLACE_WITH_NEW_TEST_DATABASE_ID` with that ID. Commit the change. Do not use the old app's database ID.

The new app automatically creates its database tables when you first open it. You do not need to paste SQL in the D1 Console. Existing tables and records are preserved. The SQL migration file remains available for local development and manual administration.

## 3. Create the NEW Cloudflare Worker

In **Workers & Pages**, create a NEW Worker connected to the NEW GitHub repository.

Use these settings:

| Setting | Value |
| --- | --- |
| Worker name | `security-schedule-sandbox-full` |
| Branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Root directory | Leave blank / repository root |

Choose Workers, not Pages. The database binding is declared in `wrangler.jsonc` as `DB`.

If Cloudflare cannot see the new GitHub repository, update the Cloudflare GitHub application's repository access to include it.

## 4. Set your first Admin password

In the NEW Worker's Settings → Variables and Secrets, add one Secret:

- Name: `ADMIN_PASSWORD`
- Value: the password you chose, at least 10 characters.

Keep that password out of GitHub. There is no SETUP_TOKEN. The first Admin username defaults to `jrasheed`. Optional non-secret variables `ADMIN_USERNAME` and `ADMIN_NAME` can override the initial username and display name.

## 5. Sign in

Open the new app and sign in as **jrasheed** using that password. A matching first sign-in creates the Admin and initial workspace automatically. An incorrect password cannot create an account.

After the Admin is created, all sign-ins use the database password hash. You can remove `ADMIN_PASSWORD` from Worker secrets afterward. No preset password is included in the repository.

## 6. Build your Master

The full app starts empty; it does not import sample schedules or the old app's records automatically.

1. Open **Staff** and add the guard names.
2. Open **Master Template**.
3. Use **+ Quick Add Row** in a platoon to create a blank row immediately. Post is blank; hours default to 23:00–07:00, 07:00–15:00, or 15:00–23:00 for that platoon. Fill the guard cells. **Add with details** remains available when you want custom post/times.
4. Fill the day cells. Known guard names save automatically when fully typed or when you click outside. A suggested completion stays selected while you keep typing; click outside or press Enter to accept it. You do not need a Save button. A new name typed in a cell is saved as a temporary guard when you click outside or press Enter.
5. Lock the Master.
6. Choose a Sunday week ending and click **Create Weekly from Master**.
7. Open **Accounts** and create Manager/Guard logins. For a Guard, select the exact schedule name. Give them a temporary password; the app requires a password change on first login.

Changes are shared between devices after saving. Use Refresh to load another manager's updates. There is no continuous live push refresh.

## Temporary guards

Use **Staff → Add temporary guard**, or type a new name directly into a schedule cell and click outside. Temporary guards are marked **TEMP** and can be used in schedules without adding them to permanent staff. Names are shared between devices after saving. The temporary label does not expire automatically or create a login. Use **Make permanent** in Staff if a temporary guard joins the regular team.

## 7. Optional: email schedule PDFs

The app works without email. To enable it:

1. Create a separate Google Apps Script project.
2. Paste `integrations/EmailRelay.gs` into its code editor.
3. In Script Properties, add `RELAY_TOKEN` with a long random value you choose.
4. Deploy as a Web App: **Execute as Me**, access **Anyone**. The relay checks the token before sending.
5. Copy its `/exec` deployment URL.
6. Add two Secrets to the NEW Cloudflare Worker:
   - `MAIL_WEBHOOK_URL`: that `/exec` URL.
   - `MAIL_RELAY_TOKEN`: the same value as the Apps Script `RELAY_TOKEN`.
7. Redeploy the Worker if required. Click **Email PDF** in Weekly Schedule.

Google's email quotas apply. This is manual sending, not a scheduled email job. The old app's webhook is not used.

## Printing and PDF

**Print exactly as page / Save PDF** uses the browser's print view, preserving the schedule table and colors. In the print dialog choose Landscape, Letter, background graphics ON, and headers/footers OFF. Many rows may require several pages; no fixed row count can fit legibly on one Letter page.

**Download PDF** generates a compact landscape PDF with every platoon, dates, names, shift times, billing colors, and a week-ending filename. Email uses this compact PDF. It is not a screenshot of the page and does not include the attendance log. Longer labels may be shortened in the compact PDF; use browser Print when you need the full visible wording.

## Payroll boundaries

Worked hours come from the schedule segments. Overlaps for the same guard are removed from totals. Regular worked hours are capped at 8/day; remaining worked hours are shown separately as extra worked hours. This does not decide legal overtime or payroll rates. Paid leave does not count as worked or billable hours. Paid-holiday premiums and rates are not automatic.

Enter Sunday overnight work on the Sunday cell as 23:00–07:00; do not enter the same work again on the following Monday. The app does not automatically detect a duplicated cross-week entry or implement the old app's Monday carryover display. Rasheed-specific linked-shift opening rules from the old app are not hard-coded; this version uses explicit rows and attendance coverage.

## Backups and scale

Open **Backups & Audit** to download schedule backups or restore a saved JSON file. Schedule backups include Master, weeks, staff and deleted-row images. User accounts, sessions, request records, and audit records remain in D1 and are not included in the downloadable schedule JSON. Cloudflare D1 backups can protect the whole database.

The active schedule workspace is limited to 1.8 MB, leaving room below D1's 2 MB row limit. Download old backups and remove unneeded weeks before reaching it. Last 100 schedule versions are retained. This design is suitable for a small scheduling team; split records into separate tables before growing to very large archives.

## Local development / checks

Use Node 22.13 or newer.

```sh
npm test
npm run build
```

To run locally, copy `.dev.vars.example` to `.dev.vars`, set your local ADMIN_PASSWORD, then run:

```sh
npm run db:local
npm run dev
```

Keep `.dev.vars` out of GitHub.

For CLI deployment after replacing the database ID:

```sh
npx wrangler@4 login
npm run db:remote
npm run deploy
```

## Troubleshooting

- **Missing DB binding:** check the database entry and ID in `wrangler.jsonc`.
- **Server error / no users table:** apply `migrations/0001_initial.sql` to the new D1 database.
- **First Admin password missing:** add ADMIN_PASSWORD as a Worker Secret, then sign in as jrasheed.
- **Temporary password cannot load schedules:** change the password when prompted.
- **Master is locked:** unlock before editing, restoring a different Master, or deleting a Master row.
- **Save conflict:** download the unsaved copy, reload latest, and reapply the affected edits.
- **Name will not save:** finish typing and click outside; new names are saved as temporary guards. A guard cannot work overlapping assignments. Read the error beside the cell.
- **Email not configured:** follow optional email setup; no email provider is enabled by default.

Cloudflare references:
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/platform/limits/

## Verification completed

Source syntax/import checks and automated integration tests passed for authentication, role restrictions, sessions, optimistic-save conflicts, backups, Master lock, generated-week independence, row order, saved-image deletion, partial attendance, payroll overlap removal, Sunday overnight hours, test exclusions, guard privacy, vacation approval, and both-guards-plus-manager switch approval. PDF structure, rendered pages, and unconfigured email handling were tested.

The code has not been deployed to your Cloudflare account. Real Cloudflare deployment, browser layout, cross-device checks, and actual email delivery still need to be checked on the new test URL before using it for real schedules.
