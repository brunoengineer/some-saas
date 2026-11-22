# Connect Discord to Pulse

Pulse can fetch your Discord server's numbers by itself: members, who joined and through which invite link, who left, messages, weekly active members and 7-day retention. It's free, and it stays on Firebase's free plan.

This guide takes about 20 minutes the first time.

## How it works

```
Discord server ──(bot, read only)──> sync script ──> Firestore ──> Pulse
                                     (your PC or a server)
```

- A **Discord bot** gets read access to your server. It doesn't post anything and can't read message text.
- A **sync script** in this project (`scripts/sync/`) asks Discord for the numbers and saves one row per day in Pulse. It runs on a computer you control: your PC or a company server. The free Firebase plan can't run code on Google's side, so it has to run somewhere else.
- **Update data** (bottom of the menu in Pulse) asks the script to fetch. Nothing runs on a schedule: numbers change only when someone presses the button (or runs `npm run sync` by hand).

Why the script has to be running for the button to work: the button lives in the browser of whoever clicks it. Reading Discord needs the bot's token, and putting the token in the web page would let anyone who opens the site copy it and control the bot. So the page only leaves a note in Firestore ("please update"), and the script, waiting quietly in a terminal, sees the note and does the fetch. While it waits it fetches nothing.

You'll need:

- Admin rights in Pulse.
- The **Manage Server** permission on the Discord server, to add the bot.
- Node.js 22.18 or newer on the computer that runs the script. Check with `node --version`.

## Part 1: Create the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and sign in. Click **New Application**, name it `Pulse` (any name works), accept the terms, and click **Create**.
2. Make it private, so nobody else can add your bot to their server:
   - In the left menu, open **Installation**. Set **Install Link** to **None** and save.
   - Open **Bot** and switch **Public Bot** off. Save.
3. Still on the **Bot** page:
   - Under **Privileged Gateway Intents**, switch on **Server Members Intent** and save. This lets the bot list members and their join dates.
   - Leave **Message Content Intent** off. Pulse counts messages but never reads them.
   - Click **Reset Token**, confirm, and copy the token. This is the bot's password. You'll paste it in part 3. If you lose it, reset it again.
4. Add the bot to your server:
   - Open **OAuth2** → **URL Generator**. Tick the scope **bot**.
   - Under Bot Permissions, tick:
     - **View Channels**
     - **Read Message History**
     - **Manage Server**: needed to read how many people used each invite link. Without it, everything still works, but new members aren't split by source.
   - Copy the generated URL, open it in your browser, choose your server, and click **Authorize**.

   Shortcut: open this address with your **Application ID** (on the General Information page) in place of `APP_ID`:
   `https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot&permissions=66592`
5. **Private channels:** the bot only counts channels it can see. For a private channel you want counted, add the bot (or its role) to that channel. Channels it can't see are skipped, and the update message lists them.

## Part 2: Give the script access to Firestore

The script writes to the database with a Firebase **service account**, a key that bypasses the security rules. Treat it like a password.

