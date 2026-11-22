// A second, smaller sample client to show the freelancer / multi-workspace side.
import type { Campaign, Deliverable, Kpi, KpiEntry, Partner, Post, Workspace } from '../types';
import { day, genStats, genWeek, pick, rng, type Template } from './gen';

export const BLOOM = 'ws-bloom';

const CHECKLIST = ['Brand colors and logo', 'Alt text added', 'Partner tagged (#ad)'];

export const bloomWorkspace: Workspace = {
  id: BLOOM,
  name: 'Bloom Coffee Co.',
  tagline: 'Freelance client · Instagram & TikTok',
  initials: 'B',
  accent: '#0F766E',
  timezone: 'America/Toronto',
  weekStartsOn: 1,
  platforms: ['instagram', 'tiktok'],
  pillars: [
    { id: 'craft', name: 'Coffee craft', color: 1, targetShare: 40, description: 'Beans, brewing and latte art. Teach something in every post.' },
    { id: 'bar', name: 'Behind the bar', color: 2, targetShare: 25, description: 'The people and the morning routine behind each cup.' },
    { id: 'community', name: 'Community', color: 3, targetShare: 20, description: 'Regulars, neighbours and local events.' },
    { id: 'offers', name: 'Offers', color: 4, targetShare: 15, description: 'Seasonal drinks and deals. Keep it light, at most one a week.' },
  ],
  checklist: CHECKLIST,
  members: [
    { id: 'm-brunna', name: 'Brunna Shinomya', email: 'brunna@flush.example', role: 'admin', title: 'Freelance social manager' },
    { id: 'm-leo', name: 'Leo Martins', email: 'leo@bloom.example', role: 'manager', title: 'Head barista (approves posts)' },
    { id: 'm-dana', name: 'Dana Park', email: 'dana@bloom.example', role: 'viewer', title: 'Owner' },
  ],
  annotations: [{ date: '2026-10-05', label: 'Pumpkin season starts' }],
  settings: { managersCanDraft: true, managersCanApprove: true },
  createdAt: '2026-09-28T09:00',
};

const T: Record<string, Template[]> = {
  craft: [
    { title: 'Latte art in slow motion', caption: 'Oat flat white, poured slow. Sound on.', format: 'video' },
    { title: 'Bean of the month', caption: 'Ethiopia Guji: blueberry, jasmine, a little cocoa.', format: 'image' },
    { title: 'Pour-over 101', caption: '4 steps to a better pour-over at home. Save this.', format: 'video' },
  ],
  bar: [
    { title: 'Opening shift, 6am', caption: 'What 6am looks like behind the bar.', format: 'video' },
    { title: 'Meet the team', caption: 'Say hi to Leo, our head barista and latte-art champion.', format: 'image' },
  ],
  community: [
    { title: 'Regular of the week', caption: 'Meet Mrs. Chen: 312 cortados and counting.', format: 'image' },
    { title: 'Local art on our walls', caption: 'This month’s wall: prints by a neighbour two streets over.', format: 'image' },
  ],
  offers: [
    { title: 'Pumpkin spice is back', caption: 'It’s back. House-made syrup, real pumpkin.', format: 'image' },
    { title: 'Loyalty card double stamps', caption: 'Double stamps all week. Bring a friend.', format: 'image' },
  ],
};

const RATES: Record<string, number> = { craft: 0.06, bar: 0.055, community: 0.05, offers: 0.035 };

