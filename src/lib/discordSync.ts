// The Discord counting rules, separate from the network code so they can be tested.
// Used by the sync script (scripts/sync), which runs in Node: keep this file free of
// imports other than `import type`, and of browser APIs.
import type { DailyStat } from '../data/types';

/** One day as the sync script remembers it (kept in Firestore, out of the app's reach). */
export interface DiscordDay {
  /** New members by source (invite label). */
  joins: Record<string, number>;
  leaves: number;
  messages: number;
  /** Members at the end of the day (approximate for days before tracking started). */
  members: number | null;
  online: number | null;
  /** Who posted that day (Discord user ids). Dropped after AUTHOR_DAYS. */
  authors?: string[];
  /** Who joined that day, seen live, so retention can be measured 7 days later. */
  cohort?: string[];
  cohortSize?: number | null;
  /** Of `cohort`, how many were still in the server 7 days later. */
  retained7?: number | null;
}

export interface DiscordState {
  /** Member id → the day they joined (in the workspace's timezone). */
  members: Record<string, string>;
  /** Invite code → uses at the last run. */
  invites: Record<string, number>;
  /** Channel id → the newest message already counted. */
  lastMessageIds: Record<string, string>;
  days: Record<string, DiscordDay>;
  /** First day with complete data. */
  trackingSince: string;
  lastRun: string;
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  authorId: string;
  /** ISO timestamp. */
  at: string;
}

export interface DiscordSnapshot {
  now: Date;
  timezone: string;
  /** Everyone in the server except bots. */
  members: { id: string; joinedAt: string }[];
  online: number | null;
  /** null when the bot may not read invites (no Manage Server permission). */
  invites: { code: string; uses: number }[] | null;
  /** Messages not counted yet (people only, no bots or system messages). */
  messages: DiscordMessage[];
  /** Invite code → label shown in Pulse (partner names, "X bio", …). */
  labels: Record<string, string>;
  /** First run only: how many days of joins and messages to look back. */
  backfillDays: number;
}

export type DiscordStatRow = Omit<DailyStat, 'id' | 'wsId'>;

export const KEEP_DAYS = 35;
export const AUTHOR_DAYS = 15;
export const NOT_TRACKED = 'Before tracking';
export const OTHER_SOURCE = 'Other (no tracked invite)';

/** The calendar day of a moment in a timezone, as yyyy-MM-dd. */
export function dayIn(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DISCORD_EPOCH = 1420070400000n;
/** The smallest Discord id created at or after a moment (to page messages "after" it). */
export const snowflakeAt = (ms: number) => ((BigInt(ms) - DISCORD_EPOCH) << 22n).toString();
export const snowflakeTime = (id: string) => Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
export const newerId = (a: string | undefined, b: string) => (!a || BigInt(b) > BigInt(a) ? b : a);

/** The invite code in a tracking link such as "discord.gg/flush-sam" or "https://discord.com/invite/abc". */
export function inviteCode(link: string): string | null {
  const m = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]+)/i.exec(link.trim());
  return m ? m[1] : null;
}

/**
 * Spread `total` picks over sources in proportion to their counts (smooth weighted
 * round robin): every source gets exactly its count, interleaved, so slicing the
 * result into consecutive days keeps each day's mix close to the overall mix.
 */
export function interleave(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const current = new Map(entries.map(([k]) => [k, 0]));
  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    let best = '';
    let bestW = -Infinity;
    for (const [k, n] of entries) {
      const w = current.get(k)! + n;
      current.set(k, w);
      if (w > bestW) {
        best = k;
        bestW = w;
      }
    }
    current.set(best, bestW - total);
    out.push(best);
  }
  return out;
}

/** Scale source counts down to `total` (largest remainder), when invites show more uses than new members. */
export function capCounts(counts: Record<string, number>, total: number): Record<string, number> {
  const sum = Object.values(counts).reduce((s, n) => s + n, 0);
  if (sum <= total) return { ...counts };
  const scaled = Object.entries(counts).map(([k, n]) => ({ k, exact: (n * total) / sum }));
  const out: Record<string, number> = {};
  for (const s of scaled) out[s.k] = Math.floor(s.exact);
  let left = total - Object.values(out).reduce((s, n) => s + n, 0);
  for (const s of [...scaled].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))) {
    if (left <= 0) break;
    out[s.k] += 1;
    left -= 1;
  }
  return out;
}

const emptyDay = (): DiscordDay => ({ joins: {}, leaves: 0, messages: 0, members: null, online: null, authors: [] });

/**
 * One sync run: compare what Discord shows now with what the last run saw.
 * Returns the new state to keep and the daily rows to write for Pulse.
 */
