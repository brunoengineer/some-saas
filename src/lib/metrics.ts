// Every number on the dashboard, KPI page, campaign page and report comes from
// here, so they always agree.
import type {
  CalcKey,
  Campaign,
  DailyStat,
  Deliverable,
  Kpi,
  KpiEntry,
  KpiFormula,
  KpiTarget,
  PartnerRow,
  Platform,
  Post,
  Status,
  WsData,
} from '@/data/types';
import { addDaysIso, eachDay, inPeriod, lengthInDays, monthEnd, overlaps, type Period } from './period';

export interface Filters {
  platform: Platform | null;
  campaignId: string | null;
  pillarId: string | null;
  partnerId: string | null;
}

export const NO_FILTERS: Filters = { platform: null, campaignId: null, pillarId: null, partnerId: null };

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** KPIs that read posts or deliverables respond to campaign/pillar/partner filters. */
export const SCOPED: Record<CalcKey, boolean> = {
  engagementRate: true,
  impressions: true,
  postsPublished: true,
  creatorMembers: true,
  netFollowers: false,
  followers: false,
  profileClicks: false,
  newMembers: false,
  members: false,
  engagements: true,
  postClicks: true,
  profileVisits: true,
  avgImpressions: true,
  partnerViews: true,
  partnerCost: true,
  costPerMember: true,
};

export const CALC_LABEL: Record<CalcKey, string> = {
  engagementRate: 'Engagements ÷ impressions of published posts',
  impressions: 'Sum of post impressions',
  postsPublished: 'Count of published posts',
  netFollowers: 'Followers at the end minus followers before the start',
  followers: 'Followers at the end of the period',
  profileClicks: 'Clicks on tracked profile links',
  newMembers: 'New members from tracked invite links',
  members: 'Members at the end of the period',
  creatorMembers: 'New members credited to partner deliverables',
  engagements: 'Sum of post engagements',
  postClicks: 'Sum of link clicks on posts',
  profileVisits: 'Sum of profile visits from posts',
  avgImpressions: 'Average impressions per published post',
  partnerViews: 'Views on delivered partner content',
  partnerCost: 'Cost of partner deliverables delivered',
  costPerMember: 'Partner cost ÷ new members they brought',
};

/** Paused KPIs keep their history but are left out of the overview, the dashboard and new reports. */
export const isTracked = (k: Kpi) => !k.paused;
/** Dashboard tiles: chosen per KPI; by default the weekly numbers. */
export const onDashboard = (k: Kpi) => isTracked(k) && (k.onDashboard ?? k.group === 'weekly');

export const FORMULA_OP: Record<KpiFormula['op'], string> = { divide: '÷', multiply: '×', add: '+', subtract: '−' };

export function formulaLabel(f: KpiFormula | null | undefined, kpis: Kpi[]): string {
  if (!f) return 'Formula not set';
  const name = (id: string) => kpis.find((k) => k.id === id)?.name ?? 'a deleted KPI';
  return `${name(f.a)} ${FORMULA_OP[f.op]} ${name(f.b)}${f.percent ? ' × 100' : ''}`;
}

/** How a KPI gets its number, in words. */
export function sourceLabel(k: Kpi, kpis: Kpi[]): string {
  if (k.source === 'calc') return k.calc ? `Calculated: ${CALC_LABEL[k.calc]}` : 'Calculation not set';
  if (k.source === 'formula') return `Formula: ${formulaLabel(k.formula, kpis)}`;
  return `Entered by hand · combined as ${k.aggregate}`;
}

export function publishedIn(d: WsData, p: Period, f: Filters, platform: Platform | null = null): Post[] {
  return d.posts.filter(
    (x) =>
      x.status === 'published' &&
      x.metrics !== null &&
      inPeriod(x.date, p) &&
      (!platform || x.platform === platform) &&
      (!f.platform || x.platform === f.platform) &&
      (!f.campaignId || x.campaignId === f.campaignId) &&
      (!f.pillarId || x.pillarId === f.pillarId) &&
      (!f.partnerId || x.partnerId === f.partnerId),
  );
}

export function rateOf(posts: Post[]): number | null {
  const imp = sum(posts.map((p) => p.metrics!.impressions));
  if (!imp) return null;
  return (sum(posts.map((p) => p.metrics!.engagements)) / imp) * 100;
}

const statsOf = (d: WsData, platform: Platform) => d.stats.filter((s) => s.platform === platform);

