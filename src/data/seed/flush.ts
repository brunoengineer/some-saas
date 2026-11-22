// Sample workspace rebuilt from the Flush.io community proposal. Weeks run
// Monday-Sunday. Week 1 (19-25 Oct) is set-up with no posting, X goes live in
// week 2, Discord opens on Wed 4 Nov (week 3), the alpha starts in week 4.
// Weekly totals are chosen so the reports reproduce the proposal's example:
// week 4 = 4.8% engagement, +186 followers, 142 clicks, 128 new members,
// 46% weekly active, 61% retention; month 1 (19 Oct-15 Nov) = 522 followers,
// 64.3K impressions, 4.4% engagement, 92 posts, 291 Discord members.
import type {
  Campaign,
  Comment,
  DailyStat,
  Deliverable,
  Kpi,
  KpiEntry,
  Partner,
  Post,
  PostStatus,
  Workspace,
} from '../types';
import { day, genStats, genWeek, pick, rng, weighted, type FixedPost, type Template } from './gen';

export const FLUSH = 'ws-flush';

const CHECKLIST = [
  '19+ (18+ in AB, MB, QC) shown',
  'Paid partnership labelled (#ad)',
  'T&Cs link in first reply',
  'Safer-play line where relevant',
  'No promise of wins',
];

export const flushWorkspace: Workspace = {
  id: FLUSH,
  name: 'Flush.io',
  tagline: 'Crypto casino · Social & community',
  initials: 'F',
  accent: '#EC001F',
  timezone: 'America/Toronto',
  weekStartsOn: 1,
  platforms: ['x', 'discord', 'telegram', 'kick'],
  pillars: [
    { id: 'fun', name: 'Fun & Culture', color: 1, targetShare: 35, description: 'Memes, polls and casino-culture jokes. The everyday reason to follow.' },
    { id: 'bip', name: 'Building in Public', color: 2, targetShare: 20, description: 'What the team is building, why, and what changed because of feedback.' },
    { id: 'players', name: 'Our Players', color: 3, targetShare: 20, description: 'Community wins, member spotlights, clips and posts we reshare.' },
    { id: 'trust', name: 'Trust & Safer Play', color: 4, targetShare: 15, description: 'Fairness, payouts, limits and safer-play tools, explained plainly.' },
    { id: 'promos', name: 'Launches & Promos', color: 5, targetShare: 10, description: 'Launches, draws and offers. Always with the age line and T&Cs.' },
  ],
  checklist: CHECKLIST,
  members: [
    { id: 'm-brunna', name: 'Brunna Shinomya', email: 'brunna@flush.example', role: 'admin', title: 'Social & community' },
    { id: 'm-alex', name: 'Alex Moreau', email: 'alex@flush.example', role: 'manager', title: 'CEO' },
    { id: 'm-jordan', name: 'Jordan Lee', email: 'jordan@flush.example', role: 'manager', title: 'Affiliates manager' },
    { id: 'm-priya', name: 'Priya Nair', email: 'priya@flush.example', role: 'viewer', title: 'CRM manager' },
    { id: 'm-tom', name: 'Tom Becker', email: 'tom@flush.example', role: 'viewer', title: 'CTO' },
  ],
  annotations: [
    { date: '2026-10-26', label: 'X goes live' },
    { date: '2026-11-04', label: 'Discord opens' },
    { date: '2026-11-09', label: 'Alpha starts' },
  ],
  settings: { managersCanDraft: false, managersCanApprove: true },
  createdAt: '2026-10-19T09:00',
};

