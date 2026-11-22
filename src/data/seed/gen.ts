// Small deterministic helpers for building sample data.
import { addDays, format, parseISO } from 'date-fns';
import type { DailyStat, Platform, Post, PostFormat, PostMetrics } from '../types';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof rng>;

export const day = (iso: string, n: number) => format(addDays(parseISO(iso), n), 'yyyy-MM-dd');

export function pick<T>(r: Rand, list: T[]): T {
  return list[Math.floor(r() * list.length)];
}

export function weighted<T>(r: Rand, items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r() * total;
  for (const i of items) {
    x -= i.weight;
    if (x <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

/** Split an integer total into parts proportional to weights, summing exactly. */
export function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}

export interface Template {
  title: string;
  caption: string;
  format: PostFormat;
  thread?: string;
}

export interface WeekSpec {
  /** Monday of the week. */
  start: string;
  posts: number;
  impressions: number;
  engagements: number;
  /** Days of the week (0-6 from start) that get posts. */
  days?: number[];
}

export interface FixedPost {
  date: string;
  title: string;
  caption: string;
  thread?: string;
  pillarId: string;
  format: PostFormat;
  metrics: PostMetrics;
  campaignId?: string | null;
  partnerId?: string | null;
}

export interface WeekGenOptions {
  r: Rand;
  wsId: string;
  platform: Platform;
  week: WeekSpec;
  fixed: FixedPost[];
  pillars: { id: string; share: number; rate: number; templates: Template[] }[];
  times: string[];
  idPrefix: string;
  assignee: string;
  checklist: string[];
  campaignFor?: (date: string, pillarId: string) => string | null;
}

/**
 * Build one week of published posts whose impressions and engagements add up
 * exactly to the week's totals. Fixed posts keep their numbers; the rest share
 * what is left, weighted by random reach and each pillar's typical rate.
 */
export function genWeek(o: WeekGenOptions): Post[] {
  const { r, week } = o;
  const days = week.days ?? [0, 1, 2, 3, 4, 5, 6];
  const n = week.posts - o.fixed.length;
  const slots: string[] = [];
  const perDay = split(n, days.map(() => 1));
  days.forEach((d, i) => {
    const times = [...o.times].sort(() => r() - 0.5).slice(0, perDay[i]).sort();
    for (const t of times) slots.push(`${day(week.start, d)}T${t}`);
  });

  const fixedImp = o.fixed.reduce((s, f) => s + f.metrics.impressions, 0);
  const fixedEng = o.fixed.reduce((s, f) => s + f.metrics.engagements, 0);
  const reach = slots.map(() => 0.55 + r() * 0.9);
  const imps = split(week.impressions - fixedImp, reach);
  const pillars = slots.map(() => weighted(r, o.pillars.map((p) => ({ item: p, weight: p.share }))));
  const rawEng = imps.map((imp, i) => imp * pillars[i].rate * (0.85 + r() * 0.3));
  const engs = split(week.engagements - fixedEng, rawEng);

  const used = new Map<string, number>();
  const posts: Post[] = slots.map((date, i) => {
    const p = pillars[i];
    const k = used.get(p.id) ?? 0;
    used.set(p.id, k + 1);
    const t = p.templates[(k + Math.floor(r() * 3)) % p.templates.length];
    return {
      id: `${o.idPrefix}-${date.replace(/\D/g, '')}-${i}`,
      wsId: o.wsId,
      title: t.title,
      caption: t.caption,
      thread: t.thread ?? '',
      platform: o.platform,
      pillarId: p.id,
      format: t.format,
      status: 'published',
      date,
      campaignId: o.campaignFor?.(date, p.id) ?? null,
      partnerId: null,
      assigneeId: o.assignee,
      link: '',
      checklist: Object.fromEntries(o.checklist.map((c) => [c, true])),
      metrics: {
        impressions: imps[i],
        engagements: engs[i],
        clicks: Math.round(imps[i] * 0.004),
        profileVisits: Math.round(imps[i] * 0.005),
      },
    };
  });

  const fixed: Post[] = o.fixed.map((f, i) => ({
    id: `${o.idPrefix}-fx-${f.date.replace(/\D/g, '')}-${i}`,
    wsId: o.wsId,
    title: f.title,
    caption: f.caption,
    thread: f.thread ?? '',
    platform: o.platform,
    pillarId: f.pillarId,
    format: f.format,
    status: 'published',
    date: f.date,
    campaignId: f.campaignId ?? null,
    partnerId: f.partnerId ?? null,
    assigneeId: o.assignee,
    link: '',
    checklist: Object.fromEntries(o.checklist.map((c) => [c, true])),
    metrics: f.metrics,
  }));

  return [...posts, ...fixed].sort((a, b) => (a.date! < b.date! ? -1 : 1));
}

export interface StatWeek {
  start: string;
  followersGained?: number;
  clicks?: Record<string, number>;
  profileVisits?: number;
  joins?: Record<string, number>;
  leaves?: number;
  messages?: number;
  /** Days of the week (0-6) with activity; others get zero. */
  days?: number[];
}

/** Daily channel stats from weekly totals. Followers/members are cumulative. */
export function genStats(
  r: Rand,
  wsId: string,
  platform: Platform,
  weeks: StatWeek[],
  opts: { startFollowers?: number; members?: boolean } = {},
): DailyStat[] {
  const out: DailyStat[] = [];
  let followers = opts.startFollowers ?? 0;
  let members = 0;
  for (const w of weeks) {
    const days = w.days ?? [0, 1, 2, 3, 4, 5, 6];
    const weights = [0, 1, 2, 3, 4, 5, 6].map((d) => (days.includes(d) ? 0.7 + r() * 0.6 : 0));
    const gained = split(w.followersGained ?? 0, weights);
    const visits = split(w.profileVisits ?? 0, weights);
    const leaves = split(w.leaves ?? 0, weights);
    const messages = split(w.messages ?? 0, weights);
    const clicks = Object.fromEntries(Object.entries(w.clicks ?? {}).map(([k, v]) => [k, split(v, weights)]));
    const joins = Object.fromEntries(Object.entries(w.joins ?? {}).map(([k, v]) => [k, split(v, weights)]));
    for (let d = 0; d < 7; d++) {
      const date = day(w.start, d);
      const dayJoins = Object.fromEntries(Object.entries(joins).map(([k, v]) => [k, v[d]]));
      const joined = Object.values(dayJoins).reduce((s, v) => s + v, 0);
      followers += gained[d];
      members += joined - leaves[d];
      out.push({
        id: `${wsId}_${platform}_${date}`,
        wsId,
        platform,
        date,
        followers: opts.members ? null : followers,
        members: opts.members ? members : null,
        clicks: Object.fromEntries(Object.entries(clicks).map(([k, v]) => [k, v[d]])),
        joins: dayJoins,
        leaves: leaves[d],
        profileVisits: visits[d],
        messages: messages[d],
      });
    }
  }
  return out;
}
