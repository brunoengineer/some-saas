import { describe, expect, it } from 'vitest';
import { addDays, applyDiscordRun, capCounts, dayIn, interleave, inviteCode, NOT_TRACKED, OTHER_SOURCE, snowflakeAt, snowflakeTime, type DiscordSnapshot } from './discordSync';

const TZ = 'America/Toronto';
const at = (day: string, hour = 15) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;
const snap = (over: Partial<DiscordSnapshot>): DiscordSnapshot => ({
  now: new Date(at('2026-11-22')),
  timezone: TZ,
  members: [],
  online: 10,
  invites: [],
  messages: [],
  labels: {},
  backfillDays: 7,
  ...over,
});

describe('helpers', () => {
  it('reads days in the workspace timezone', () => {
    expect(dayIn('2026-11-22T03:00:00Z', TZ)).toBe('2026-11-21');
    expect(dayIn('2026-11-22T15:00:00Z', TZ)).toBe('2026-11-22');
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
  });

  it('turns tracking links into invite codes', () => {
    expect(inviteCode('discord.gg/flush-sam')).toBe('flush-sam');
    expect(inviteCode('https://discord.com/invite/AbC12')).toBe('AbC12');
    expect(inviteCode('flush.io/?ref=cliplab')).toBeNull();
  });

  it('round-trips Discord ids and times', () => {
    const ms = Date.parse('2026-11-20T00:00:00Z');
    expect(snowflakeTime(snowflakeAt(ms))).toBe(ms);
  });

  it('interleaves sources with exact totals', () => {
    const out = interleave({ A: 3, B: 1 });
    expect(out).toHaveLength(4);
    expect(out.filter((x) => x === 'A')).toHaveLength(3);
    expect(out.slice(0, 2)).toContain('A');
  });

  it('caps invite uses to the number of new members', () => {
    const c = capCounts({ A: 6, B: 3, C: 1 }, 5);
    expect(Object.values(c).reduce((s, n) => s + n, 0)).toBe(5);
    expect(c.A).toBeGreaterThanOrEqual(c.B);
    expect(capCounts({ A: 1 }, 5)).toEqual({ A: 1 });
  });
});

describe('applyDiscordRun', () => {
  const m = (id: string, day: string) => ({ id, joinedAt: at(day) });

  it('first run: looks back for joins and messages, without sources', () => {
    const { state, rows, summary } = applyDiscordRun(
      null,
      snap({
        members: [m('old', '2026-01-01'), m('a', '2026-11-18'), m('b', '2026-11-21'), m('c', '2026-11-22')],
        invites: [{ code: 'x-bio', uses: 40 }],
        messages: [
          { id: '1', channelId: 'ch', authorId: 'a', at: at('2026-11-21') },
          { id: '2', channelId: 'ch', authorId: 'a', at: at('2026-11-21', 16) },
          { id: '3', channelId: 'ch', authorId: 'b', at: at('2026-11-22') },
          { id: '0', channelId: 'ch', authorId: 'old', at: at('2026-11-01') },
        ],
      }),
    );
    expect(summary.newMembers).toBe(3);
    expect(state.trackingSince).toBe('2026-11-16');
    expect(state.invites['x-bio']).toBe(40);
    expect(state.lastMessageIds.ch).toBe('3');
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
    expect(rows[0].date).toBe('2026-11-16');
    expect(byDate['2026-11-18'].joins).toEqual({ [NOT_TRACKED]: 1 });
    expect(byDate['2026-11-17'].members).toBe(1);
    expect(byDate['2026-11-21'].members).toBe(3);
    expect(byDate['2026-11-22'].members).toBe(4);
    expect(byDate['2026-11-21'].messages).toBe(2);
    expect(byDate['2026-11-21'].active).toBe(1);
    // A message from before the look-back window isn't counted.
    expect(rows.reduce((s, r) => s + r.messages, 0)).toBe(3);
    // Retention can't be known for people who joined before tracking.
    expect(rows.every((r) => r.retained7 === null)).toBe(true);
  });

  it('later runs: sources from invite uses, leavers, and 7-day retention', () => {
    const first = applyDiscordRun(null, snap({ members: [m('old', '2026-01-01'), m('gone', '2026-02-01')], invites: [{ code: 'flush-sam', uses: 5 }, { code: 'x-bio', uses: 2 }] }));
    // Next day: 3 people joined (2 via Sam's link, 1 unknown), one left.
    const second = applyDiscordRun(
      first.state,
      snap({
        now: new Date(at('2026-11-23')),
        members: [m('old', '2026-01-01'), m('n1', '2026-11-23'), m('n2', '2026-11-23'), m('n3', '2026-11-22')],
        invites: [{ code: 'flush-sam', uses: 7 }, { code: 'x-bio', uses: 2 }],
        labels: { 'flush-sam': 'Sam Reyes' },
      }),
    );
    expect(second.summary).toMatchObject({ newMembers: 3, leaves: 1, first: false });
    const r22 = second.rows.find((r) => r.date === '2026-11-22')!;
    const r23 = second.rows.find((r) => r.date === '2026-11-23')!;
    const total = (j: Record<string, number>) => Object.values(j).reduce((s, n) => s + n, 0);
    expect(total(r22.joins) + total(r23.joins)).toBe(3);
    const all = { ...r22.joins };
    for (const [k, v] of Object.entries(r23.joins)) all[k] = (all[k] ?? 0) + v;
    expect(all).toEqual({ 'Sam Reyes': 2, [OTHER_SOURCE]: 1 });
    expect(r23.leaves).toBe(1);
    expect(r23.members).toBe(4);

    // A week later n2 has left: 2 of the 3 newcomers stayed.
    const later = applyDiscordRun(
      second.state,
      snap({ now: new Date(at('2026-11-30')), members: [m('old', '2026-01-01'), m('n1', '2026-11-23'), m('n3', '2026-11-22')], invites: [{ code: 'flush-sam', uses: 7 }] }),
    );
    const c22 = later.rows.find((r) => r.date === '2026-11-22')!;
    const c23 = later.rows.find((r) => r.date === '2026-11-23')!;
    expect(c22).toMatchObject({ cohortSize: 1, retained7: 1 });
    expect(c23).toMatchObject({ cohortSize: 2, retained7: 1 });
    expect(later.state.days['2026-11-23'].cohort).toBeUndefined();
  });

  it('counts people active over 7 days once complete days exist', () => {
    let state = applyDiscordRun(null, snap({ now: new Date(at('2026-11-10')), backfillDays: 1, members: [m('a', '2026-01-01')] })).state;
    let rows: ReturnType<typeof applyDiscordRun>['rows'] = [];
    for (let i = 1; i <= 7; i++) {
      const day = addDays('2026-11-10', i);
      const authors = i % 2 ? ['a', 'b'] : ['a', 'c'];
      ({ state, rows } = applyDiscordRun(state, snap({ now: new Date(at(day)), members: [m('a', '2026-01-01')], messages: authors.map((a, j) => ({ id: `${i}${j}`, channelId: 'ch', authorId: a, at: at(day) })) })));
    }
    const last = rows.find((r) => r.date === '2026-11-17')!;
    expect(last.active).toBe(2);
    expect(last.active7).toBe(3);
  });
});