const T: Record<string, Template[]> = {
  fun: [
    { title: 'Meme: withdrawal speedrun', caption: 'Other casinos: "withdrawal pending (day 6)". Us: we’re working on it so you never see that screen.', format: 'meme' },
    { title: 'Poll: your deposit coin', caption: 'Settle it. What do you deposit with?\n\nBTC · ETH · USDT · SOL', format: 'poll' },
    { title: 'GM thread', caption: 'gm. Drop the card you’d keep forever ♠♥♦♣', format: 'text' },
    { title: 'Meme: “just one more spin”', caption: 'The four stages of “just one more spin”. Set a limit before stage 2.', format: 'meme' },
    { title: 'Poll: best casino perk', caption: 'Pick one forever:\n• Fast withdrawals\n• Rakeback\n• Weekly tournaments\n• A community that’s actually fun', format: 'poll' },
    { title: 'Tier list: Discord channels', caption: 'Ranked the Flush Discord channels. Fight us in the replies.', format: 'image' },
  ],
  bip: [
    { title: 'Dev diary: the withdrawal flow', caption: 'We rebuilt the withdrawal flow three times this week. Here’s what changed and why.', format: 'thread' },
    { title: 'Behind the build: founding cards', caption: 'How we designed the numbered founding cards. 500 exist. Ever.', format: 'image' },
    { title: 'You said, we did', caption: 'Last week you asked for clearer bet history. It ships Thursday.', format: 'text' },
    { title: 'Team intro: meet the devs', caption: 'The people answering your bug reports at 2am. Say hi.', format: 'image' },
  ],
  players: [
    { title: 'Member spotlight', caption: 'This week’s spotlight: the member who answered 40 newcomer questions. Legend.', format: 'image' },
    { title: 'Royal Flush earned', caption: 'Our first Royal Flush. Earned by helping, creating and competing. Never by betting.', format: 'text' },
    { title: 'Community art Friday', caption: 'Your Flush fan art, round 1. We’re not crying, you are.', format: 'image' },
    { title: 'Bug Hunter leaderboard', caption: 'Top 10 bug hunters this week. Every report makes Flush better.', format: 'image' },
  ],
  trust: [
    { title: 'How to set a deposit limit', caption: 'Set your deposit limit in 3 taps: Profile → Safer play → Limits. Takes 20 seconds.', format: 'image' },
    { title: 'How withdrawals work', caption: 'What happens after you hit withdraw, step by step. No surprises.', format: 'thread' },
    { title: 'Cooling-off in two taps', caption: 'Need a break? Cooling-off is two taps away, and support won’t ask why.', format: 'image' },
  ],
  promos: [
    { title: 'Founding Draw: entries open', caption: 'Free to enter. One entry for saying hi in Discord, more for every active week. 19+.', format: 'image', thread: 'Rules and eligibility: flush.io/draw-rules' },
    { title: 'Game night this Thursday', caption: 'Game night in the Discord, Thursday 8pm ET. Bring snacks.', format: 'image' },
    { title: 'Alpha wave invites', caption: 'Alpha wave invites go out Friday. Check your DMs.', format: 'text' },
  ],
};

const RATES: Record<string, number> = { fun: 0.052, bip: 0.044, players: 0.046, trust: 0.03, promos: 0.028 };
const SHARES: Record<string, number> = { fun: 36, bip: 20, players: 19, trust: 14, promos: 11 };

function campaignFor(date: string, pillarId: string): string | null {
  const d = date.slice(0, 10);
  if (d >= '2026-12-07' && d <= '2026-12-20' && (pillarId === 'promos' || pillarId === 'fun')) return 'c-tourney';
  if (d >= '2026-11-02' && d <= '2026-11-29' && (pillarId === 'promos' || pillarId === 'players')) return 'c-draw';
  if (d >= '2026-11-09' && d <= '2026-12-13' && pillarId === 'bip') return 'c-alpha';
  return null;
}

const m = (impressions: number, engagements: number, profileVisits: number) => ({
  impressions,
  engagements,
  clicks: Math.round(impressions * 0.004),
  profileVisits,
});

