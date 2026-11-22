import type { Activity, DB, Report } from '../types';
import { wsData } from '../wsData';
import { createReport } from '@/lib/report';
import { bloomSeed } from './bloom';
import { flushSeed, FLUSH } from './flush';
import { withSampleImages } from './images';

/** Bump when the sample data changes so browsers reload it. */
export const SEED_VERSION = 5;

function flushReports(db: DB): Report[] {
  const d = wsData(db, FLUSH);
  const w3 = createReport(d, { type: 'weekly', period: { type: 'week', start: '2026-11-02', end: '2026-11-08' }, campaignId: null, trigger: 'manual', createdBy: 'm-brunna', now: '2026-11-09T08:00' });
  w3.id = 'r-w3';
  w3.status = 'final';
  w3.narrative = {
    headline: 'Week 3: the Discord is open and people are talking',
    summary: 'Discord opened on Wednesday with the Founding Draw: 184 people joined in five days and half of them posted or joined voice. X kept growing and started sending people to the server.',
    actions: [
      { title: 'Repeat the poll format', body: 'The trust poll hit 6.1%, our best rate so far. One poll every two days.' },
      { title: 'Second creator stream', body: 'Sam’s stream brought 18 members for $400. Book stream #2 for Thursday.' },
      { title: 'Start the alpha waves', body: 'Wave 1 invites go out Monday with the “Not everyone gets a seat” post.' },
    ],
    footnote: w3.narrative.footnote,
  };

  const w4 = createReport(d, { type: 'weekly', period: { type: 'week', start: '2026-11-09', end: '2026-11-15' }, campaignId: null, trigger: 'manual', createdBy: 'm-brunna', now: '2026-11-16T08:00' });
  w4.id = 'r-w4';
  w4.status = 'final';
  w4.narrative = {
    headline: 'Week 4: the door is open, now we keep people inside',
    summary: 'X keeps growing and sending people over. Discord gained 128 members, but a smaller share were active, so next week is about giving newcomers a reason to talk.',
    actions: [
      { title: 'More Fun & Culture', body: 'Memes and polls averaged 5.9%, announcements 2.8%. Swap two announcements for polls.' },
      { title: 'Book two more creators', body: 'Creators brought 41 members with the best retention. Lowest cost per active member.' },
      { title: 'Give newcomers a first step', body: 'A daily prompt in #general and a welcome-wall nudge on day 2, to lift active %.' },
    ],
    footnote: w4.narrative.footnote,
  };

  const m1 = createReport(d, { type: 'custom', period: { type: 'custom', start: '2026-10-19', end: '2026-11-15' }, campaignId: null, trigger: 'manual', createdBy: 'm-brunna', now: '2026-11-16T11:30' });
  m1.id = 'r-m1';
  m1.status = 'final';
  m1.title = 'Month 1 · 19 Oct – 15 Nov 2026';
  m1.narrative = {
    headline: 'Month 1: from zero to 522 followers and 291 members',
    summary: 'X found its voice in week 2 and opened the Discord in week 3. Memes and polls work best; safer-play posts need a new format. The alpha is filling: 186 of 500 founding seats are taken.',
    actions: [
      { title: 'X: 1,200 followers at 4.5%+ engagement', body: 'More Fun & Culture, a new format for safer-play posts, two creator collabs a week.' },
      { title: 'Discord: weekly active back above 50%', body: 'Daily prompts, a second weekly event, the first Flush Challenge.' },
      { title: 'Alpha: 350 founding seats and 60 bug reports', body: 'Wave 2 invites, Bug Hunter leaderboard, weekly “You said, we did” post.' },
    ],
    footnote: m1.narrative.footnote,
  };

  const draw = createReport(d, { type: 'campaign', period: { type: 'custom', start: '2026-11-02', end: '2026-11-22' }, campaignId: 'c-draw', trigger: 'manual', createdBy: 'm-brunna', now: '2026-11-22T09:15' });
  draw.id = 'r-draw';
  draw.title = 'Founding Draw · progress so far';
  return [w4, m1, w3, draw];
}

export function buildSeed(): DB {
  const f = flushSeed();
  const b = bloomSeed();
  const activity: Activity[] = [
    { id: 'a1', wsId: FLUSH, at: '2026-11-21T10:12', actorId: 'm-alex', text: 'requested changes on “Founding Tournament: entries open”', link: '/calendar?post=fp-tourney-launch' },
    { id: 'a2', wsId: FLUSH, at: '2026-11-20T16:05', actorId: 'm-jordan', text: 'commented on Founding Tournament', link: '/campaigns/c-tourney' },
    { id: 'a3', wsId: FLUSH, at: '2026-11-16T08:00', actorId: 'm-brunna', text: 'generated the weekly report for 9–15 Nov', link: '/reports/r-w4' },
  ];
  const db: DB = {
    version: SEED_VERSION,
    workspaces: [f.workspace, b.workspace],
    posts: withSampleImages([...f.posts, ...b.posts], [f.workspace, b.workspace]).map((p) => (p.platform === 'discord' ? { ...p, channel: 'announcements' } : p)),
    campaigns: [...f.campaigns, ...b.campaigns],
    partners: [...f.partners, ...b.partners],
    deliverables: [...f.deliverables, ...b.deliverables],
    kpis: [...f.kpis, ...b.kpis],
    kpiEntries: [...f.kpiEntries, ...b.kpiEntries],
    stats: [...f.stats, ...b.stats],
    comments: [...f.comments, ...b.comments],
    reports: [],
    activity,
  };
  db.reports = flushReports(db);
  return db;
}