1. Open the [Firebase console](https://console.firebase.google.com) → your project → the **⚙ gear** → **Project settings** → **Service accounts**.
2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
3. In the project folder, create a folder called `secrets`. Move the file there and rename it `service-account.json`.
   - `secrets/` is in `.gitignore`, so the key is never committed.
   - Never email it or paste it in chat.
   - If it leaks, delete it in Google Cloud console → IAM & Admin → Service accounts → your account → Keys, and generate a new one.

## Part 3: Settings file

In the project folder:

```bash
cp .env.sync.example .env.sync
```

Open `.env.sync` and fill it in:

```
DISCORD_BOT_TOKEN=paste-the-bot-token-here
GOOGLE_APPLICATION_CREDENTIALS=secrets/service-account.json
SYNC_BACKFILL_DAYS=14
```

- `SYNC_BACKFILL_DAYS`: on the very first run, how many days of joins and messages to look back (1–30).

`.env.sync` is ignored by git, like `.env.local`.

## Part 4: Connect the server in Pulse

1. Publish the latest app and security rules once: `npm run deploy`. Managers need the new rule to press Update.
2. In Discord, go to **User Settings → Advanced** and switch on **Developer Mode**. Right-click your server's icon → **Copy Server ID**.
3. In Pulse, open **Settings → Integrations → Discord**. Paste the Server ID.
4. **Invite links:** new members are credited to the invite link they used.
   - Partners whose **tracking code** is a Discord invite (e.g. `discord.gg/flush-sam`) are matched automatically, under the partner's name.
   - Add your other links with a name. For example: `discord.gg/flush-x` → `X bio`, `discord.gg/flush-site` → `Website`.
   - Tip: create a separate invite link for each place you share one, so each source can be told apart.
5. Click **Connect Discord**. Pulse also adds Discord to the workspace's platforms if it's missing.

## Part 5: First run

```bash
npm run sync
```

It prints what it did, for example:

```
10:42:01 Flush.io: syncing Discord…
10:42:09 Flush.io: Flush: 1,284 members · first run, looked back 14 days · 6,912 new messages.
```

Reload Pulse. The Discord numbers for the last 14 days now come from your server.

- **Sample data is replaced:** the sample (or imported) Discord numbers for those days are overwritten. Older sample days stay until you remove them.
- **First-run sources:** joins found on the first run are labelled **"Before tracking"**, because Discord can't say which link someone used in the past. From the second run on, sources are tracked.
- **Retention:** 7-day retention starts showing 7 days after the first run.

## Part 6: Use the Update button

Start the script in listening mode and leave the terminal open:

```bash
npm run sync:watch
```

```
10:50:12 Watching Flush.io
10:50:12 Pulse sync is listening on BRUNO-PC. It fetches only when someone presses Update data in the app. Press Ctrl+C to stop.
```

Now **Update data** at the bottom of Pulse's menu works for every admin and manager. The script fetches only when the button is pressed. Settings → Integrations shows which computer is listening. Stop it with Ctrl+C. While it's stopped, a press waits ("Waiting for the sync script") and runs as soon as the script is started again.

While it listens, the script tells Pulse every 5 minutes that it's there. That fetches nothing from Discord; it's how the button knows whether anyone will answer.

Where to leave it open:

- **Your PC:** a terminal in VS Code is enough while you work. If your PC is off, nobody else can update.
- **The company server** (always on), so anyone can update at any time: copy the project there (or `git clone` it), add `.env.sync` and `secrets/`, run `npm install`, then keep it running with pm2:
  ```bash
  npx pm2 start npm --name pulse-sync -- run sync:watch
  npx pm2 save
  ```

## Part 7: Make the Discord KPIs automatic

In **KPIs & Goals → Definitions**, edit each KPI (or add it from **Templates**):

| KPI | Source | Calculation |
|---|---|---|
| New members by source | Calculated | New members from tracked invite links |
| Discord members | Calculated | Members at the end of the period |
| Weekly active members | Calculated | Members who posted in the last 7 days ÷ members (Discord sync) |
| 7-day retention | Calculated | Newcomers still in the server 7 days after joining (Discord sync) |

Set the KPI's platform to **Discord**. Old hand-entered values stay in the history, as hand corrections of those weeks. Prefer to keep typing a KPI in yourself? Leave it as entered by hand: the sync doesn't touch it.

## Correcting numbers by hand

Everything the sync brings in can be changed by hand at any time, and the button never overwrites what you corrected:

- **One day's numbers:** go to **KPIs & Goals → Daily numbers**, pick Discord and the week, and click **Edit** on a day. You can change members, new members by source, leavers, messages, people who posted, and the retention counts. Days without numbers have **Add**. Changed fields get a pencil mark and are **kept** the next time someone presses Update data. To let updates fill a field again, open the day and click **Let updates replace my edits**.
- **A KPI's whole week or month:** in **KPIs & Goals → Overview**, click a calculated KPI (e.g. weekly active members). In its history, type a value for that week or month. The typed value replaces the calculation for that period, and the calculated one is shown under it. Clear the box to go back. Overridden values show a pencil mark in the Overview.
- **KPIs entered by hand** stay exactly as before (Enter results). A KPI doesn't have to be switched to calculated at all.

Only admins can correct numbers (the same as entering results).

## What each number means

| Number | How it's counted |
|---|---|
| Members | People in the server, bots excluded, at the time of the run. On the first run, earlier days are estimated from join dates. |
| New members | People who appeared since the last run, on the day they joined. |
| By source | How much each invite link's use count went up since the last run, under the name you gave it (unnamed links show as "Invite code"). Joins no invite explains (Server Discovery, a deleted link) show as "Other (no tracked invite)". |
| Leavers | People gone since the last run, counted on the day of the run (Discord doesn't say when they left). |
| Messages | Normal messages and replies by people, in every channel and active thread the bot can see. Bots, webhooks and system messages (joins, pins, boosts) aren't counted. |
| Active / weekly active | Different people who posted that day / in the 7 days up to that day. Weekly active % = weekly active ÷ members. |
| 7-day retention | Of the people seen joining on a day, the share still in the server 7 days later. A week's value covers newcomers whose 7th day fell in that week. |

**Not counted:** voice-chat minutes, reactions and archived threads. Those would need a bot that stays connected all the time.

## Privacy and limits

- **What's stored:** Discord user IDs (numbers) of members and of recent posters, in a part of Firestore the app can't read (`integrationState/`). They're only used to compare runs. Names and message text are never stored, and the bot can't read message text.
- **Free plan use:** an update writes about 20 documents. While listening, the 5-minute check-in adds about 300 writes a day. The free plan allows 20,000 writes a day.
- **Server size:** fine up to about 25,000 members. Beyond that, the member list no longer fits in one Firestore document, and the script needs a change.

## Troubleshooting

| You see | Fix |
|---|---|
| "Discord refused the bot token" | Reset the token (part 1, step 3) and paste it into `.env.sync`. |
| "The bot can't list members" | Switch on **Server Members Intent** (part 1, step 3). |
| "The bot isn't in that server, or the server ID is wrong" | Re-check the Server ID in Settings → Integrations, and that the bot appears in the server's member list. |
| "The bot can't read invites" | Give the bot **Manage Server**: Server Settings → Roles → the bot's role. |
| "Skipped N channel(s)" | Normal for staff-only channels. Add the bot to the channels you want counted. |
| Update stays on "Waiting for the sync script" | Nothing is listening. Start `npm run sync:watch` (part 6). |
| "Can't read the service-account key" | Check the path in `.env.sync`, relative to the project folder. |
| `node: bad option: --env-file-if-exists` | Node is too old. Install Node 22.18+ (24 recommended). |