const FIXED: Record<string, FixedPost[]> = {
  '2026-11-02': [
    { date: '2026-11-04T10:00', title: 'Collab: CryptoCasual joins the Founding Draw', caption: 'We teamed up with @cryptocasual for the Founding Draw. Free entry, 19+. #ad', pillarId: 'promos', format: 'image', metrics: m(1500, 52, 9), campaignId: 'c-draw', partnerId: 'p-casual' },
    { date: '2026-11-05T12:30', title: 'Poll: what makes you trust a new casino?', caption: 'What makes you trust a new casino?\n\n• Fast withdrawals\n• Proof of reserves\n• A real team you can talk to\n• Reviews from players', pillarId: 'fun', format: 'poll', metrics: m(6120, 371, 30) },
    { date: '2026-11-07T18:00', title: 'Meme: “Day 3 of running the Flush Discord”', caption: 'Day 3 of running the Flush Discord. 184 members. 0 sleep. 100% worth it.', pillarId: 'fun', format: 'meme', metrics: m(5470, 318, 26) },
  ],
  '2026-11-09': [
    { date: '2026-11-10T12:30', title: '“Not everyone gets a seat.” (First 500)', caption: 'Not everyone gets a seat.\nThe Flush alpha opens to 500 founding members. Numbered, and yours forever.', pillarId: 'bip', format: 'image', metrics: m(9840, 612, 47), campaignId: 'c-alpha' },
    { date: '2026-11-12T20:00', title: 'Live now: Sam’s Founding stream', caption: 'Sam is live on Kick with the founding cards. Come say hi. #ad', pillarId: 'players', format: 'stream', metrics: m(1900, 88, 12), campaignId: 'c-draw', partnerId: 'p-sam' },
  ],
  '2026-11-16': [
    { date: '2026-11-17T15:00', title: 'The Founding Tournament is coming', caption: 'The Founding Tournament. 100 winners. Biggest multiplier wins, so every spin has a shot. 19+, T&Cs in the thread.', pillarId: 'promos', format: 'video', metrics: m(7400, 333, 41), thread: 'Full rules: flush.io/tournament-rules' },
    { date: '2026-11-19T18:00', title: 'Community roles, ranked', caption: 'Flush community roles, ranked. Which tier are you?', pillarId: 'fun', format: 'meme', metrics: m(5900, 389, 33) },
  ],
};

const WEEKS = [
  { start: '2026-10-26', posts: 26, impressions: 14000, engagements: 548 },
  { start: '2026-11-02', posts: 32, impressions: 22300, engagements: 937 },
  { start: '2026-11-09', posts: 34, impressions: 28000, engagements: 1344 },
  { start: '2026-11-16', posts: 30, impressions: 31500, engagements: 1575 },
];

function publishedPosts(): Post[] {
  const r = rng(7);
  const pillars = Object.keys(T).map((id) => ({ id, share: SHARES[id], rate: RATES[id], templates: T[id] }));
  return WEEKS.flatMap((week, wi) =>
    genWeek({
      r,
      wsId: FLUSH,
      platform: 'x',
      week,
      fixed: FIXED[week.start] ?? [],
      pillars,
      times: ['09:00', '11:00', '12:30', '15:00', '18:00', '21:00'],
      idPrefix: `fx${wi}`,
      assignee: 'm-brunna',
      checklist: CHECKLIST,
      campaignFor,
    }),
  );
}

function plannedPosts(): Post[] {
  const r = rng(11);
  const out: Post[] = [];
  const pillarIds = Object.keys(T);
  for (let d = 0; d < 28; d++) {
    const date = day('2026-11-23', d);
    const count = d < 7 ? 3 : d < 14 ? 2 : 1 + (d % 2);
    const times = ['09:00', '12:30', '18:00'].slice(0, count);
    times.forEach((time, i) => {
      const pillarId = weighted(r, pillarIds.map((id) => ({ item: id, weight: SHARES[id] })));
      const t = pick(r, T[pillarId]);
      let status: PostStatus;
      if (d < 7) status = r() < 0.8 ? 'scheduled' : 'approved';
      else if (d < 14) status = pick(r, ['approved', 'review', 'review', 'draft'] as PostStatus[]);
      else status = pick(r, ['draft', 'draft', 'idea'] as PostStatus[]);
      const done = status === 'scheduled' || status === 'approved';
      out.push({
        id: `fp-${date.replace(/\D/g, '')}-${i}`,
        wsId: FLUSH,
        title: t.title,
        caption: t.caption,
        thread: t.thread ?? '',
        platform: r() < 0.88 ? 'x' : 'telegram',
        pillarId,
        format: t.format,
        status,
        date: `${date}T${time}`,
        campaignId: campaignFor(date, pillarId),
        partnerId: null,
        assigneeId: r() < 0.85 ? 'm-brunna' : 'm-jordan',
        link: '',
        checklist: Object.fromEntries(CHECKLIST.map((c) => [c, done || r() < 0.4])),
        metrics: null,
      });
    });
  }
  // A few that matter for the demo: a tournament announcement waiting for the CEO.
  out.push({
    id: 'fp-tourney-launch',
    wsId: FLUSH,
    title: 'Founding Tournament: entries open',
    caption: 'The Founding Tournament is live. 100 winners, biggest multiplier wins. 19+. T&Cs in the thread.',
    thread: 'Rules, eligibility and prize split: flush.io/tournament-rules',
    platform: 'x',
    pillarId: 'promos',
    format: 'video',
    status: 'review',
    date: '2026-12-07T12:30',
    campaignId: 'c-tourney',
    partnerId: null,
    assigneeId: 'm-brunna',
    link: 'https://flush.io/tournament?utm_source=x&utm_medium=social&utm_campaign=founding-tournament',
    checklist: Object.fromEntries(CHECKLIST.map((c, i) => [c, i !== 1])),
    metrics: null,
  });
  return out;
}

