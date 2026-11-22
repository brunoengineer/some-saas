# Pulse: social content, KPI and partnership manager

Plan posts, track KPIs against goals, manage creators and partners, and build reports, for one brand or several clients.

It runs in two modes:

- **Prototype** (no Firebase settings): sample data (Flush.io and a freelance client, Bloom Coffee) saved in this browser. No sign-in. Good for trying things out.
- **Real app** (Firebase settings in `.env.local`): Google sign-in, shared data in Firestore, roles enforced by security rules. Runs on Firebase's free Spark plan, with no card needed.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (prototype, or the real app if .env.local exists)
npm test           # data, permissions, report, backup, PPTX and Discord sync tests
npm run build      # type-check + production build into dist/
npm run deploy     # build, then publish the app and the security rules to Firebase
npm run sync       # fetch Discord numbers once (see docs/discord.md)
npm run sync:watch # wait for the Update data button and fetch when it's pressed
```

Routes use the hash (`#/dashboard`), so `dist/` works from any static host.

## Set up the real app (Firebase, free plan)

1. **Optional, before you start:** to keep the prototype's data, open the app now and go to Settings → Data → **Download JSON backup**. You can import it later.
2. **Create the project:** go to [console.firebase.google.com](https://console.firebase.google.com) and choose **Create a project**. Google Analytics isn't needed. Stay on the free **Spark** plan; nothing here needs Blaze.
3. **Register the web app:** on the project overview, click the web icon (`</>`), give it a nickname (e.g. "Pulse web") and click **Register app**. You don't need to tick Hosting here. Copy the values from the `firebaseConfig` it shows.
4. **Add the settings:** copy `.env.example` to `.env.local` and paste the values in: apiKey, authDomain, projectId, appId and messagingSenderId. `.env.local` stays on your machine (it's in `.gitignore`).
5. **Turn on Google sign-in:** go to Build → **Authentication** → Get started → Sign-in method → **Google** → Enable. Pick a support email and click Save. `localhost` and your `*.web.app` address are allowed by default.
6. **Create the database:** go to Build → **Firestore Database** → Create database. If asked for an edition, choose **Standard**. Pick a location near your team; this can't be changed later. Start in **production mode**.
7. **Publish the security rules:** either use the CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick the project; creates .firebaserc
   npm run deploy:rules
   ```
   or paste the contents of `firestore.rules` into Firestore → Rules and click **Publish**.
8. **First sign-in:** run `npm run dev`, sign in with Google and click **Make me the owner**. Only owners can create workspaces. Then create your first workspace.
9. **Optional, bring data in:** in Settings → Data → **Import from a backup**, choose the JSON from step 1 and copy a workspace into this one.
10. **Add people:** in Settings → Members & roles, add each person's Google email with a role. They get in the first time they sign in. Nothing is emailed, so send them the link.
11. **Put it online:** run `npm run deploy` (needs step 7's CLI; `.firebaserc` already names the project). The app goes live at `https://<project-id>.web.app`. Run it again after every change. Pages always check for a new version, so people see updates straight away. For a custom domain, go to Hosting → Add custom domain, then add the domain under Authentication → Settings → Authorized domains.
12. **Optional, connect Discord:** follow [docs/discord.md](docs/discord.md). Members, joins by invite link, messages, weekly active members and retention then update by themselves.

Live now: `https://some-app-42065.web.app`.

### Free plan limits (Spark)

- **Database (Firestore):** about 1 GB stored, 50,000 reads, 20,000 writes and 20,000 deletes a day. When a limit is reached, saving pauses until the next day and the app says so; nothing is billed.
- **Images:** uploaded images are shrunk to about 350 KB and stored in Firestore (`workspaces/{id}/images`), with a 400px thumbnail on the post for the calendar. Firebase Storage isn't used; new projects need Blaze for it.
- **Saving trips:** the browser keeps a local copy, so reopening the app only downloads what changed. Saves are sent in batches of 8, because the security rules may check at most 20 documents per request.
- **Hosting:** 10 GB stored and 360 MB downloaded a day. The app is about 1 MB on the first visit and cached after that.
- **Backups:** none are automatic on the free plan. Download one now and then from Settings → Data.

## What's in it

| Menu | What it does |
|---|---|
| Dashboard | Period bar (day, week, month, quarter, year, custom, compare), platform filter, both kept in the URL. KPI tiles with targets and status (you choose which KPIs), charts with a table view, top posts, next 7 days, partner table, live campaigns, goals with pacing |
| Calendar | Month, week (with image thumbnails), list and board views. Ideas backlog. Drag to reschedule or change status. Post drawer with the image (cropped the way its platform crops it), details, a link to the live post (a link icon on the card), the Discord channel for Discord posts, a phone preview styled for the post's platform (X when none is chosen), compliance checklist, results, comments, approve or request changes. Picking a partner on a post adds a matching deliverable to that partner |
| Campaigns | Theme, strategy, dates, status (automatic from the dates, or set by hand), budget, goals linked to KPIs, posts and partner deliverables tagged to it, campaign report, Discussion button |
| Pillars | The planned mix vs what was posted, engagement rate by pillar, and a card per pillar (share vs target, rate and change, posts, impressions, clicks, best post, link to its posts in the calendar). Admins edit names, colors, targets and descriptions here |
| Partners | Scorecard (views, new members, retention, cost per member), pipeline board, and a Deliverables list across all partners (platform, link to the partner's post, booked, late, delivered, unpaid) with edit and “Mark paid”. Each partner page lists and edits its own deliverables, with notes and discussion behind a button |
| KPIs & Goals | Overview: one period at a time with filters, trend sparklines and status; click a KPI for its full history (vertical, paged, editable). Enter results: a short form with only the hand-entered KPIs for one week or month. Definitions: add from templates, calculated / hand-entered / formula KPIs (one KPI ÷ × + − another), pause or resume tracking, choose which ones are Dashboard tiles, reorder, target history (recalibration) |
| Reports | Generate weekly, monthly, campaign or custom reports by hand; numbers are frozen when generated. Edit report: change the text, remove or put back sections, KPI tiles and figures, add KPIs, your own figures and text sections. PPTX export with native charts and PDF via print both follow the edits. Share link, Discussion button |
| Settings | Workspace branding and accent, platforms, checklist, members and roles, Integrations (connect Discord, see the last update), CSV import, audit log, backup (and import in the real app, reset in the prototype) |
| Update data | Bottom of the menu, in the real app once Discord is connected. Asks the sync script for the latest numbers and shows when they were last updated. Admins and managers can press it |

**View as** in the top bar previews a role. In the real app it only goes down from your own role (an admin can preview Manager or Viewer); your real permissions don't change.

## Roles

The same table is enforced twice: in the app (`src/lib/permissions.ts`, which hides controls and guards every write) and by Firestore (`firestore.rules`, which refuses anything a role can't do, even from outside the app).

| | Admin | Manager | Viewer |
|---|---|---|---|
| See everything in the workspace | ✓ | ✓ | ✓ |
| Comment; edit and delete own comments | ✓ (and delete anyone's) | ✓ | – |
| Approve / request changes on posts | ✓ | if allowed | – |
| Press Update data (fetch Discord numbers) | ✓ | ✓ | – |
| Create and edit ideas and drafts | ✓ | if allowed | – |
| Edit campaigns, partners, KPIs, results, reports | ✓ | – | – |
| Members, roles, settings and integrations | ✓ | – | – |

Owners (`meta/owners`, claimed at the first sign-in) can also create workspaces.

## Integrations

| Source | Status | How |
|---|---|---|
| Discord | Built, free | A read-only bot plus the sync script (`scripts/sync/`), run on your PC or a company server. Fills members, joins by invite link (partners' links are matched by themselves), leavers, messages, weekly active members and 7-day retention. Set-up: [docs/discord.md](docs/discord.md) |
| X | Not built | X's API is now pay per use (prepaid credits, roughly $2–10 a month at Flush's volume). For now, import X Analytics CSVs in Settings → Import, or type post results in the post drawer |

The free plan can't run code on Google's side, so the **Update data** button doesn't fetch anything itself. It writes a request to `workspaces/{id}/sync/state`, and the sync script answers it while it's listening (`npm run sync:watch`, left open on your PC or the company server). Nothing runs on a schedule; numbers change only when someone presses the button. While listening, the script tells Pulse every 5 minutes that it's there, without fetching anything, so the button can show whether anyone will answer.

## Code map

- `src/data/types.ts`: the data model.
- `src/data/repo.ts`: the `Repo` interface. `mockRepo.ts` (prototype, localStorage) and `firestoreRepo.ts` (real app) implement it; `src/data/index.ts` picks one.
- `src/firebase/`: Firebase settings and set-up. `src/app/auth.tsx` handles Google sign-in and owners; `src/features/onboarding/` has the sign-in, first-run and no-access screens.
- `firestore.rules`, `firebase.json`, `.firebaserc`: security rules, hosting and the linked Firebase project.
- `src/data/seed/`: sample data. The Flush seed reproduces the proposal's example report (week 4 and month 1).
- `src/lib/metrics.ts`: every number in the app (KPIs, formulas, filters, partners, campaign goals, pacing).
- `src/lib/report.ts`, `pptx.ts`: report snapshots and the PowerPoint export.
- `src/lib/backup.ts`: backup export and import.
- `scripts/sync/`: the sync script (Node). `discord.ts` reads Discord; `index.ts` writes to Firestore with a service account and handles once and watch modes. Settings go in `.env.sync` (see `.env.sync.example`); the key file goes in `secrets/` (ignored by git).
- `src/lib/discordSync.ts`: the Discord counting rules (joins by source, leavers, active members, retention), shared by the script and its tests.
- `src/features/sync/`: the Update data button and the live sync status. `src/features/settings/IntegrationsTab.tsx`: Settings → Integrations.
- `src/app/actions.ts`: every write. Checks the role and writes the audit log.

## Notes

- Sample weeks run Monday to Sunday. The proposal calls Mon 17 Nov 2026 a Monday, but it's a Tuesday, so "week 4" here is 9–15 Nov.
- Reports are created by hand. Automatic reports and report emails were removed to stay on the free plan; they would need a server or Cloud Functions (Blaze).
- The Discord sync never stores names or message text, only Discord user IDs, in `integrationState/`, which no app user can read.
- Share links open for signed-in members of the workspace (in the prototype, only in the browser that holds the data).
- Comments: authors can edit their own; a comment can be deleted by its author or by an admin.
- The security rules haven't been run against the Firestore emulator yet (it needs Java). Test them by signing in with an admin, a manager and a viewer account, or with the Rules Playground in the console.
- Platform logos come from [simple-icons](https://simpleicons.org) (CC0); LinkedIn's is drawn in `PlatformIcon.tsx`.
