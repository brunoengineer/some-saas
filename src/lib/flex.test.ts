// The flexible parts: formula KPIs, extra calculations, campaign status by
// hand, report editing (removed / added parts) and link safety.
import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { FLUSH } from '@/data/seed/flush';
import type { Kpi } from '@/data/types';
import { wsData } from '@/data/wsData';
import { safeUrl } from './format';
import { campaignState, kpiValue, onDashboard, totalsFor, NO_FILTERS } from './metrics';
import { periodFor, type Period } from './period';
import { buildDeck } from './pptx';
import { reportKpi, reportKpis } from './report';

const db = buildSeed();
const d = wsData(db, FLUSH);
const week4 = periodFor('week', '2026-11-11', 1);
const base: Kpi = { ...d.kpis[0], id: 'k-test', name: 'Test', targets: [], paused: false, onDashboard: undefined };

describe('formula KPIs', () => {
  const impressions: Kpi = { ...base, id: 'k-imp', source: 'calc', calc: 'impressions', platform: 'x' };
  const engagements: Kpi = { ...base, id: 'k-eng', source: 'calc', calc: 'engagements', platform: 'x' };
  const withKpis = (...ks: Kpi[]) => ({ ...d, kpis: [...d.kpis, ...ks] });

  it('divides one KPI by another, as a percentage', () => {
    const rate: Kpi = { ...base, id: 'k-rate', source: 'formula', calc: null, formula: { a: 'k-eng', op: 'divide', b: 'k-imp', percent: true } };
    const dd = withKpis(impressions, engagements, rate);
    const er = kpiValue({ ...base, source: 'calc', calc: 'engagementRate', platform: 'x' }, dd, week4).value!;
    expect(kpiValue(rate, dd, week4).value!).toBeCloseTo(er, 6);
  });

  it('returns no value when a part is missing, or when a formula uses itself', () => {
    const broken: Kpi = { ...base, id: 'k-b', source: 'formula', calc: null, formula: { a: 'k-gone', op: 'add', b: 'k-imp', percent: false } };
    const loop: Kpi = { ...base, id: 'k-loop', source: 'formula', calc: null, formula: { a: 'k-loop', op: 'add', b: 'k-loop', percent: false } };
    const dd = withKpis(impressions, broken, loop);
    expect(kpiValue(broken, dd, week4).value).toBeNull();
    expect(kpiValue(loop, dd, week4).value).toBeNull();
  });

  it('new calculations agree with the totals', () => {
    const t = totalsFor(d, week4, NO_FILTERS);
    expect(kpiValue({ ...base, source: 'calc', calc: 'engagements', platform: null }, d, week4).value).toBe(t.engagements);
    const avg = kpiValue({ ...base, source: 'calc', calc: 'avgImpressions', platform: null }, d, week4).value!;
    expect(avg).toBeCloseTo(t.impressions / t.posts, 6);
  });
});

describe('dashboard and tracking choices', () => {
  it('weekly KPIs are on the dashboard unless turned off; paused ones never', () => {
    expect(onDashboard({ ...base, group: 'weekly' })).toBe(true);
    expect(onDashboard({ ...base, group: 'other' })).toBe(false);
    expect(onDashboard({ ...base, group: 'other', onDashboard: true })).toBe(true);
    expect(onDashboard({ ...base, group: 'weekly', onDashboard: false })).toBe(false);
    expect(onDashboard({ ...base, group: 'weekly', paused: true })).toBe(false);
  });
});

describe('campaign status', () => {
  const c = d.campaigns[0];
  it('follows the dates unless set by hand', () => {
    expect(campaignState({ ...c, start: '2026-12-01', end: '2026-12-31', status: null }, '2026-11-22')).toBe('planned');
    expect(campaignState({ ...c, start: '2026-12-01', end: '2026-12-31', status: 'live' }, '2026-11-22')).toBe('live');
    expect(campaignState({ ...c, start: '2026-10-01', end: '2026-10-31', status: 'live' }, '2026-11-22')).toBe('live');
    expect(campaignState({ ...c, start: '2026-10-01', end: '2026-12-31', status: 'done' }, '2026-11-22')).toBe('done');
  });
});

describe('report editing', () => {
  const report = db.reports.find((r) => r.id === 'r-w4')!;
  const ws = db.workspaces.find((w) => w.id === report.wsId)!;
  const p: Period = { type: 'custom', start: report.start, end: report.end };

  it('removes and adds KPI tiles', () => {
    const first = report.snapshot.kpis[0];
    const extraKpi = d.kpis.find((k) => !report.snapshot.kpis.some((x) => x.id === k.id))!;
    const added = reportKpi(extraKpi, d, report.type, p, null);
    const n = { ...report.narrative, hiddenKpis: [first.id], addedKpis: [added] };
    const ids = reportKpis(report, n).map((k) => k.id);
    expect(ids).not.toContain(first.id);
    expect(ids).toContain(extraKpi.id);
  });

  it('the PowerPoint follows the edits', async () => {
    const slides = async (r: typeof report) => ((await buildDeck(r, ws)) as unknown as { slides: unknown[] }).slides.length;
    const plain = await slides(report);
    const fewer = await slides({ ...report, narrative: { ...report.narrative, hidden: ['actions', 'topPosts', 'partners'] } });
    const more = await slides({ ...report, narrative: { ...report.narrative, cards: [{ id: 'c1', label: 'Sign-ups', value: '120', note: '' }], sections: [{ id: 's1', title: 'Community', body: 'Great week.' }] } });
    expect(fewer).toBe(plain - 2);
    expect(more).toBe(plain + 2);
  });
});

describe('links people type', () => {
  it('only web addresses become links', () => {
    expect(safeUrl('https://x.com/flush/status/1')).toBe('https://x.com/flush/status/1');
    expect(safeUrl(' http://kick.com/sam ')).toBe('http://kick.com/sam');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('x.com/flush')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });
});
