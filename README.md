# Pulse: social content, KPI and partnership manager

Plan posts, track KPIs against goals, manage creators and partners, and build reports, for one brand or several clients.

It runs in two modes:

- **Prototype** (no Firebase settings): sample data (Flush.io and a freelance client, Bloom Coffee) saved in this browser. No sign-in. Good for trying things out.
- **Real app** (Firebase settings in `.env.local`): Google sign-in, shared data in Firestore, roles enforced by security rules. Runs on Firebase's free Spark plan, with no card needed.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (prototype, or the real app if .env.local exists)
npm test           # data, permissions, report, backup and PPTX tests
npm run build      # type-check + production build into dist/
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
11. **Put it online:** run `npm run deploy` (needs step 7's CLI). The app goes live at `https://<project-id>.web.app`. For a custom domain, go to Hosting → Add custom domain, then add the domain under Authentication → Settings → Authorized domains.

### Free plan limits (Spark)

- **Database (Firestore):** about 1 GB stored, 50,000 reads, 20,000 writes and 20,000 deletes a day. When a limit is reached, saving pauses until the next day and the app says so; nothing is billed.
- **Images:** uploaded images are shrunk to about 350 KB and stored in Firestore (`workspaces/{id}/images`), with a 400px thumbnail on the post for the calendar. Firebase Storage isn't used; new projects need Blaze for it.
- **Saving trips:** the browser keeps a local copy, so reopening the app only downloads what changed.

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
| Settings | Workspace branding and accent, platforms, checklist, members and roles, CSV import, audit log, backup (and import in the real app, reset in the prototype) |

**View as** in the top bar previews a role. In the real app it only goes down from your own role (an admin can preview Manager or Viewer); your real permissions don't change.

## Roles

The same table is enforced twice: in the app (`src/lib/permissions.ts`, which hides controls and guards every write) and by Firestore (`firestore.rules`, which refuses anything a role can't do, even from outside the app).

| | Admin | Manager | Viewer |
|---|---|---|---|
| See everything in the workspace | ✓ | ✓ | ✓ |
| Comment; edit and delete own comments | ✓ (and delete anyone's) | ✓ | – |
| Approve / request changes on posts | ✓ | if allowed | – |
| Create and edit ideas and drafts | ✓ | if allowed | – |
| Edit campaigns, partners, KPIs, results, reports | ✓ | – | – |
| Members, roles and settings | ✓ | – | – |

Owners (`meta/owners`, claimed at the first sign-in) can also create workspaces.

## Code map

- `src/data/types.ts`: the data model.
- `src/data/repo.ts`: the `Repo` interface. `mockRepo.ts` (prototype, localStorage) and `firestoreRepo.ts` (real app) implement it; `src/data/index.ts` picks one.
- `src/firebase/`: Firebase settings and set-up. `src/app/auth.tsx` handles Google sign-in and owners; `src/features/onboarding/` has the sign-in, first-run and no-access screens.
- `firestore.rules`, `firebase.json`: security rules and hosting.
- `src/data/seed/`: sample data. The Flush seed reproduces the proposal's example report (week 4 and month 1).
- `src/lib/metrics.ts`: every number in the app (KPIs, formulas, filters, partners, campaign goals, pacing).
- `src/lib/report.ts`, `pptx.ts`: report snapshots and the PowerPoint export.
- `src/lib/backup.ts`: backup export and import.
- `src/app/actions.ts`: every write. Checks the role and writes the audit log.

## Notes

- Sample weeks run Monday to Sunday. The proposal calls Mon 17 Nov 2026 a Monday, but it's a Tuesday, so "week 4" here is 9–15 Nov.
- Reports are created by hand. Automatic reports and report emails were removed to stay on the free plan; they would need a server or Cloud Functions (Blaze).
- Share links open for signed-in members of the workspace (in the prototype, only in the browser that holds the data).
- Comments: authors can edit their own; a comment can be deleted by its author or by an admin.
- The security rules haven't been run against the Firestore emulator yet (it needs Java). Test them by signing in with an admin, a manager and a viewer account, or with the Rules Playground in the console.
- Platform logos come from [simple-icons](https://simpleicons.org) (CC0); LinkedIn's is drawn in `PlatformIcon.tsx`.
