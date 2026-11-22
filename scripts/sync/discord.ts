// Reads a Discord server through the bot API (REST only, no always-on connection).
// Needs: the bot in the server, "Server Members Intent" switched on, and the permissions
// View Channels, Read Message History and Manage Server (for invite counts). See docs/discord.md.
import { snowflakeAt, type DiscordMessage, type DiscordSnapshot } from '../../src/lib/discordSync.ts';

const API = 'https://discord.com/api/v10';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DiscordError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** GET with the bot token, waiting politely when Discord asks us to slow down. */
async function get<T>(token: string, path: string): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}`, 'User-Agent': 'PulseSync (https://github.com, 1.0)' } });
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.ceil((body.retry_after ?? 1) * 1000) + 100);
      continue;
    }
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      await sleep(Math.ceil(Number(res.headers.get('x-ratelimit-reset-after') ?? '1') * 1000));
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new DiscordError(`${res.status} ${body.message ?? res.statusText} (${path.split('?')[0]})`, res.status);
    }
    return (await res.json()) as T;
  }
  throw new DiscordError(`Discord kept asking to slow down (${path.split('?')[0]})`, 429);
}

interface ApiGuild {
  id: string;
  name: string;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}
interface ApiMember {
  user?: { id: string; bot?: boolean };
  joined_at: string;
}
interface ApiInvite {
  code: string;
  uses?: number;
}
interface ApiChannel {
  id: string;
  type: number;
  name?: string;
}
interface ApiMessage {
  id: string;
  type: number;
  timestamp: string;
  author: { id: string; bot?: boolean; system?: boolean };
  webhook_id?: string;
}

// Text, announcement, and thread channels (public, private, announcement threads).
const TEXT_TYPES = new Set([0, 5, 10, 11, 12]);
// Normal messages and replies; not joins, pins, boosts or other system messages.
const PEOPLE_MESSAGE_TYPES = new Set([0, 19]);

/** A clear message for the usual set-up mistakes. */
export function explain(e: unknown): string {
  if (!(e instanceof DiscordError)) return (e as Error).message;
  if (e.status === 401) return 'Discord refused the bot token. Copy it again from the Developer Portal (Bot → Reset Token) into .env.sync.';
  if (e.message.includes('/members')) return 'The bot can’t list members. Switch on “Server Members Intent” in the Developer Portal (Bot → Privileged Gateway Intents).';
  if (e.status === 404 || (e.status === 403 && e.message.includes('/guilds/'))) return 'The bot isn’t in that server, or the server ID is wrong. Check Settings → Integrations and the invite step in docs/discord.md.';
  return e.message;
}

export interface FetchResult {
  snapshot: Omit<DiscordSnapshot, 'now' | 'timezone' | 'labels' | 'backfillDays'>;
  guildName: string;
  skippedChannels: string[];
  /** Channel id → newest message read (bots included), to start from next time. */
  cursors: Record<string, string>;
}

/**
 * Everything one sync run needs: members, invite counts, and the messages posted
 * since the last run (or since `since` for channels never read before).
 */
export async function fetchDiscord(token: string, guildId: string, lastMessageIds: Record<string, string>, since: Date): Promise<FetchResult> {
  const guild = await get<ApiGuild>(token, `/guilds/${guildId}?with_counts=true`);

  const members: { id: string; joinedAt: string }[] = [];
  let after = '0';
  for (;;) {
    const page = await get<ApiMember[]>(token, `/guilds/${guildId}/members?limit=1000&after=${after}`);
    for (const m of page) if (m.user && !m.user.bot) members.push({ id: m.user.id, joinedAt: m.joined_at });
    if (page.length < 1000) break;
    after = page[page.length - 1].user!.id;
  }

  let invites: { code: string; uses: number }[] | null = null;
  try {
    const list = await get<ApiInvite[]>(token, `/guilds/${guildId}/invites`);
    invites = list.map((i) => ({ code: i.code, uses: i.uses ?? 0 }));
    try {
      const vanity = await get<{ code: string | null; uses: number }>(token, `/guilds/${guildId}/vanity-url`);
      if (vanity.code) invites.push({ code: vanity.code, uses: vanity.uses });
    } catch {
      // No vanity link on this server.
    }
  } catch (e) {
    if (!(e instanceof DiscordError) || e.status !== 403) throw e;
  }

  const channels = (await get<ApiChannel[]>(token, `/guilds/${guildId}/channels`)).filter((c) => TEXT_TYPES.has(c.type));
  const threads = await get<{ threads: ApiChannel[] }>(token, `/guilds/${guildId}/threads/active`).catch(() => ({ threads: [] as ApiChannel[] }));
  const all = [...channels, ...threads.threads.filter((t) => TEXT_TYPES.has(t.type))];

  const sinceId = snowflakeAt(since.getTime());
  const messages: DiscordMessage[] = [];
  const skippedChannels: string[] = [];
  const cursors: Record<string, string> = {};
  for (const ch of all) {
    let cursor = lastMessageIds[ch.id] ?? sinceId;
    try {
      for (;;) {
        const page = await get<ApiMessage[]>(token, `/channels/${ch.id}/messages?limit=100&after=${cursor}`);
        if (!page.length) break;
        for (const msg of page) {
          if (BigInt(msg.id) > BigInt(cursor)) cursor = msg.id;
          if (msg.author.bot || msg.author.system || msg.webhook_id || !PEOPLE_MESSAGE_TYPES.has(msg.type)) continue;
          messages.push({ id: msg.id, channelId: ch.id, authorId: msg.author.id, at: msg.timestamp });
        }
        if (page.length < 100) break;
      }
      // How far this channel was read, even when its newest messages were from bots.
      if (cursor !== (lastMessageIds[ch.id] ?? sinceId)) cursors[ch.id] = cursor;
    } catch (e) {
      // Channels the bot can't see (private, staff-only) are skipped.
      if (e instanceof DiscordError && (e.status === 403 || e.status === 404)) skippedChannels.push(ch.name ?? ch.id);
      else throw e;
    }
  }

  return {
    snapshot: { members, online: guild.approximate_presence_count ?? null, invites, messages },
    guildName: guild.name,
    skippedChannels,
    cursors,
  };
}
