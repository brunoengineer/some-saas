import { format } from 'date-fns';
import type { Kpi, Report, ReportKpi, ReportNarrative, ReportSnapshot, ReportType, WsData } from '@/data/types';
import { formatValue, money, num, PLATFORM_LABEL } from './format';
import {
  clicksByDestination,
  entriesIn,
  followerSeries,
  joinsBySource,
  kpiValue,
  NO_FILTERS,
  partnerRows,
  pillarBreakdown,
  statusOf,
  targetAt,
  topPosts,
  totalsFor,
  type Filters,
} from './metrics';
import { inPeriod, previousPeriod, rangeLabel, toDate, type Period } from './period';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  campaign: 'Campaign',
  custom: 'Custom',
};

export function reportTitle(type: ReportType, p: Period, campaignName?: string | null) {
  if (type === 'weekly') return `Week of ${rangeLabel(p.start, p.end)}`;
  if (type === 'monthly') return format(toDate(p.start), 'MMMM yyyy');
  if (type === 'campaign') return `${campaignName ?? 'Campaign'} · ${rangeLabel(p.start, p.end)}`;
  return rangeLabel(p.start, p.end);
}

function kpisFor(type: ReportType, kpis: Kpi[]) {
  const groups = type === 'weekly' ? ['weekly', 'daily'] : ['weekly', 'daily', 'headline', 'other'];
  return kpis.filter((k) => !k.paused && groups.includes(k.group)).sort((a, b) => a.order - b.order);
}

function detailFor(kpi: Kpi, d: WsData, p: Period): string {
  if (kpi.source === 'manual') {
    const es = entriesIn(d, kpi.id, p);
    return es.length ? es[es.length - 1].note : '';
  }
  if (kpi.calc === 'netFollowers') {
    const total = kpiValue({ ...kpi, calc: 'followers' }, d, p).value;
    return total !== null ? `${num(total)} total` : '';
  }
  if (kpi.calc === 'newMembers') {
    const total = kpiValue({ ...kpi, calc: 'members' }, d, p).value;
    return total !== null ? `${num(total)} total` : '';
  }
  if (kpi.calc === 'profileClicks' && kpi.platform) {
    const parts = [...clicksByDestination(d, p, kpi.platform).entries()].filter(([, v]) => v > 0);
    return parts.map(([k, v]) => `${num(v)} ${k}`).join(' · ');
  }
  return '';
}

function previousFor(d: WsData, type: ReportType, p: Period) {
  const prevType = type === 'monthly' ? 'month' : type === 'weekly' ? 'week' : 'custom';
  return previousPeriod({ ...p, type: prevType }, d.ws.weekStartsOn);
}

/** One KPI's frozen numbers for a report period. */
export function reportKpi(k: Kpi, d: WsData, type: ReportType, p: Period, campaignId: string | null): ReportKpi {
  const f: Filters = { ...NO_FILTERS, campaignId };
  const value = kpiValue(k, d, p, f).value;
  const before = kpiValue(k, d, previousFor(d, type, p), f).value;
  const target = targetAt(k, p.end);
  return {
    id: k.id,
    name: k.name,
    question: k.question,
    unit: k.unit,
    direction: k.direction,
    platform: k.platform,
    group: k.group,
    value,
    prev: before,
    target,
    status: statusOf(k, value, before, target),
    detail: detailFor(k, d, p),
  };
}

/** The parts of a report that can be removed while editing (and put back). */
export const REPORT_SECTIONS = {
  numbers: 'Main numbers',
  totals: 'Totals',
  followers: 'Followers chart',
  pillars: 'Engagement by pillar',
  joins: 'Where members came from',
  topPosts: 'Top posts',
  partners: 'Creators and partners',
  more: 'Goals and other KPIs',
  actions: 'What changes next',
} as const;
export type ReportSection = keyof typeof REPORT_SECTIONS;

export const isShown = (n: ReportNarrative, key: string) => !(n.hidden ?? []).includes(key);

/** The KPI tiles a report shows: the frozen ones plus any added while editing, minus removed ones. */
export function reportKpis(r: Report, n: ReportNarrative = r.narrative): ReportKpi[] {
  const hidden = new Set(n.hiddenKpis ?? []);
  return [...r.snapshot.kpis, ...(n.addedKpis ?? [])].filter((k) => !hidden.has(k.id));
}

export function buildSnapshot(d: WsData, type: ReportType, p: Period, campaignId: string | null): ReportSnapshot {
  const f: Filters = { ...NO_FILTERS, campaignId };
  const kpis: ReportKpi[] = kpisFor(type, d.kpis)
    .map((k) => reportKpi(k, d, type, p, campaignId))
    .filter((k) => k.value !== null || k.group === 'weekly');

  const primary = d.ws.platforms.find((pl) => d.stats.some((s) => s.platform === pl && s.followers !== null)) ?? null;
  return {
    primaryPlatform: primary,
    totals: totalsFor(d, p, f),
    kpis,
    followers: followerSeries(d, p, primary),
    pillars: pillarBreakdown(d, p, f),
    joinsBySource: joinsBySource(d, p),
    topPosts: topPosts(d, p, f, type === 'weekly' ? 1 : 3).map((x) => ({
      id: x.id,
      title: x.title,
      caption: x.caption,
      date: x.date!,
      platform: x.platform,
      pillar: d.ws.pillars.find((pl) => pl.id === x.pillarId)?.name ?? '',
      impressions: x.metrics!.impressions,
      engagements: x.metrics!.engagements,
      rate: (x.metrics!.engagements / Math.max(1, x.metrics!.impressions)) * 100,
      profileVisits: x.metrics!.profileVisits,
    })),
    partners: partnerRows(d, p, f),
    annotations: d.ws.annotations.filter((a) => inPeriod(a.date, p)),
  };
}