function posts(): Post[] {
  const r = rng(21);
  const pillars = Object.keys(T).map((id) => ({
    id,
    share: bloomWorkspace.pillars.find((p) => p.id === id)!.targetShare,
    rate: RATES[id],
    templates: T[id],
  }));
  const out: Post[] = [];
  const weeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'];
  weeks.forEach((start, i) => {
    const campaignFor = (date: string, pillarId: string) =>
      date.slice(0, 10) <= '2026-11-01' && pillarId === 'offers' ? 'c-pumpkin' : null;
    out.push(
      ...genWeek({ r, wsId: BLOOM, platform: 'instagram', week: { start, posts: 5, impressions: 9000 + i * 900, engagements: Math.round((9000 + i * 900) * (0.047 + i * 0.002)), days: [0, 1, 3, 4, 5] }, fixed: [], pillars, times: ['08:00', '12:00', '17:30'], idPrefix: `bi${i}`, assignee: 'm-brunna', checklist: CHECKLIST, campaignFor }),
      ...genWeek({ r, wsId: BLOOM, platform: 'tiktok', week: { start, posts: 3, impressions: 15000 + i * 2500, engagements: Math.round((15000 + i * 2500) * 0.061), days: [1, 3, 5] }, fixed: [], pillars, times: ['18:00'], idPrefix: `bt${i}`, assignee: 'm-brunna', checklist: CHECKLIST, campaignFor }),
    );
  });
  for (let d = 0; d < 21; d++) {
    if (d % 2) continue;
    const date = day('2026-11-23', d);
    const pillarId = pick(r, Object.keys(T));
    const t = pick(r, T[pillarId]);
    out.push({
      id: `bp-${d}`,
      wsId: BLOOM,
      title: d < 6 ? t.title : `Holiday: ${t.title.toLowerCase()}`,
      caption: t.caption,
      thread: '',
      platform: d % 4 ? 'instagram' : 'tiktok',
      pillarId,
      format: t.format,
      status: d < 7 ? 'scheduled' : d < 14 ? 'review' : 'draft',
      date: `${date}T12:00`,
      campaignId: d >= 0 ? 'c-holiday' : null,
      partnerId: null,
      assigneeId: 'm-brunna',
      link: '',
      checklist: Object.fromEntries(CHECKLIST.map((c) => [c, d < 7])),
      metrics: null,
    });
  }
  return out;
}

function stats() {
  const r = rng(22);
  const ig = genStats(
    r,
    BLOOM,
    'instagram',
    [62, 80, 95, 88, 110, 120, 134].map((g, i) => ({
      start: day('2026-10-05', i * 7),
      followersGained: g,
      clicks: { 'Link in bio': 60 + i * 9 },
      profileVisits: 700 + i * 60,
    })),
    { startFollowers: 4210 },
  );
  const tt = genStats(
    r,
    BLOOM,
    'tiktok',
    [140, 210, 180, 260, 240, 310, 290].map((g, i) => ({
      start: day('2026-10-05', i * 7),
      followersGained: g,
      clicks: { 'Link in bio': 20 + i * 4 },
      profileVisits: 400 + i * 50,
    })),
    { startFollowers: 1530 },
  );
  return [...ig, ...tt];
}

const base = { wsId: BLOOM, direction: 'up' as const, cadence: 'weekly' as const, phase: 'Ongoing', aggregate: 'sum' as const };

export const bloomKpis: Kpi[] = [
  { ...base, id: 'b-er', name: 'Instagram engagement rate', question: 'Is our content working?', unit: 'percent', platform: 'instagram', group: 'weekly', source: 'calc', calc: 'engagementRate', aggregate: 'avg', order: 1, targets: [{ from: '2026-10-01', value: 5, comparator: 'gte', by: null, note: '' }] },
  { ...base, id: 'b-netf', name: 'Instagram net followers', question: 'Is our reach growing?', unit: 'number', platform: 'instagram', group: 'weekly', source: 'calc', calc: 'netFollowers', order: 2, targets: [{ from: '2026-10-01', value: 100, comparator: 'gte', by: null, note: '100 a week' }] },
  { ...base, id: 'b-tt', name: 'TikTok net followers', question: 'Is TikTok growing?', unit: 'number', platform: 'tiktok', group: 'weekly', source: 'calc', calc: 'netFollowers', order: 3, targets: [{ from: '2026-10-01', value: null, comparator: 'growth', by: null, note: '' }] },
  { ...base, id: 'b-clicks', name: 'Link-in-bio clicks', question: 'Do people go to the shop?', unit: 'number', platform: 'instagram', group: 'weekly', source: 'calc', calc: 'profileClicks', order: 4, targets: [{ from: '2026-10-01', value: null, comparator: 'growth', by: null, note: '' }] },
  { ...base, id: 'b-coupons', name: 'Social coupon redemptions', question: 'Does social bring people in store?', unit: 'number', platform: null, group: 'weekly', source: 'manual', calc: null, order: 5, targets: [{ from: '2026-10-01', value: 40, comparator: 'gte', by: null, note: 'Counted at the till' }] },
  { ...base, id: 'b-posts', name: 'Posts published', question: 'Are we keeping the rhythm?', unit: 'number', platform: null, group: 'other', source: 'calc', calc: 'postsPublished', order: 6, targets: [] },
  { ...base, id: 'b-followers', name: 'Instagram followers', question: 'How big is the audience?', unit: 'number', platform: 'instagram', group: 'other', source: 'calc', calc: 'followers', aggregate: 'last', cadence: 'monthly', order: 7, targets: [{ from: '2026-10-01', value: 5000, comparator: 'gte', by: '2026-12-31', note: '5K by year end' }] },
];

