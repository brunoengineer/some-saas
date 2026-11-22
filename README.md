# Pulse: social content, KPI and partnership manager

Phase 0: a clickable prototype. It runs entirely in the browser with sample data (Flush.io and a freelance client, Bloom Coffee) saved in `localStorage`. The full product plan is in the plan file from the planning session.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # data, permissions and PPTX tests
npm run build      # type-check + production build into dist/
```

Routes use the hash (`#/dashboard`), so `dist/` works from any static host.

## What's in it

| Menu | What it does |
|---|---|
| Dashboard | Period bar (day, week, month, quarter, year, custom, compare), platform filter, both kept in the URL, KPI tiles with targets and status, charts with a table view, top posts, next 7 days, partner table, live campaigns, goals with pacing |
| Calendar | Month, week (with image thumbnails), list and board views. Ideas backlog. Drag to reschedule or change status. Post drawer with the image (cropped the way its platform crops it), details, a link to the live post (shown as a link icon on the card), the Discord channel for Discord posts, a phone preview styled for the post's platform (X when none is chosen), compliance checklist, results, comments, approve or request changes. Picking a partner on a post adds a matching deliverable to that partner |
| Campaigns | Theme, strategy, dates, status (automatic from the dates, or set by hand), budget, goals linked to KPIs, posts and partner deliverables tagged to it, campaign report, Discussion button |
| Pillars | The planned mix vs what was posted, engagement rate by pillar, and a card per pillar (share vs target, rate and change, posts, impressions, clicks, best post, link to its posts in the calendar). Admins edit names, colors, targets and descriptions here |
| Partners | Scorecard (views, new members, retention, cost per member), pipeline board, and a Deliverables list across all partners (platform, link to the partner's post, booked, late, delivered, unpaid) with edit and “Mark paid”. Each partner page lists and edits its own deliverables, with notes and discussion behind a button |
| KPIs & Goals | Overview: one period at a time with filters, trend sparklines and status; click a KPI for its full history (vertical, paged, editable). Enter results: a short form with only the hand-entered KPIs for one week or month. Definitions: add from templates, calculated / hand-entered / formula KPIs (one KPI ÷ × + − another), pause or resume tracking, choose which ones are Dashboard tiles, reorder, target history (recalibration) |
| Reports | Weekly and monthly auto reports (each on/off), manual reports of any type, frozen snapshots. Edit report: change the text, remove or put back sections, KPI tiles and figures, add KPIs (frozen for the report period), your own figures and text sections. PPTX export with native charts and PDF via print both follow the edits. Share link, Discussion button |
| Settings | Workspace branding and accent, platforms, checklist, members, invites, roles, report schedules, CSV import, audit log, backup and reset |

Use **View as** in the top bar to preview the Admin, Manager and Viewer roles.

## Code map

- `src/data/types.ts`: the data model (mirrors the planned Firestore layout).
- `src/data/repo.ts`: the `Repo` interface. `mockRepo.ts` implements it with localStorage; Phase 1 adds `firestoreRepo.ts` with the same shape.
- `src/data/seed/`: sample data. The Flush seed reproduces the proposal's example report (week 4 and month 1).
- `src/lib/metrics.ts`: every number in the app (KPIs, filters, partners, campaign goals, pacing).
- `src/lib/report.ts`, `pptx.ts`, `scheduler.ts`: report snapshots, the PowerPoint export and the automatic-report rules (Phase 2 runs the scheduler in a Cloud Function).
- `src/lib/permissions.ts`: the role matrix (Phase 1 enforces it in Firestore rules too).
- `src/app/actions.ts`: every write. Checks the role and writes the audit log.

## Notes

- Sample weeks run Monday to Sunday. The proposal calls Mon 17 Nov 2026 a Monday, but it's a Tuesday, so "week 4" here is 9â€“15 Nov.
- Share links only open in the browser that holds the data until Phase 1 moves the data to Firestore.
- Post images are shrunk and saved in the browser (about 5 MB in total for everything). If storage fills up, a warning appears; Phase 1 moves images to Firebase Storage.
- Comments: authors can edit their own; a comment can be deleted by its author or by an admin.
- Platform logos come from [simple-icons](https://simpleicons.org) (CC0); LinkedIn's is drawn in `PlatformIcon.tsx`.