const IDEAS: Partial<Post>[] = [
  { title: 'Proof of reserves explainer', caption: 'A simple visual of how proof of reserves works.', pillarId: 'trust', format: 'thread' },
  { title: 'Founding member AMA with the CEO', caption: 'Live on the Discord Stage. Questions collected in #ama.', pillarId: 'bip', format: 'event' },
  { title: 'Clip of the week', caption: 'Best clip from our creator streams, with permission.', pillarId: 'players', format: 'video' },
  { title: 'Meme: bear market vs our withdrawal times', caption: '', pillarId: 'fun', format: 'meme' },
  { title: 'Safer play: reality check reminder', caption: 'Turn on reality checks: a reminder every 30 minutes.', pillarId: 'trust', format: 'image' },
  { title: 'Telegram channel launch post', caption: 'Our official Telegram is live. Beware of copycats: this is the only one.', pillarId: 'promos', format: 'text' },
];

function ideas(): Post[] {
  return IDEAS.map((p, i) => ({
    id: `fi-${i}`,
    wsId: FLUSH,
    title: p.title!,
    caption: p.caption!,
    thread: '',
    platform: 'x',
    pillarId: p.pillarId!,
    format: p.format!,
    status: 'idea',
    date: null,
    campaignId: null,
    partnerId: null,
    assigneeId: null,
    link: '',
    checklist: {},
    metrics: null,
  }));
}

function stats(): DailyStat[] {
  const r = rng(3);
  const x = genStats(r, FLUSH, 'x', [
    { start: '2026-10-19' },
    { start: '2026-10-26', followersGained: 132, clicks: { discord: 0, site: 41 }, profileVisits: 800 },
    { start: '2026-11-02', followersGained: 204, clicks: { discord: 62, site: 41 }, profileVisits: 1060 },
    { start: '2026-11-09', followersGained: 186, clicks: { discord: 97, site: 45 }, profileVisits: 1380 },
    { start: '2026-11-16', followersGained: 214, clicks: { discord: 120, site: 52 }, profileVisits: 1500 },
  ]);
  const discord = genStats(
    r,
    FLUSH,
    'discord',
    [
      { start: '2026-11-02', days: [2, 3, 4, 5, 6], joins: { X: 70, Creators: 52, Site: 30, 'Member invites': 32 }, leaves: 21, messages: 2140 },
      { start: '2026-11-09', joins: { X: 54, Creators: 41, Site: 19, 'Member invites': 14 }, leaves: 0, messages: 3000 },
      { start: '2026-11-16', joins: { X: 60, Creators: 49, Site: 22, 'Member invites': 20 }, leaves: 8, messages: 3400 },
    ],
    { members: true },
  );
  return [...x, ...discord];
}

const kpi = (k: Partial<Kpi> & Pick<Kpi, 'id' | 'name' | 'question' | 'unit' | 'group' | 'order'>): Kpi => ({
  wsId: FLUSH,
  direction: 'up',
  platform: null,
  cadence: 'weekly',
  phase: 'Ongoing',
  source: 'manual',
  calc: null,
  aggregate: 'avg',
  targets: [],
  ...k,
});

const target = (from: string, value: number | null, comparator: 'gte' | 'lte' | 'growth', note = '', by: string | null = null) => ({
  from,
  value,
  comparator,
  note,
  by,
});

