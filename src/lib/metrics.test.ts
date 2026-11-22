import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { FLUSH } from '@/data/seed/flush';
import { wsData } from '@/data/wsData';
import { formatDelta } from './format';
import { calcValue, kpiValue, NO_FILTERS, partnerRows, pillarStats, topPosts, totalsFor } from './metrics';
import { periodFor, previousPeriod, type Period } from './period';
import { buildSnapshot } from './report';

// The Flush sample data must reproduce the proposal's example report.
const db = buildSeed();
const d = wsData(db, FLUSH);
const week4 = periodFor('week', '2026-11-11', 1);
const month1: Period = { type: 'custom', start: '2026-10-19', end: '2026-11-15' };
const kpi = (id: string) => d.kpis.find((k) => k.id === id)!;
const value = (id: string, p: Period) => kpiValue(kpi(id), d, p).value;

describe('week 4 (9-15 Nov 2026)', () => {
  it('is a Monday-Sunday week', () => {
    expect(week4).toMatchObject({ start: '2026-11-09', end: '2026-11-15' });
  });

  it('matches the weekly six', () => {
    expect(value('k-er', week4)!.toFixed(1)).toBe('4.8');
    expect(value('k-netf', week4)).toBe(186);
    expect(value('k-clicks', week4)).toBe(142);
    expect(value('k-newm', week4)).toBe(128);
    expect(value('k-active', week4)).toBe(46);
    expect(value('k-ret', week4)).toBe(61);
  });

  it('matches the changes vs week 3', () => {
    const w3 = previousPeriod(week4);
    expect(formatDelta('percent', value('k-er', week4), value('k-er', w3))?.text).toBe('0.6 pts');
    expect(formatDelta('number', value('k-netf', week4), value('k-netf', w3))).toEqual({ text: '9%', dir: 'down' });
    expect(formatDelta('number', value('k-clicks', week4), value('k-clicks', w3))).toEqual({ text: '38%', dir: 'up' });
  });

  it('has the right totals and top post', () => {
    const t = totalsFor(d, week4, NO_FILTERS);
    expect(t.followers).toBe(522);
    expect(t.members).toBe(291);
    expect(topPosts(d, week4, NO_FILTERS, 1)[0].title).toContain('Not everyone gets a seat');
    expect(calcValue('creatorMembers', d, week4, NO_FILTERS, null)).toBe(41);
  });
});

describe('month 1 (19 Oct - 15 Nov 2026)', () => {
  it('matches the monthly numbers', () => {
    const t = totalsFor(d, month1, NO_FILTERS);
    expect(t.followers).toBe(522);
    expect(t.impressions).toBe(64300);
    expect(t.rate!.toFixed(1)).toBe('4.4');
    expect(t.posts).toBe(92);
    expect(t.profileClicks).toBe(286);
    expect(t.profileVisits).toBe(3240);
    expect(t.members).toBe(291);
    expect(t.joins).toBe(312);
    expect(t.leaves).toBe(21);
    expect(t.messages).toBe(5140);
  });

  it('ranks the three top posts like the proposal', () => {
    const titles = topPosts(d, month1, NO_FILTERS, 3).map((p) => p.title);
    expect(titles[0]).toContain('Not everyone gets a seat');
    expect(titles[1]).toContain('trust a new casino');
    expect(titles[2]).toContain('Day 3');
  });
});

describe('filters and partners', () => {
  it('campaign filter narrows post-based KPIs only', () => {
    const f = { ...NO_FILTERS, campaignId: 'c-draw' };
    const all = kpiValue(kpi('k-impr'), d, week4).value!;
    const draw = kpiValue(kpi('k-impr'), d, week4, f);
    expect(draw.value!).toBeLessThan(all);
    expect(draw.scoped).toBe(true);
    expect(kpiValue(kpi('k-netf'), d, week4, f)).toEqual({ value: 186, scoped: false });
  });

  it('partner rows add up to creator joins', () => {
    const rows = partnerRows(d, week4, NO_FILTERS);
    expect(rows.reduce((s, r) => s + r.newMembers, 0)).toBe(41);
  });

  it('snapshot keeps the weekly six', () => {
    const s = buildSnapshot(d, 'weekly', week4, null);
    expect(s.kpis.filter((k) => k.group === 'weekly')).toHaveLength(6);
    expect(s.kpis.find((k) => k.id === 'k-clicks')!.detail).toBe('97 discord · 45 site');
  });
});


describe('pillar stats', () => {
  it('splits month 1 across the five pillars', () => {
    const { pillars, total, unassigned } = pillarStats(d, month1, null, null);
    expect(pillars.map((p) => p.id)).toEqual(['fun', 'bip', 'players', 'trust', 'promos']);
    expect(total).toBe(92);
    expect(unassigned).toBe(0);
    expect(pillars.reduce((s, p) => s + p.posts, 0)).toBe(92);
    expect(pillars.reduce((s, p) => s + p.share, 0)).toBeCloseTo(100);
    expect(pillars.reduce((s, p) => s + p.impressions, 0)).toBe(totalsFor(d, month1, NO_FILTERS).impressions);
    for (const p of pillars) expect(p.gap).toBeCloseTo(p.share - p.target);
  });

  it('compares the rate with the previous period and picks the best post', () => {
    const { pillars } = pillarStats(d, week4, previousPeriod(week4), null);
    const fun = pillars.find((p) => p.id === 'fun')!;
    expect(fun.prevRate).not.toBeNull();
    const best = Math.max(...d.posts.filter((p) => p.pillarId === 'fun' && p.status === 'published' && p.date! >= week4.start && p.date!.slice(0, 10) <= week4.end).map((p) => p.metrics!.engagements / p.metrics!.impressions));
    expect(fun.top!.metrics!.engagements / fun.top!.metrics!.impressions).toBe(best);
  });
});