/**
 * A first draft of the words, from simple rules. Admins edit it before sending.
 * (Phase 3 swaps this for a Claude-written draft built from the same snapshot.)
 */
export function draftNarrative(s: ReportSnapshot, type: ReportType, p: Period): ReportNarrative {
  const withValue = s.kpis.filter((k) => k.value !== null && k.group === 'weekly');
  const lead = withValue.slice(0, 2).map((k) => {
    const v = formatValue(k.unit, k.value, { signed: k.unit === 'number' && k.name.toLowerCase().includes('net') });
    return `${k.name.toLowerCase()} ${v}`;
  });
  const when = type === 'weekly' ? `Week of ${rangeLabel(p.start, p.end)}` : type === 'monthly' ? format(toDate(p.start), 'MMMM') : rangeLabel(p.start, p.end);
  const headline = lead.length ? `${when}: ${lead.join(', ')}` : `${when}: no data yet`;

  const judged = withValue.filter((k) => k.status !== 'none');
  const good = judged.filter((k) => k.status === 'good');
  const behind = judged.filter((k) => k.status !== 'good');
  const summaryParts = [
    judged.length ? `${good.length} of ${judged.length} tracked numbers are on target.` : '',
    behind.length ? `Behind: ${behind.map((k) => `${k.name.toLowerCase()} (${formatValue(k.unit, k.value)})`).join(', ')}.` : '',
    s.totals.posts ? `${num(s.totals.posts)} posts, ${num(s.totals.impressions)} impressions.` : '',
  ];

  const actions: ReportNarrative['actions'] = [];
  const pillars = s.pillars.filter((x) => x.posts >= 3 && x.rate !== null).sort((a, b) => b.rate! - a.rate!);
  if (pillars.length >= 2 && pillars[0].rate! - pillars[pillars.length - 1].rate! > 1) {
    const best = pillars[0];
    const worst = pillars[pillars.length - 1];
    actions.push({
      title: `More ${best.name}`,
      body: `${best.name} averaged ${best.rate!.toFixed(1)}%, ${worst.name} ${worst.rate!.toFixed(1)}%. Swap two ${worst.name} posts for ${best.name} formats.`,
    });
  }
  const partners = s.partners.filter((x) => x.costPerMember !== null && x.newMembers > 0).sort((a, b) => a.costPerMember! - b.costPerMember!);
  if (partners.length) {
    const b = partners[0];
    actions.push({
      title: `Book more with ${b.name}`,
      body: `${b.name} brought ${num(b.newMembers)} members at ${money(b.costPerMember!, 2)} each${b.retention !== null ? `, ${Math.round(b.retention)}% still active after 7 days` : ''}.`,
    });
  }
  for (const k of behind.slice(0, 3 - actions.length)) {
    actions.push({
      title: `Lift ${k.name.toLowerCase()}`,
      body: `${formatValue(k.unit, k.value)} against a target of ${k.target?.comparator === 'growth' ? 'growth' : formatValue(k.unit, k.target?.value)}. Agree one change for next ${type === 'monthly' ? 'month' : 'week'}.`,
    });
  }
  if (!actions.length) actions.push({ title: 'Keep the rhythm', body: 'Everything tracked is on target. Keep the formats that work.' });

  const daily = s.kpis.filter((k) => k.group === 'daily' && k.value !== null);
  const footnote = daily.length
    ? `Daily check, not in the main numbers: ${daily.map((k) => `${k.name.toLowerCase()} ${formatValue(k.unit, k.value)}`).join(' · ')}.`
    : '';

  return { headline, summary: summaryParts.filter(Boolean).join(' '), actions, footnote };
}

export function createReport(
  d: WsData,
  args: { type: ReportType; period: Period; campaignId: string | null; trigger: 'auto' | 'manual'; createdBy: string; now: string },
): Report {
  const campaign = d.campaigns.find((c) => c.id === args.campaignId) ?? null;
  const snapshot = buildSnapshot(d, args.type, args.period, args.campaignId);
  return {
    id: `r-${args.type}-${args.period.start}-${Math.random().toString(36).slice(2, 7)}`,
    wsId: d.ws.id,
    type: args.type,
    title: reportTitle(args.type, args.period, campaign?.name),
    start: args.period.start,
    end: args.period.end,
    campaignId: args.campaignId,
    trigger: args.trigger,
    status: 'draft',
    createdAt: args.now,
    createdBy: args.createdBy,
    snapshot,
    narrative: draftNarrative(snapshot, args.type, args.period),
  };
}

export const platformName = (p: string | null) => (p ? PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL] ?? p : '');