export const flushKpis: Kpi[] = [
  kpi({ id: 'k-er', name: 'Engagement rate', question: 'Is our content working?', unit: 'percent', group: 'weekly', order: 1, platform: 'x', phase: 'From week 2', source: 'calc', calc: 'engagementRate', targets: [target('2026-10-26', 3, 'gte', 'Starting target'), target('2026-11-16', 4.5, 'gte', 'Recalibrated for month 2')] }),
  kpi({ id: 'k-netf', name: 'Net new followers', question: 'Is our reach growing?', unit: 'number', group: 'weekly', order: 2, platform: 'x', phase: 'From week 2', source: 'calc', calc: 'netFollowers', targets: [target('2026-10-26', null, 'growth', 'Growing week on week')] }),
  kpi({ id: 'k-clicks', name: 'Clicks to Discord and site', question: 'Is X sending people somewhere?', unit: 'number', group: 'weekly', order: 3, platform: 'x', phase: 'From week 2', source: 'calc', calc: 'profileClicks', targets: [target('2026-10-26', null, 'growth', 'Growing week on week')] }),
  kpi({ id: 'k-newm', name: 'New members by source', question: 'Who brings people in?', unit: 'number', group: 'weekly', order: 4, platform: 'discord', phase: 'From week 3', source: 'calc', calc: 'newMembers', targets: [target('2026-11-02', null, 'growth', 'Growing week on week')] }),
  kpi({ id: 'k-active', name: 'Weekly active members', question: 'Is the community alive?', unit: 'percent', group: 'weekly', order: 5, platform: 'discord', phase: 'From week 3', targets: [target('2026-11-02', 25, 'gte', 'Starting target'), target('2026-11-16', 50, 'gte', 'Month 2: back above 50%')] }),
  kpi({ id: 'k-ret', name: '7-day retention', question: 'Do newcomers stick?', unit: 'percent', group: 'weekly', order: 6, platform: 'discord', phase: 'From week 3', targets: [target('2026-11-02', 50, 'gte', 'Starting target')] }),
  kpi({ id: 'k-replyx', name: 'Median reply time on X', question: 'Do we answer fast?', unit: 'minutes', direction: 'down', group: 'daily', order: 7, platform: 'x', cadence: 'daily', targets: [target('2026-10-26', 60, 'lte', 'Under 1 hour')] }),
  kpi({ id: 'k-discordresp', name: 'First response in Discord', question: 'Does someone pick it up?', unit: 'minutes', direction: 'down', group: 'daily', order: 8, platform: 'discord', cadence: 'daily', targets: [target('2026-11-02', 120, 'lte', 'Under 2 hours in working hours')] }),
  kpi({ id: 'k-followers', name: 'X followers', question: 'How big is the audience?', unit: 'number', group: 'other', order: 9, platform: 'x', cadence: 'monthly', source: 'calc', calc: 'followers', aggregate: 'last', targets: [target('2026-11-16', 1200, 'gte', 'Month 2 target', '2026-12-13'), target('2027-01-11', 3000, 'gte', 'Launch, 30 days: 3,000-5,000', '2027-02-10')] }),
  kpi({ id: 'k-members', name: 'Discord members', question: 'How big is the community?', unit: 'number', group: 'other', order: 10, platform: 'discord', cadence: 'monthly', source: 'calc', calc: 'members', aggregate: 'last', targets: [target('2027-01-11', 2000, 'gte', 'Launch, 30 days: 2,000-3,000', '2027-02-10')] }),
  kpi({ id: 'k-impr', name: 'Impressions', question: 'How many times were we seen?', unit: 'number', group: 'other', order: 11, platform: 'x', cadence: 'monthly', source: 'calc', calc: 'impressions', aggregate: 'sum', targets: [target('2026-10-26', null, 'growth')] }),
  kpi({ id: 'k-posts', name: 'Posts published', question: 'Are we keeping the rhythm?', unit: 'number', group: 'other', order: 12, cadence: 'weekly', source: 'calc', calc: 'postsPublished', aggregate: 'sum' }),
  kpi({ id: 'k-creatorm', name: 'Members from creators', question: 'Are creator deals paying off?', unit: 'number', group: 'other', order: 13, cadence: 'weekly', source: 'calc', calc: 'creatorMembers', aggregate: 'sum', targets: [target('2026-11-02', null, 'growth')] }),
  kpi({ id: 'k-sentiment', name: 'Positive sentiment', question: 'How do people feel about us?', unit: 'percent', group: 'other', order: 14, cadence: 'monthly', targets: [target('2026-10-01', null, 'growth', 'Rising every month')] }),
  kpi({ id: 'k-draw', name: 'Founding Draw entries', question: 'Is the draw pulling people in?', unit: 'number', group: 'headline', order: 15, platform: 'discord', aggregate: 'last', phase: 'Discord opening' }),
  kpi({ id: 'k-seats', name: 'Founding seats taken', question: 'Is the alpha filling?', unit: 'number', group: 'headline', order: 16, aggregate: 'last', phase: 'Alpha', targets: [target('2026-11-09', 500, 'gte', '300-500 testers by the end of alpha', '2026-12-31')] }),
  kpi({ id: 'k-alphaactive', name: 'Alpha testers active weekly', question: 'Are testers engaged?', unit: 'percent', group: 'headline', order: 17, phase: 'Alpha', targets: [target('2026-11-09', 40, 'gte')] }),
  kpi({ id: 'k-drawactive', name: 'Draw entrants active after 30 days', question: 'Did the draw bring people who stay?', unit: 'percent', group: 'headline', order: 18, cadence: 'once', phase: 'Discord opening', targets: [target('2026-11-02', 30, 'gte')] }),
];