function lastValue(stats: DailyStat[], field: 'followers' | 'members', onOrBefore: string): number | null {
  let best: DailyStat | null = null;
  for (const s of stats) if (s.date <= onOrBefore && s[field] !== null && (!best || s.date > best.date)) best = s;
  return best ? best[field] : null;
}

/** Platform a channel KPI reads when the KPI doesn't name one. */
function channelFor(d: WsData, key: CalcKey): Platform | null {
  const withField = (field: 'followers' | 'members' | 'joins' | 'clicks') =>
    d.ws.platforms.find((pl) =>
      d.stats.some((s) => s.platform === pl && (field === 'joins' || field === 'clicks' ? Object.keys(s[field]).length > 0 : s[field] !== null)),
    ) ?? null;
  if (key === 'members' || key === 'newMembers') return withField('members');
  if (key === 'profileClicks') return withField('clicks');
  return withField('followers');
}

export function deliveredIn(d: WsData, p: Period, f: Filters): Deliverable[] {
  return d.deliverables.filter(
    (x) =>
      x.delivered !== null &&
      x.results !== null &&
      inPeriod(x.delivered, p) &&
      (!f.campaignId || x.campaignId === f.campaignId) &&
      (!f.partnerId || x.partnerId === f.partnerId),
  );
}

export function calcValue(key: CalcKey, d: WsData, p: Period, f: Filters, platform: Platform | null): number | null {
  const channel = platform ?? channelFor(d, key);
  switch (key) {
    case 'engagementRate':
      return rateOf(publishedIn(d, p, f, platform));
    case 'impressions':
      return sum(publishedIn(d, p, f, platform).map((x) => x.metrics!.impressions));
    case 'postsPublished':
      return publishedIn(d, p, f, platform).length;
    case 'creatorMembers':
      return sum(deliveredIn(d, p, f).map((x) => x.results!.newMembers));
    case 'followers':
    case 'members': {
      if (!channel) return null;
      return lastValue(statsOf(d, channel), key, p.end);
    }
    case 'netFollowers': {
      if (!channel) return null;
      const st = statsOf(d, channel);
      const end = lastValue(st, 'followers', p.end);
      if (end === null) return null;
      return end - (lastValue(st, 'followers', addDaysIso(p.start, -1)) ?? 0);
    }
    case 'profileClicks': {
      if (!channel) return null;
      const st = statsOf(d, channel).filter((s) => inPeriod(s.date, p));
      if (!st.length) return null;
      return sum(st.map((s) => sum(Object.values(s.clicks))));
    }
    case 'newMembers': {
      if (!channel) return null;
      const st = statsOf(d, channel).filter((s) => inPeriod(s.date, p));
      if (!st.length) return null;
      return sum(st.map((s) => sum(Object.values(s.joins))));
    }
    case 'engagements':
      return sum(publishedIn(d, p, f, platform).map((x) => x.metrics!.engagements));
    case 'postClicks':
      return sum(publishedIn(d, p, f, platform).map((x) => x.metrics!.clicks));
    case 'profileVisits':
      return sum(publishedIn(d, p, f, platform).map((x) => x.metrics!.profileVisits));
    case 'avgImpressions': {
      const ps = publishedIn(d, p, f, platform);
      return ps.length ? sum(ps.map((x) => x.metrics!.impressions)) / ps.length : null;
    }
    case 'partnerViews':
      return sum(deliveredIn(d, p, f).map((x) => x.results!.views));
    case 'partnerCost':
      return sum(deliveredIn(d, p, f).map((x) => x.cost));
    case 'costPerMember': {
      const ds = deliveredIn(d, p, f);
      const members = sum(ds.map((x) => x.results!.newMembers));
      return members ? sum(ds.map((x) => x.cost)) / members : null;
    }
  }
}

export function entryEnd(e: KpiEntry) {
  if (e.cadence === 'weekly') return addDaysIso(e.periodStart, 6);
  if (e.cadence === 'monthly') return monthEnd(e.periodStart);
  return e.periodStart;
}

export function entriesIn(d: WsData, kpiId: string, p: Period): KpiEntry[] {
  return d.kpiEntries
    .filter((e) => e.kpiId === kpiId && overlaps(e.periodStart, entryEnd(e), p))
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
}