const coupons: KpiEntry[] = [31, 38, 42, 36, 45, 51, 48].map((v, i) => ({
  id: `b-coupons_${day('2026-10-05', i * 7)}`,
  wsId: BLOOM,
  kpiId: 'b-coupons',
  periodStart: day('2026-10-05', i * 7),
  cadence: 'weekly',
  value: v,
  note: '',
  source: 'manual',
}));

export const bloomCampaigns: Campaign[] = [
  { id: 'c-pumpkin', wsId: BLOOM, name: 'Pumpkin season', theme: 'Make the autumn menu the reason to visit', strategy: 'Slow-motion pours, the syrup being made in-house, and a regulars series. Offers only once a week.', start: '2026-10-05', end: '2026-11-01', color: 2, channels: ['instagram', 'tiktok'], budget: 600, ownerId: 'm-brunna', goals: [{ kpiId: 'b-er', target: 5 }, { kpiId: 'b-netf', target: 350 }, { kpiId: 'b-coupons', target: 150 }] },
  { id: 'c-holiday', wsId: BLOOM, name: 'Holiday gift cards', theme: 'Bloom as the easy, local gift', strategy: 'Gift-card reels, a local creator collab and a 12 days of coffee countdown.', start: '2026-11-23', end: '2026-12-24', color: 7, channels: ['instagram', 'tiktok'], budget: 900, ownerId: 'm-brunna', goals: [{ kpiId: 'b-coupons', target: 200 }, { kpiId: 'b-netf', target: 500 }] },
];

export const bloomPartners: Partner[] = [
  { id: 'bp-mia', wsId: BLOOM, name: 'Mia Eats', handle: '@miaeats', type: 'creator', platform: 'instagram', audience: 28000, niche: 'Local food', contact: 'mia@creator.example', trackingCode: 'MIA10', deal: { model: 'flat', rate: 250, notes: 'Reel + 3 stories' }, stage: 'active', rating: 5, notes: '' },
  { id: 'bp-grind', wsId: BLOOM, name: 'The Grind Club', handle: 'Run club', type: 'community', platform: 'instagram', audience: 1200, niche: 'Saturday run club', contact: 'hello@grind.example', trackingCode: 'GRIND', deal: { model: 'gifted', rate: 0, notes: 'Free coffee after Saturday runs' }, stage: 'active', rating: 4, notes: '' },
  { id: 'bp-tom', wsId: BLOOM, name: 'Tom Bakes', handle: '@tombakes', type: 'creator', platform: 'tiktok', audience: 54000, niche: 'Baking', contact: 'dm', trackingCode: '', deal: { model: 'flat', rate: 400, notes: '' }, stage: 'contacted', rating: 0, notes: 'Holiday collab idea.' },
];

export const bloomDeliverables: Deliverable[] = [
  { id: 'bd1', wsId: BLOOM, partnerId: 'bp-mia', campaignId: 'c-pumpkin', kind: 'video', title: 'Pumpkin latte reel', due: '2026-10-14', delivered: '2026-10-14', results: { views: 41000, clicks: 320, signups: 0, newMembers: 38, retained7d: null }, cost: 250, paid: true },
  { id: 'bd2', wsId: BLOOM, partnerId: 'bp-grind', campaignId: null, kind: 'event', title: 'Run club coffee stop', due: '2026-10-24', delivered: '2026-10-24', results: { views: 900, clicks: 15, signups: 0, newMembers: 22, retained7d: null }, cost: 60, paid: true },
  { id: 'bd3', wsId: BLOOM, partnerId: 'bp-mia', campaignId: 'c-holiday', kind: 'video', title: 'Gift card reel', due: '2026-12-02', delivered: null, results: null, cost: 250, paid: false },
];

export function bloomSeed() {
  return {
    workspace: bloomWorkspace,
    posts: posts(),
    stats: stats(),
    kpis: bloomKpis,
    kpiEntries: coupons,
    campaigns: bloomCampaigns,
    partners: bloomPartners,
    deliverables: bloomDeliverables,
    comments: [],
  };
}