const entry = (kpiId: string, periodStart: string, value: number, note = '', cadence: KpiEntry['cadence'] = 'weekly'): KpiEntry => ({
  id: `${kpiId}_${periodStart}`,
  wsId: FLUSH,
  kpiId,
  periodStart,
  cadence,
  value,
  note,
  source: 'manual',
});

const entries: KpiEntry[] = [
  entry('k-active', '2026-11-02', 52, '96 of 184 posted or joined voice'),
  entry('k-active', '2026-11-09', 46, '134 of 291 posted or joined voice'),
  entry('k-active', '2026-11-16', 49, '177 of 364 posted or joined voice'),
  entry('k-ret', '2026-11-09', 61, '99 of 163 week-3 joiners still active · creator joiners 68%'),
  entry('k-ret', '2026-11-16', 63, '81 of 128 week-4 joiners still active'),
  entry('k-replyx', '2026-10-26', 41),
  entry('k-replyx', '2026-11-02', 38),
  entry('k-replyx', '2026-11-09', 34),
  entry('k-replyx', '2026-11-16', 31),
  entry('k-discordresp', '2026-11-02', 80),
  entry('k-discordresp', '2026-11-09', 65),
  entry('k-discordresp', '2026-11-16', 58),
  entry('k-sentiment', '2026-10-01', 58, 'Mostly curiosity; a few "another casino?" replies', 'monthly'),
  entry('k-sentiment', '2026-11-01', 64, 'Founding cards and fast replies praised', 'monthly'),
  entry('k-draw', '2026-11-02', 120),
  entry('k-draw', '2026-11-09', 254),
  entry('k-draw', '2026-11-16', 331),
  entry('k-seats', '2026-11-09', 186, 'Wave 1 + community wave'),
  entry('k-seats', '2026-11-16', 241),
  entry('k-alphaactive', '2026-11-09', 44),
  entry('k-alphaactive', '2026-11-16', 47),
];

export const flushCampaigns: Campaign[] = [
  {
    id: 'c-draw',
    wsId: FLUSH,
    name: 'Founding Draw',
    theme: 'Open the Discord with a free draw that rewards people who stay',
    strategy:
      'Free to enter, 19+. One entry for saying hi in Discord, extra entries for every active week, so the draw rewards staying, not just joining. The main X post carries no link; the Discord invite sits in the first reply. Creators get their own tracked invite links so we can see who brings members who stay.',
    start: '2026-11-02',
    end: '2026-11-29',
    color: 7,
    channels: ['x', 'discord', 'kick'],
    budget: 2500,
    ownerId: 'm-brunna',
    goals: [
      { kpiId: 'k-newm', target: 450 },
      { kpiId: 'k-creatorm', target: 150 },
      { kpiId: 'k-er', target: 4.5 },
    ],
  },
  {
    id: 'c-alpha',
    wsId: FLUSH,
    name: 'First 500 (alpha)',
    theme: 'Numbered founding seats, earned by joining in',
    strategy:
      'Scarcity and status: 500 numbered founding seats, earned through quests, bug reports and helping others. Waves: testers, community (~150), then open seats if stable. Weekly “You said, we did” posts close the feedback loop.',
    start: '2026-11-09',
    end: '2026-12-13',
    color: 6,
    channels: ['x', 'discord'],
    budget: 1500,
    ownerId: 'm-brunna',
    goals: [
      { kpiId: 'k-seats', target: 350 },
      { kpiId: 'k-alphaactive', target: 40 },
    ],
  },
  {
    id: 'c-tourney',
    wsId: FLUSH,
    name: 'Founding Tournament',
    theme: 'Fair for every player: the biggest multiplier wins',
    strategy:
      'A tournament where a small spin has the same shot as a big one. 100 winners so more people feel it’s worth joining. 19+ and T&Cs on the image; the full rules sit in the first reply. Creators stream their runs with clear #ad labels.',
    start: '2026-12-07',
    end: '2026-12-20',
    color: 8,
    channels: ['x', 'discord', 'kick'],
    budget: 3000,
    ownerId: 'm-brunna',
    goals: [
      { kpiId: 'k-netf', target: 600 },
      { kpiId: 'k-er', target: 4.5 },
    ],
  },
  {
    id: 'c-launch',
    wsId: FLUSH,
    name: 'Launch countdown',
    theme: 'From alpha to everyone: the January launch',
    strategy:
      'Waitlist and invite chain, 10-day countdown, creator and clipper line-up, Telegram announcement channel. Launch week with a daily event and the first season Table Goal.',
    start: '2027-01-04',
    end: '2027-01-31',
    color: 1,
    channels: ['x', 'discord', 'telegram', 'kick'],
    budget: 8000,
    ownerId: 'm-alex',
    goals: [{ kpiId: 'k-members', target: 2000 }],
  },
];