export function manualValue(kpi: Kpi, d: WsData, p: Period): number | null {
  const es = entriesIn(d, kpi.id, p);
  if (!es.length) return null;
  if (kpi.aggregate === 'last') return es[es.length - 1].value;
  const total = sum(es.map((e) => e.value));
  return kpi.aggregate === 'sum' ? total : total / es.length;
}

export interface KpiResult {
  value: number | null;
  /** False when the value is account-wide and ignores campaign/pillar/partner filters. */
  scoped: boolean;
}

export function kpiValue(kpi: Kpi, d: WsData, p: Period, f: Filters = NO_FILTERS, depth = 0): KpiResult {
  if (kpi.source === 'calc') {
    if (!kpi.calc) return { value: null, scoped: false };
    return { value: calcValue(kpi.calc, d, p, f, kpi.platform), scoped: SCOPED[kpi.calc] };
  }
  if (kpi.source === 'formula') {
    const fm = kpi.formula;
    const ka = fm && d.kpis.find((k) => k.id === fm.a);
    const kb = fm && d.kpis.find((k) => k.id === fm.b);
    // depth guards against a formula that (indirectly) uses itself
    if (!fm || !ka || !kb || depth > 4) return { value: null, scoped: false };
    const a = kpiValue(ka, d, p, f, depth + 1);
    const b = kpiValue(kb, d, p, f, depth + 1);
    if (a.value === null || b.value === null) return { value: null, scoped: a.scoped && b.scoped };
    const raw = fm.op === 'divide' ? (b.value === 0 ? null : a.value / b.value) : fm.op === 'multiply' ? a.value * b.value : fm.op === 'add' ? a.value + b.value : a.value - b.value;
    return { value: raw === null ? null : fm.percent ? raw * 100 : raw, scoped: a.scoped && b.scoped };
  }
  return { value: manualValue(kpi, d, p), scoped: false };
}

/** A campaign's status: set by hand, or else from its dates. */
export const campaignAutoState = (c: Campaign, today: string): CampaignState => (c.start > today ? 'planned' : c.end < today ? 'done' : 'live');

export function targetAt(kpi: Kpi, date: string): KpiTarget | null {
  const ts = [...kpi.targets].sort((a, b) => (a.from < b.from ? -1 : 1)).filter((t) => t.from <= date);
  return ts.length ? ts[ts.length - 1] : null;
}

export function statusOf(kpi: Pick<Kpi, 'direction'>, value: number | null, prev: number | null, t: KpiTarget | null): Status {
  if (value === null || !t) return 'none';
  const up = kpi.direction === 'up';
  if (t.comparator === 'growth') {
    if (prev === null) return 'none';
    if (value === prev) return 'warning';
    return value > prev === up ? 'good' : 'critical';
  }
  if (t.value === null) return 'none';
  if (t.comparator === 'gte') {
    if (value >= t.value) return 'good';
    return value >= t.value * 0.9 ? 'warning' : 'critical';
  }
  if (value <= t.value) return 'good';
  return value <= t.value * 1.1 ? 'warning' : 'critical';
}

/** For targets with a deadline: where the current pace lands by then. */
export function pacing(kpi: Kpi, d: WsData, today: string) {
  const t = targetAt(kpi, today) ?? kpi.targets.find((x) => x.from > today) ?? null;
  if (!t || !t.by || t.value === null || t.comparator === 'growth') return null;
  const now = kpiValue(kpi, d, { type: 'custom', start: addDaysIso(today, -6), end: today }).value;
  const before = kpiValue(kpi, d, { type: 'custom', start: addDaysIso(today, -20), end: addDaysIso(today, -14) }).value;
  if (now === null || before === null || kpi.aggregate !== 'last') return null;
  const perDay = (now - before) / 14;
  const daysLeft = Math.max(0, lengthInDays({ type: 'custom', start: today, end: t.by }) - 1);
  const projected = now + perDay * daysLeft;
  return { target: t, now, projected, onTrack: kpi.direction === 'up' ? projected >= t.value : projected <= t.value };
}

export function pillarBreakdown(d: WsData, p: Period, f: Filters) {
  const posts = publishedIn(d, p, { ...f, pillarId: null });
  const total = posts.length;
  return d.ws.pillars.map((pl) => {
    const ps = posts.filter((x) => x.pillarId === pl.id);
    return {
      id: pl.id,
      name: pl.name,
      color: pl.color,
      posts: ps.length,
      share: total ? (ps.length / total) * 100 : 0,
      target: pl.targetShare,
      rate: rateOf(ps),
    };
  });
}

