// Pulse sync: fetches numbers from Discord and writes them into Firestore as daily stats.
//
//   npm run sync          run once for every workspace with Discord connected, then stop
//   npm run sync:watch    keep running and wait: fetch only when someone presses Update data in the app
//
// Settings come from .env.sync (see .env.sync.example and docs/discord.md).
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import type { Partner, SyncState, Workspace } from '../../src/data/types.ts';
import { applyDiscordRun, inviteCode, newerId, type DiscordState } from '../../src/lib/discordSync.ts';
import { explain, fetchDiscord } from './discord.ts';

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const ONLY = args.includes('--workspace') ? args[args.indexOf('--workspace') + 1] : null;
const TOKEN = process.env.DISCORD_BOT_TOKEN?.trim() ?? '';
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? '';
const BACKFILL_DAYS = Math.max(1, Math.min(30, Number(process.env.SYNC_BACKFILL_DAYS ?? 14) || 14));
const HEARTBEAT_MS = 5 * 60_000;
const RUNNER = hostname();

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
const log = (...xs: unknown[]) => console.log(new Date().toLocaleTimeString(), ...xs);

if (!KEY_FILE) fail('GOOGLE_APPLICATION_CREDENTIALS is empty. Put the path of the Firebase service-account key in .env.sync (docs/discord.md, part 2).');
let key: { project_id?: string };
try {
  key = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
} catch {
  fail(`Can’t read the service-account key at “${KEY_FILE}”. Check the path in .env.sync.`);
}
if (!TOKEN) fail('DISCORD_BOT_TOKEN is empty. Put the bot token in .env.sync (docs/discord.md, part 1).');

initializeApp({ credential: cert(KEY_FILE), projectId: key.project_id });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const syncRef = (wsId: string) => db.doc(`workspaces/${wsId}/sync/state`) as DocumentReference<Partial<SyncState>>;
// Kept outside `workspaces`, where the security rules let no app user read it (member ids).
const stateRef = (wsId: string) => db.doc(`integrationState/${wsId}_discord`);
const membersRef = (wsId: string) => db.doc(`integrationState/${wsId}_discord_members`);

const now = () => new Date().toISOString();

/** Invite code → name in Pulse: partners' tracking links, then the labels set in Settings. */
async function labelsFor(ws: Workspace) {
  const labels: Record<string, string> = {};
  const partners = await db.collection(`workspaces/${ws.id}/partners`).get();
  for (const d of partners.docs) {
    const p = d.data() as Partner;
    const code = p.trackingCode ? inviteCode(p.trackingCode) : null;
    if (code) labels[code] = p.name;
  }
  return { ...labels, ...(ws.integrations?.discord?.labels ?? {}) };
}

async function syncDiscord(ws: Workspace): Promise<string> {
  const guildId = ws.integrations!.discord!.guildId;
  const [stateSnap, membersSnap] = await Promise.all([stateRef(ws.id).get(), membersRef(ws.id).get()]);
  const prev: DiscordState | null = stateSnap.exists && membersSnap.exists ? ({ ...(stateSnap.data() as Omit<DiscordState, 'members'>), members: membersSnap.data()!.members } as DiscordState) : null;
  const started = new Date();
  const since = prev ? new Date(prev.lastRun) : new Date(started.getTime() - BACKFILL_DAYS * 86_400_000);

  const fetched = await fetchDiscord(TOKEN, guildId, prev?.lastMessageIds ?? {}, since);
  const { state, rows, summary, warnings } = applyDiscordRun(prev, {
    ...fetched.snapshot,
    now: started,
    timezone: ws.timezone || 'UTC',
    labels: await labelsFor(ws),
    backfillDays: BACKFILL_DAYS,
  });
  for (const [ch, id] of Object.entries(fetched.cursors)) state.lastMessageIds[ch] = newerId(state.lastMessageIds[ch], id);

  const batch = db.batch();
  for (const row of rows) {
    const id = `${ws.id}_discord_${row.date}`;
    batch.set(db.doc(`workspaces/${ws.id}/stats/${id}`), { id, wsId: ws.id, ...row });
  }
  const { members, ...rest } = state;
  batch.set(stateRef(ws.id), rest);
  batch.set(membersRef(ws.id), { members });
  await batch.commit();

  const parts = [
    `${fetched.guildName}: ${summary.members.toLocaleString('en-US')} members`,
    summary.first ? `first run, looked back ${BACKFILL_DAYS} days` : `${summary.newMembers} joined, ${summary.leaves} left`,
    `${summary.messages.toLocaleString('en-US')} new messages`,
  ];
  const notes = [...warnings];
  if (fetched.skippedChannels.length) notes.push(`Skipped ${fetched.skippedChannels.length} channel(s) the bot can’t read: ${fetched.skippedChannels.slice(0, 5).join(', ')}${fetched.skippedChannels.length > 5 ? '…' : ''}.`);
  return [parts.join(' · ') + '.', ...notes].join(' ');
}