export const flushPartners: Partner[] = [
  { id: 'p-sam', wsId: FLUSH, name: 'Sam Reyes', handle: '@spinwithsam', type: 'streamer', platform: 'kick', audience: 18000, niche: 'Slots, crypto casual', contact: 'sam@creator.example', trackingCode: 'discord.gg/flush-sam', deal: { model: 'flat', rate: 400, notes: '$400 per 2h stream, #ad + Paid Partnership label' }, stage: 'active', rating: 4, notes: 'Great chat energy. Viewers stay in Discord after streams.' },
  { id: 'p-casual', wsId: FLUSH, name: 'CryptoCasual', handle: '@cryptocasual', type: 'creator', platform: 'x', audience: 42000, niche: 'Crypto news & memes', contact: 'dm on X', trackingCode: 'discord.gg/flush-cc', deal: { model: 'cpa', rate: 20, notes: '$20 per new Discord member, tracked invite' }, stage: 'active', rating: 5, notes: 'Best cost per active member so far.' },
  { id: 'p-cliplab', wsId: FLUSH, name: 'ClipLab', handle: '@cliplab', type: 'clipper', platform: 'youtube', audience: 120000, niche: 'Clipping network (Shorts, X)', contact: 'ops@cliplab.example', trackingCode: 'flush.io/?ref=cliplab', deal: { model: 'cpm', rate: 3, notes: '$3 per 1,000 verified views. Test budget $3-5K over 3-4 weeks.' }, stage: 'active', rating: 3, notes: 'Huge reach, weak conversion so far. Review at test end.' },
  { id: 'p-degen', wsId: FLUSH, name: 'degen.daily', handle: '@degendaily', type: 'creator', platform: 'x', audience: 9000, niche: 'Degen culture, memes', contact: 'dm on X', trackingCode: 'discord.gg/flush-dd', deal: { model: 'flat', rate: 150, notes: '$150 per post' }, stage: 'active', rating: 4, notes: '' },
  { id: 'p-satoshi', wsId: FLUSH, name: 'Satoshi Street', handle: 'Satoshi Street Discord', type: 'community', platform: 'discord', audience: 6500, niche: 'Crypto trading community', contact: 'mods@satoshistreet.example', trackingCode: 'discord.gg/flush-ss', deal: { model: 'gifted', rate: 0, notes: 'Cross-community game night, 10 alpha seats' }, stage: 'active', rating: 4, notes: '' },
  { id: 'p-lena', wsId: FLUSH, name: 'Lena Vox', handle: '@lenavox', type: 'streamer', platform: 'kick', audience: 31000, niche: 'Variety, slots', contact: 'lena@agency.example', trackingCode: 'discord.gg/flush-lena', deal: { model: 'flat', rate: 600, notes: 'Asking $600/stream; we offered $450 + rev-share' }, stage: 'negotiating', rating: 0, notes: 'Strong fit for the tournament.' },
  { id: 'p-moon', wsId: FLUSH, name: 'Moonbag Memes', handle: '@moonbagmemes', type: 'creator', platform: 'x', audience: 75000, niche: 'Crypto memes', contact: 'dm on X', trackingCode: '', deal: { model: 'flat', rate: 0, notes: '' }, stage: 'prospect', rating: 0, notes: 'Check audience age and region before outreach.' },
];