export interface PillarStat {
  id: string;
  name: string;
  color: number;
  description: string;
  /** Published posts with results in the period. */
  posts: number;
  /** Posts dated in the period that aren't published yet (planned or in progress). */
  planned: number;
  share: number;
  target: number;
  /** Share minus target, in percentage points. */
  gap: number;
  rate: number | null;
  prevRate: number | null;
  impressions: number;
  engagements: number;
  clicks: number;
  top: Post | null;
}

/** Everything the Pillars page shows, per pillar, for one period (and the one before it). */
export function pillarStats(d: WsData, p: Period, prev: Period | null, platform: Platform | null): { pillars: PillarStat[]; total: number; unassigned: number } {
  const f: Filters = { ...NO_FILTERS, platform };
  const posts = publishedIn(d, p, f);
  const before = prev ? publishedIn(d, prev, f) : [];
  const ids = new Set(d.ws.pillars.map((x) => x.id));
  const pillars = d.ws.pillars.map((pl) => {
    const ps = posts.filter((x) => x.pillarId === pl.id);
    const share = posts.length ? (ps.length / posts.length) * 100 : 0;
    const prevPosts = before.filter((x) => x.pillarId === pl.id);
    const top = ps.reduce<Post | null>((best, x) => {
      const r = x.metrics!.impressions ? x.metrics!.engagements / x.metrics!.impressions : 0;
      const b = best && best.metrics!.impressions ? best.metrics!.engagements / best.metrics!.impressions : -1;
      return r > b ? x : best;
    }, null);
    return {
      id: pl.id,
      name: pl.name,
      color: pl.color,
      description: pl.description ?? '',
      posts: ps.length,
      planned: d.posts.filter((x) => x.pillarId === pl.id && x.status !== 'published' && inPeriod(x.date, p) && (!platform || x.platform === platform)).length,
      share,
      target: pl.targetShare,
      gap: posts.length ? share - pl.targetShare : 0,
      rate: rateOf(ps),
      prevRate: prev && prevPosts.length ? rateOf(prevPosts) : null,
      impressions: sum(ps.map((x) => x.metrics!.impressions)),
      engagements: sum(ps.map((x) => x.metrics!.engagements)),
      clicks: sum(ps.map((x) => x.metrics!.clicks)),
      top,
    };
  });
  return { pillars, total: posts.length, unassigned: posts.filter((x) => !ids.has(x.pillarId)).length };
}

export function joinsBySource(d: WsData, p: Period) {
  const totals = new Map<string, number>();
  for (const s of d.stats) {
    if (!inPeriod(s.date, p)) continue;
    for (const [k, v] of Object.entries(s.joins)) totals.set(k, (totals.get(k) ?? 0) + v);
  }
  return [...totals.entries()].map(([source, value]) => ({ source, value }));
}

export function clicksByDestination(d: WsData, p: Period, platform: Platform) {
  const totals = new Map<string, number>();
  for (const s of d.stats) {
    if (s.platform !== platform || !inPeriod(s.date, p)) continue;
    for (const [k, v] of Object.entries(s.clicks)) totals.set(k, (totals.get(k) ?? 0) + v);
  }
  return totals;
}

/** Daily follower counts. Short periods are widened to 14 days for context. */
export function followerSeries(d: WsData, p: Period, platform: Platform | null) {
  const channel = platform ?? channelFor(d, 'followers');
  if (!channel) return [];
  const range = lengthInDays(p) < 14 ? { ...p, start: addDaysIso(p.end, -13) } : p;
  const st = statsOf(d, channel);
  const field = st.some((s) => s.followers !== null) ? 'followers' : 'members';
  return eachDay(range)
    .map((date) => ({ date, value: lastValue(st, field, date) }))
    .filter((x): x is { date: string; value: number } => x.value !== null && st.some((s) => s.date <= x.date));
}