export function applyDiscordRun(prev: DiscordState | null, snap: DiscordSnapshot) {
  const tz = snap.timezone;
  const today = dayIn(snap.now, tz);
  const first = prev === null;
  const trackingSince = prev?.trackingSince ?? addDays(today, -(Math.max(1, snap.backfillDays) - 1));
  const oldest = addDays(today, -(KEEP_DAYS - 1));
  const days: Record<string, DiscordDay> = {};
  for (const [d, v] of Object.entries(prev?.days ?? {})) days[d] = { ...v, joins: { ...v.joins }, authors: v.authors ? [...v.authors] : undefined, cohort: v.cohort ? [...v.cohort] : undefined };
  const day = (d: string) => (days[d] ??= emptyDay());
  const touched = new Set<string>([today]);
  const warnings: string[] = [];

  const members: Record<string, string> = {};
  for (const m of snap.members) members[m.id] = dayIn(m.joinedAt, tz);

  // New members, by the day they joined.
  const newIds = Object.keys(members).filter((id) => (prev ? !(id in prev.members) : members[id] >= trackingSince));
  const byDay = new Map<string, string[]>();
  for (const id of newIds) {
    const d = members[id] < oldest ? today : members[id];
    byDay.set(d, [...(byDay.get(d) ?? []), id]);
  }

  // Where they came from: invite uses since the last run.
  const invites: Record<string, number> = { ...(prev?.invites ?? {}) };
  let sources: Record<string, number> = {};
  if (snap.invites) {
    for (const inv of snap.invites) {
      const before = prev?.invites[inv.code];
      if (!first && inv.uses > (before ?? 0)) {
        const label = snap.labels[inv.code] ?? `Invite ${inv.code}`;
        sources[label] = (sources[label] ?? 0) + inv.uses - (before ?? 0);
      }
      invites[inv.code] = inv.uses;
    }
  } else if (!first) warnings.push('The bot can’t read invites (it needs Manage Server), so new members aren’t split by source.');
  if (first) sources = { [NOT_TRACKED]: newIds.length };
  else {
    sources = capCounts(sources, newIds.length);
    const known = Object.values(sources).reduce((s, n) => s + n, 0);
    if (newIds.length > known) sources[OTHER_SOURCE] = (sources[OTHER_SOURCE] ?? 0) + newIds.length - known;
  }
  const picks = interleave(sources);
  let at = 0;
  for (const d of [...byDay.keys()].sort()) {
    const ids = byDay.get(d)!;
    const row = day(d);
    for (const label of picks.slice(at, at + ids.length)) row.joins[label] = (row.joins[label] ?? 0) + 1;
    at += ids.length;
    if (!first) row.cohort = [...(row.cohort ?? []), ...ids];
    touched.add(d);
  }

  // Who left since the last run (counted today: Discord doesn't say when).
  const left = prev ? Object.keys(prev.members).filter((id) => !(id in members)).length : 0;
  day(today).leaves += left;

  // Members now; on the first run, an estimate for earlier days from join dates.
  day(today).members = snap.members.length;
  day(today).online = snap.online;
  if (first) {
    const joinDays = Object.values(members).sort();
    for (let d = trackingSince; d < today; d = addDays(d, 1)) {
      let n = 0;
      for (const j of joinDays) if (j <= d) n++;
      else break;
      day(d).members = n;
      touched.add(d);
    }
  }

  // Messages and who posted.
  const lastMessageIds = { ...(prev?.lastMessageIds ?? {}) };
  for (const m of snap.messages) {
    lastMessageIds[m.channelId] = newerId(lastMessageIds[m.channelId], m.id);
    const d = dayIn(m.at, tz);
    if (d < trackingSince || d < oldest) continue;
    const row = day(d);
    row.messages += 1;
    if (!row.authors?.includes(m.authorId)) row.authors = [...(row.authors ?? []), m.authorId];
    touched.add(d);
  }

  // 7-day retention: people who joined 7 days ago and are still here.
  for (const [d, row] of Object.entries(days)) {
    if (row.cohort && row.cohort.length && addDays(d, 7) <= today && row.retained7 == null) {
      row.cohortSize = row.cohort.length;
      row.retained7 = row.cohort.filter((id) => id in members).length;
      row.cohort = undefined;
      touched.add(d);
    }
  }

  // Daily rows for Pulse, for every changed day (active-in-7-days moves with later days too).
  const from = [...touched].sort()[0];
  const authorsOf = (d: string) => days[d]?.authors;
  const rows: DiscordStatRow[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (d < oldest) continue;
    const row = day(d);
    let active7: number | null = null;
    if (addDays(d, -6) >= trackingSince && [0, 1, 2, 3, 4, 5, 6].every((i) => authorsOf(addDays(d, -i)))) {
      const set = new Set<string>();
      for (let i = 0; i < 7; i++) for (const a of authorsOf(addDays(d, -i))!) set.add(a);
      active7 = set.size;
    }
    rows.push({
      platform: 'discord',
      date: d,
      followers: null,
      members: row.members,
      clicks: {},
      joins: row.joins,
      leaves: row.leaves,
      profileVisits: 0,
      messages: row.messages,
      active: row.authors ? row.authors.length : null,
      active7,
      online: row.online,
      cohortSize: row.cohortSize ?? null,
      retained7: row.retained7 ?? null,
    });
  }

  // Forget what is no longer needed.
  for (const d of Object.keys(days)) {
    if (d < oldest) delete days[d];
    else if (d < addDays(today, -(AUTHOR_DAYS - 1))) days[d].authors = undefined;
  }

  const state: DiscordState = { members, invites, lastMessageIds, days, trackingSince, lastRun: snap.now.toISOString() };
  const summary = {
    newMembers: newIds.length,
    leaves: left,
    messages: snap.messages.length,
    members: snap.members.length,
    first,
  };
  return { state, rows, summary, warnings };
}
