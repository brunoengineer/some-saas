import { afterEach, describe, expect, it, vi } from 'vitest';
import { explain, fetchDiscord, DiscordError } from './discord.ts';

type Route = (url: URL) => { status?: number; body: unknown; headers?: Record<string, string> };

function fakeDiscord(routes: Record<string, Route>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input);
    const path = url.pathname.replace('/api/v10', '');
    calls.push(path + url.search);
    const route = Object.entries(routes).find(([p]) => new RegExp(`^${p}$`).test(path));
    if (!route) return new Response(JSON.stringify({ message: 'Unknown' }), { status: 404 });
    const r = route[1](url);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const msg = (id: string, author: string, extra: Record<string, unknown> = {}) => ({ id, type: 0, timestamp: '2026-11-22T15:00:00.000Z', author: { id: author }, ...extra });

describe('fetchDiscord', () => {
  it('reads members, invites and new messages; skips bots, system messages and hidden channels', async () => {
    let first429 = true;
    const calls = fakeDiscord({
      '/guilds/g1': () => ({ body: { id: 'g1', name: 'Flush', approximate_presence_count: 12 } }),
      '/guilds/g1/members': () => ({ body: [{ user: { id: 'u1' }, joined_at: '2026-11-01T00:00:00Z' }, { user: { id: 'bot', bot: true }, joined_at: '2026-11-01T00:00:00Z' }] }),
      '/guilds/g1/invites': () => ({ body: [{ code: 'flush-sam', uses: 7 }] }),
      '/guilds/g1/vanity-url': () => ({ status: 403, body: { message: 'Missing Access' } }),
      '/guilds/g1/channels': () => ({ body: [{ id: 'c1', type: 0, name: 'general' }, { id: 'c2', type: 0, name: 'staff' }, { id: 'v1', type: 2, name: 'voice' }] }),
      '/guilds/g1/threads/active': () => ({ body: { threads: [] } }),
      '/channels/c1/messages': (url) => {
        if (first429) {
          first429 = false;
          return { status: 429, body: { retry_after: 0.01 } };
        }
        return url.searchParams.get('after') === '100'
          ? { body: [msg('103', 'u1'), msg('102', 'botty', { author: { id: 'botty', bot: true } }), msg('101', 'u1', { type: 7 })] }
          : { body: [] };
      },
      '/channels/c2/messages': () => ({ status: 403, body: { message: 'Missing Access' } }),
    });

    const r = await fetchDiscord('token', 'g1', { c1: '100' }, new Date('2026-11-20T00:00:00Z'));
    expect(r.guildName).toBe('Flush');
    expect(r.snapshot.members).toEqual([{ id: 'u1', joinedAt: '2026-11-01T00:00:00Z' }]);
    expect(r.snapshot.online).toBe(12);
    expect(r.snapshot.invites).toEqual([{ code: 'flush-sam', uses: 7 }]);
    expect(r.snapshot.messages.map((m) => m.id)).toEqual(['103']);
    expect(r.cursors).toEqual({ c1: '103' });
    expect(r.skippedChannels).toEqual(['staff']);
    // Voice channels aren't read; the 429 was retried.
    expect(calls.some((c) => c.startsWith('/channels/v1'))).toBe(false);
    expect(calls.filter((c) => c.startsWith('/channels/c1/messages?limit=100&after=100'))).toHaveLength(2);
  });

  it('carries on without invites when the bot lacks Manage Server', async () => {
    fakeDiscord({
      '/guilds/g1': () => ({ body: { id: 'g1', name: 'Flush' } }),
      '/guilds/g1/members': () => ({ body: [] }),
      '/guilds/g1/invites': () => ({ status: 403, body: { message: 'Missing Permissions' } }),
      '/guilds/g1/channels': () => ({ body: [] }),
      '/guilds/g1/threads/active': () => ({ body: { threads: [] } }),
    });
    const r = await fetchDiscord('token', 'g1', {}, new Date());
    expect(r.snapshot.invites).toBeNull();
  });

  it('explains the usual set-up mistakes', async () => {
    fakeDiscord({ '/guilds/g1': () => ({ status: 200, body: { id: 'g1', name: 'Flush' } }), '/guilds/g1/members': () => ({ status: 403, body: { message: 'Missing Access' } }) });
    const e = await fetchDiscord('token', 'g1', {}, new Date()).catch((x) => x);
    expect(e).toBeInstanceOf(DiscordError);
    expect(explain(e)).toContain('Server Members Intent');
    expect(explain(new DiscordError('401 Unauthorized (/guilds/g1)', 401))).toContain('bot token');
    expect(explain(new DiscordError('404 Unknown Guild (/guilds/g1)', 404))).toContain('server ID');
  });
});