export function totalsFor(d: WsData, p: Period, f: Filters) {
  const posts = publishedIn(d, p, f);
  const inP = d.stats.filter((s) => inPeriod(s.date, p));
  const followersCh = channelFor(d, 'followers');
  const membersCh = channelFor(d, 'members');
  return {
    posts: posts.length,
    impressions: sum(posts.map((x) => x.metrics!.impressions)),
    engagements: sum(posts.map((x) => x.metrics!.engagements)),
    rate: rateOf(posts),
    followers: followersCh ? lastValue(statsOf(d, followersCh), 'followers', p.end) : null,
    members: membersCh ? lastValue(statsOf(d, membersCh), 'members', p.end) : null,
    joins: sum(inP.map((s) => sum(Object.values(s.joins)))),
    leaves: sum(inP.map((s) => s.leaves)),
    profileClicks: sum(inP.map((s) => sum(Object.values(s.clicks)))),
    profileVisits: sum(inP.map((s) => s.profileVisits)),
    messages: sum(inP.map((s) => s.messages)),
  };
}

export function topPosts(d: WsData, p: Period, f: Filters, n = 3, minImpressions = 2000) {
  const posts = publishedIn(d, p, f);
  const rate = (x: Post) => x.metrics!.engagements / Math.max(1, x.metrics!.impressions);
  const big = posts.filter((x) => x.metrics!.impressions >= minImpressions).sort((a, b) => rate(b) - rate(a));
  const list = big.length ? big : [...posts].sort((a, b) => b.metrics!.engagements - a.metrics!.engagements);
  return list.slice(0, n);
}

export function partnerRows(d: WsData, p: Period, f: Filters): PartnerRow[] {
  const dels = deliveredIn(d, p, f);
  return d.partners
    .map((pt) => {
      const ds = dels.filter((x) => x.partnerId === pt.id);
      const views = sum(ds.map((x) => x.results!.views));
      const newMembers = sum(ds.map((x) => x.results!.newMembers));
      const measured = ds.filter((x) => x.results!.retained7d !== null);
      const retained = measured.length ? sum(measured.map((x) => x.results!.retained7d!)) : null;
      const measuredMembers = sum(measured.map((x) => x.results!.newMembers));
      const cost = sum(ds.map((x) => x.cost));
      return {
        id: pt.id,
        name: pt.name,
        handle: pt.handle,
        type: pt.type,
        deliverables: ds.length,
        views,
        clicks: sum(ds.map((x) => x.results!.clicks)),
        newMembers,
        retained,
        retention: retained !== null && measuredMembers ? (retained / measuredMembers) * 100 : null,
        cost,
        cpm: views ? (cost / views) * 1000 : null,
        costPerMember: newMembers ? cost / newMembers : null,
      };
    })
    .filter((r) => r.deliverables > 0);
}

/** All-time scorecard for one partner. */
export function partnerScore(d: WsData, partnerId: string) {
  const all: Period = { type: 'custom', start: '1900-01-01', end: '2999-12-31' };
  return partnerRows(d, all, { ...NO_FILTERS, partnerId })[0] ?? null;
}

export function campaignPeriod(c: Campaign, today: string): Period | null {
  if (c.start > today) return null;
  return { type: 'custom', start: c.start, end: c.end < today ? c.end : today };
}

export type CampaignState = 'planned' | 'live' | 'done';
export const campaignState = (c: Campaign, today: string): CampaignState => c.status ?? campaignAutoState(c, today);

export function campaignGoals(d: WsData, c: Campaign, today: string) {
  const p = campaignPeriod(c, today);
  return c.goals.map((g) => {
    const kpi = d.kpis.find((k) => k.id === g.kpiId) ?? null;
    if (!kpi || !p) return { goal: g, kpi, value: null as number | null, progress: 0, scoped: false };
    const r = kpiValue(kpi, d, p, { ...NO_FILTERS, campaignId: c.id });
    const value = r.value;
    let progress = 0;
    if (value !== null && g.target) progress = kpi.direction === 'up' ? value / g.target : g.target / Math.max(value, 1e-9);
    return { goal: g, kpi, value, progress: Math.max(0, Math.min(progress, 1.5)), scoped: r.scoped };
  });
}

export function campaignSpend(d: WsData, campaignId: string) {
  return sum(d.deliverables.filter((x) => x.campaignId === campaignId).map((x) => x.cost));
}

/** Latest date with any data: the dashboard opens on the period containing it. */
export function lastDataDate(d: WsData): string | null {
  let last: string | null = null;
  for (const s of d.stats) if (!last || s.date > last) last = s.date;
  for (const p of d.posts) if (p.status === 'published' && p.date && (!last || p.date.slice(0, 10) > last)) last = p.date.slice(0, 10);
  return last;
}