const dl = (
  id: string,
  partnerId: string,
  kind: Deliverable['kind'],
  title: string,
  date: string,
  campaignId: string | null,
  cost: number,
  results: [number, number, number, number, number | null] | null,
  paid = true,
): Deliverable => ({
  id,
  wsId: FLUSH,
  partnerId,
  campaignId,
  kind,
  title,
  due: date,
  delivered: results ? date : null,
  results: results
    ? { views: results[0], clicks: results[1], signups: results[2], newMembers: results[3], retained7d: results[4] }
    : null,
  cost,
  paid,
});

export const flushDeliverables: Deliverable[] = [
  dl('d1', 'p-casual', 'post', 'Founding Draw announcement', '2026-11-04', 'c-draw', 440, [15200, 210, 0, 22, 15]),
  dl('d2', 'p-sam', 'stream', 'Founding cards stream #1', '2026-11-05', 'c-draw', 400, [2100, 140, 0, 18, 13]),
  dl('d3', 'p-degen', 'post', 'Discord opening meme', '2026-11-07', 'c-draw', 150, [6100, 70, 0, 12, 8]),
  dl('d4', 'p-cliplab', 'clip', 'Clipping test, week 1', '2026-11-09', null, 192, [64000, 120, 0, 9, 6]),
  dl('d5', 'p-casual', 'post', 'First 500 thread', '2026-11-10', 'c-alpha', 300, [12800, 160, 0, 15, 10]),
  dl('d6', 'p-sam', 'stream', 'Founding cards stream #2', '2026-11-12', 'c-draw', 400, [2600, 150, 0, 11, 8]),
  dl('d7', 'p-satoshi', 'event', 'Cross-community game night', '2026-11-14', 'c-draw', 0, [900, 60, 0, 6, 5]),
  dl('d8', 'p-cliplab', 'clip', 'Clipping test, week 2', '2026-11-16', null, 213, [71000, 140, 0, 12, null], false),
  dl('d9', 'p-casual', 'post', 'Tournament teaser quote-post', '2026-11-17', 'c-draw', 360, [14100, 190, 0, 18, null], false),
  dl('d10', 'p-sam', 'stream', 'Founding cards stream #3', '2026-11-19', 'c-draw', 400, [2900, 170, 0, 13, null], false),
  dl('d11', 'p-degen', 'post', 'Alpha bug-hunter meme', '2026-11-20', 'c-alpha', 150, [5800, 66, 0, 6, null], false),
  dl('d12', 'p-cliplab', 'clip', 'Clipping test, week 3', '2026-11-23', null, 0, null, false),
  dl('d13', 'p-casual', 'post', 'Draw last-call post', '2026-11-24', 'c-draw', 0, null, false),
  dl('d14', 'p-sam', 'stream', 'Founding cards stream #4', '2026-11-26', 'c-draw', 400, null, false),
  dl('d15', 'p-lena', 'stream', 'Tournament opening stream', '2026-12-07', 'c-tourney', 450, null, false),
];

const comments: Comment[] = [
  { id: 'cm1', wsId: FLUSH, targetType: 'post', targetId: 'fp-tourney-launch', authorId: 'm-alex', body: 'Looks great. The paid-partnership box isn’t ticked: are creators reposting this one? If so we need the label.', kind: 'changes', createdAt: '2026-11-21T10:12' },
  { id: 'cm2', wsId: FLUSH, targetType: 'post', targetId: 'fp-tourney-launch', authorId: 'm-brunna', body: 'Yes, Lena and Sam will quote-post it. Adding #ad to their briefs and the label here.', kind: 'comment', createdAt: '2026-11-21T10:40' },
  { id: 'cm3', wsId: FLUSH, targetType: 'campaign', targetId: 'c-tourney', authorId: 'm-jordan', body: 'Lena is close: she wants $600, I offered $450 + rev-share. Will update by Wednesday.', kind: 'comment', createdAt: '2026-11-20T16:05' },
];

export function flushSeed() {
  return {
    workspace: flushWorkspace,
    posts: [...publishedPosts(), ...plannedPosts(), ...ideas()],
    stats: stats(),
    kpis: flushKpis,
    kpiEntries: entries,
    campaigns: flushCampaigns,
    partners: flushPartners,
    deliverables: flushDeliverables,
    comments,
  };
}