/** One workspace: mark it running, sync, then record the outcome for the app. */
async function runWorkspace(ws: Workspace) {
  if (!ws.integrations?.discord?.guildId) return;
  const ref = syncRef(ws.id);
  const startedAt = now();
  await ref.set({ id: 'state', wsId: ws.id, status: 'running', startedAt, ...(WATCH ? { runner: RUNNER, runnerSeenAt: startedAt } : {}) }, { merge: true });
  log(`${ws.name}: syncing Discord…`);
  let status: SyncState['status'] = 'done';
  let message: string;
  try {
    message = await syncDiscord(ws);
    log(`${ws.name}: ${message}`);
  } catch (e) {
    status = 'error';
    message = explain(e);
    log(`${ws.name}: ✖ ${message}`);
  }
  // Someone pressed Update again while this ran: leave it requested so it runs once more.
  const latest = (await ref.get()).data();
  const again = !!latest?.requestedAt && latest.requestedAt > startedAt;
  await ref.set({ status: again ? 'requested' : status, finishedAt: now(), message }, { merge: true });
  return status;
}

async function loadWorkspaces(): Promise<Workspace[]> {
  const snap = await db.collection('workspaces').get();
  return snap.docs.map((d) => d.data() as Workspace).filter((w) => w.integrations?.discord?.guildId && (!ONLY || w.id === ONLY));
}

async function once() {
  const list = await loadWorkspaces();
  if (!list.length) fail(ONLY ? `Workspace “${ONLY}” has no Discord server set. Add it in Settings → Integrations.` : 'No workspace has Discord connected yet. Add the server ID in Settings → Integrations.');
  let failed = 0;
  for (const ws of list) if ((await runWorkspace(ws)) === 'error') failed++;
  process.exit(failed ? 1 : 0);
}

function watch() {
  const workspaces = new Map<string, Workspace>();
  const unsubs = new Map<string, () => void>();
  let queue = Promise.resolve();
  const running = new Set<string>();
  const enqueue = (wsId: string) => {
    if (running.has(wsId)) return;
    running.add(wsId);
    queue = queue.then(async () => {
      const ws = workspaces.get(wsId);
      try {
        if (ws) await runWorkspace(ws);
      } catch (e) {
        log(`${ws?.name ?? wsId}: ✖ ${(e as Error).message}`);
      } finally {
        running.delete(wsId);
      }
    });
  };

  const heartbeat = () => {
    for (const id of workspaces.keys()) void syncRef(id).set({ id: 'state', wsId: id, runnerSeenAt: now(), runner: RUNNER }, { merge: true }).catch(() => undefined);
  };

  db.collection('workspaces').onSnapshot(
    (snap) => {
      const seen = new Set<string>();
      for (const d of snap.docs) {
        const ws = d.data() as Workspace;
        if (!ws.integrations?.discord?.guildId || (ONLY && ws.id !== ONLY)) continue;
        seen.add(ws.id);
        const isNew = !workspaces.has(ws.id);
        workspaces.set(ws.id, ws);
        if (isNew) {
          log(`Watching ${ws.name}`);
          void syncRef(ws.id).set({ id: 'state', wsId: ws.id, runnerSeenAt: now(), runner: RUNNER }, { merge: true });
          unsubs.set(
            ws.id,
            syncRef(ws.id).onSnapshot((s) => {
              if (s.data()?.status === 'requested') enqueue(ws.id);
            }),
          );
        }
      }
      for (const id of [...workspaces.keys()]) {
        if (seen.has(id)) continue;
        unsubs.get(id)?.();
        unsubs.delete(id);
        workspaces.delete(id);
      }
    },
    (e) => fail(`Can’t read workspaces from Firestore: ${e.message}`),
  );

  setInterval(heartbeat, HEARTBEAT_MS);

  const stop = async () => {
    log('Stopping…');
    await Promise.all([...workspaces.keys()].map((id) => syncRef(id).set({ runnerSeenAt: null }, { merge: true }).catch(() => undefined)));
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
  log(`Pulse sync is listening on ${RUNNER}. It fetches only when someone presses Update data in the app. Press Ctrl+C to stop.`);
}

if (WATCH) watch();
else void once();
