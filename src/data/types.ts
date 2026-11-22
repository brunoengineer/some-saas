// Data model. Mirrors the Firestore layout in the plan: every record carries its
// workspace id (wsId) so the mock store can later be split into
// workspaces/{wsId}/<collection> without changing the shapes.

export type Role = 'admin' | 'manager' | 'viewer';

export type Platform =
  | 'x'
  | 'discord'
  | 'telegram'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'kick';

export type PostStatus = 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'published';
export type PostFormat = 'text' | 'image' | 'video' | 'poll' | 'thread' | 'meme' | 'stream' | 'event';

/** A content pillar. `color` is a categorical palette slot, 1-8. */
export interface Pillar {
  id: string;
  name: string;
  color: number;
  /** Target share of posts, 0-100. */
  targetShare: number;
  /** What belongs in this pillar, shown on the Pillars page. */
  description?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
}

export interface Annotation {
  date: string;
  label: string;
}


export interface Workspace {
  id: string;
  name: string;
  tagline: string;
  initials: string;
  /** Brand accent color (hex). */
  accent: string;
  timezone: string;
  weekStartsOn: 0 | 1;
  platforms: Platform[];
  pillars: Pillar[];
  /** Pre-publish compliance checklist items. */
  checklist: string[];
  members: Member[];
  annotations: Annotation[];
  settings: { managersCanDraft: boolean; managersCanApprove: boolean };
  createdAt: string;
  integrations?: Integrations;
}

export interface PostMetrics {
  impressions: number;
  engagements: number;
  clicks: number;
  profileVisits: number;
}

export interface Post {
  id: string;
  wsId: string;
  title: string;
  caption: string;
  /** First reply / thread text (links go here, not in the main post). */
  thread: string;
  platform: Platform;
  pillarId: string;
  format: PostFormat;
  status: PostStatus;
  /** Local datetime 'yyyy-MM-ddTHH:mm', or null for an unscheduled idea. */
  date: string | null;
  campaignId: string | null;
  partnerId: string | null;
  assigneeId: string | null;
  link: string;
  checklist: Record<string, boolean>;
  metrics: PostMetrics | null;
  /** The post's image: a data URL in the prototype, a Storage URL from Phase 1. Missing means none. */
  image?: string | null;
  /** A small copy of the image (about 400px) for calendar cards. */
  thumb?: string | null;
  /** Link to the post once it's live on the platform. */
  postUrl?: string;
  /** Discord only: the channel it goes to, without the #. */
  channel?: string;
}

export interface CampaignGoal {
  kpiId: string;
  target: number;
}

export interface Campaign {
  id: string;
  wsId: string;
  name: string;
  theme: string;
  strategy: string;
  start: string;
  end: string;
  /** Set by hand to override the dates (e.g. still live after the end date). Unset: follows the dates. */
  status?: 'planned' | 'live' | 'done' | null;
  /** Categorical palette slot, 1-8. */
  color: number;
  channels: Platform[];
  budget: number;
  ownerId: string | null;
  goals: CampaignGoal[];
}

export type PartnerType = 'creator' | 'streamer' | 'clipper' | 'affiliate' | 'community' | 'brand';
export type PartnerStage = 'prospect' | 'contacted' | 'negotiating' | 'active' | 'paused' | 'ended';
export type DealModel = 'flat' | 'cpm' | 'cpa' | 'revshare' | 'gifted';

export interface Partner {
  id: string;
  wsId: string;
  name: string;
  handle: string;
  type: PartnerType;
  platform: Platform;
  audience: number;
  niche: string;
  contact: string;
  trackingCode: string;
  deal: { model: DealModel; rate: number; notes: string };
  stage: PartnerStage;
  /** 0-5 */
  rating: number;
  notes: string;
}

export interface DeliverableResults {
  views: number;
  clicks: number;
  signups: number;
  newMembers: number;
  /** Members still active 7 days later; null until measured. */
  retained7d: number | null;
}

export interface Deliverable {
  id: string;
  wsId: string;
  partnerId: string;
  campaignId: string | null;
  kind: 'post' | 'stream' | 'clip' | 'video' | 'event';
  title: string;
  due: string;
  delivered: string | null;
  results: DeliverableResults | null;
  cost: number;
  paid: boolean;
  /** Where the partner publishes it. Unset: the partner's main platform. */
  platform?: Platform | null;
  /** Link to the partner's published post, stream or video. */
  url?: string;
  /** The calendar post this deliverable was created from, if any. */
  postId?: string | null;
}

export type KpiUnit = 'percent' | 'number' | 'minutes' | 'currency';
export type Cadence = 'daily' | 'weekly' | 'monthly' | 'once';
export type Comparator = 'gte' | 'lte' | 'growth';
export type KpiGroup = 'weekly' | 'daily' | 'headline' | 'other';

/** Calculated KPIs read from posts, channel stats or partner deliverables. */
export type CalcKey =
  | 'engagementRate'
  | 'activeShare'
  | 'retention7'
  | 'netFollowers'
  | 'followers'
  | 'impressions'
  | 'profileClicks'
  | 'postsPublished'
  | 'newMembers'
  | 'members'
  | 'creatorMembers'
  | 'engagements'
  | 'postClicks'
  | 'profileVisits'
  | 'avgImpressions'
  | 'partnerViews'
  | 'partnerCost'
  | 'costPerMember';

/** A KPI built from two others, e.g. clicks ÷ impressions. */
export interface KpiFormula {
  a: string;
  op: 'divide' | 'multiply' | 'add' | 'subtract';
  b: string;
  /** Multiply the result by 100 (for a ratio shown as a percentage). */
  percent: boolean;
}

export interface KpiTarget {
  /** Applies from this date until the next target's `from` (recalibration keeps history). */
  from: string;
  value: number | null;
  comparator: Comparator;
  /** Optional deadline used for pacing, e.g. "1,200 followers by 13 Dec". */
  by: string | null;
  note: string;
}

export interface Kpi {
  id: string;
  wsId: string;
  name: string;
  question: string;
  unit: KpiUnit;
  direction: 'up' | 'down';
  platform: Platform | null;
  cadence: Cadence;
  phase: string;
  group: KpiGroup;
  source: 'calc' | 'manual' | 'formula';
  calc: CalcKey | null;
  formula?: KpiFormula | null;
  /** Paused KPIs keep their history but leave the overview, entry form, dashboard and new reports. */
  paused?: boolean;
  /** Show as a tile on the Dashboard. Unset means: yes for the weekly numbers. */
  onDashboard?: boolean;
  /** How manual entries combine over a longer period. */
  aggregate: 'last' | 'sum' | 'avg';
  targets: KpiTarget[];
  order: number;
}

export interface KpiEntry {
  id: string;
  wsId: string;
  kpiId: string;
  /** Start of the period the value covers ('yyyy-MM-dd'). */
  periodStart: string;
  cadence: Cadence;
  value: number;
  note: string;
  source: 'manual' | 'csv';
}

/** One day of channel-level numbers (what a CSV export or stats bot gives). */
export interface DailyStat {
  id: string;
  wsId: string;
  platform: Platform;
  date: string;
  followers: number | null;
  members: number | null;
  /** Clicks on tracked profile links, by destination. */
  clicks: Record<string, number>;
  /** New members/followers by tracked source (invite links). */
  joins: Record<string, number>;
  leaves: number;
  profileVisits: number;
  messages: number;
  /** Discord sync: people who posted that day. */
  active?: number | null;
  /** Discord sync: people who posted in the 7 days ending that day. */
  active7?: number | null;
  /** Discord sync: members online when it ran. */
  online?: number | null;
  /** Discord sync: people who joined that day (seen live). */
  cohortSize?: number | null;
  /** Discord sync: of those, how many were still in the server 7 days later. */
  retained7?: number | null;
}

/** Where a workspace's numbers can be fetched from automatically (see docs/discord.md). */
export interface Integrations {
  discord?: {
    /** The Discord server id (right-click the server → Copy Server ID). */
    guildId: string;
    /** Invite code → the source name shown in Pulse. Partners' tracking links are added automatically. */
    labels: Record<string, string>;
  };
}

/** `workspaces/{id}/sync/state`: the Update button asks, the sync script answers. */
export interface SyncState {
  id: 'state';
  wsId: string;
  status: 'idle' | 'requested' | 'running' | 'done' | 'error';
  requestedAt?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  /** What the last run did, or what went wrong. */
  message?: string;
  /** The sync script checks in every few minutes while it runs in watch mode. */
  runnerSeenAt?: string | null;
  runner?: string | null;
}

export type CommentTarget = 'post' | 'campaign' | 'report' | 'partner';

export interface Comment {
  id: string;
  wsId: string;
  targetType: CommentTarget;
  targetId: string;
  authorId: string;
  body: string;
  kind: 'comment' | 'approved' | 'changes';
  createdAt: string;
  editedAt?: string;
}

export type Status = 'good' | 'warning' | 'critical' | 'none';

export interface ReportKpi {
  id: string;
  name: string;
  question: string;
  unit: KpiUnit;
  direction: 'up' | 'down';
  platform: Platform | null;
  group: KpiGroup;
  value: number | null;
  prev: number | null;
  target: KpiTarget | null;
  status: Status;
  detail: string;
}

export interface ReportPostRow {
  id: string;
  title: string;
  caption: string;
  date: string;
  platform: Platform;
  pillar: string;
  impressions: number;
  engagements: number;
  rate: number;
  profileVisits: number;
}

export interface PartnerRow {
  id: string;
  name: string;
  handle: string;
  type: PartnerType;
  deliverables: number;
  views: number;
  clicks: number;
  newMembers: number;
  retained: number | null;
  retention: number | null;
  cost: number;
  cpm: number | null;
  costPerMember: number | null;
}

export interface ReportSnapshot {
  primaryPlatform: Platform | null;
  totals: {
    posts: number;
    impressions: number;
    engagements: number;
    rate: number | null;
    followers: number | null;
    members: number | null;
    joins: number;
    leaves: number;
    profileClicks: number;
    profileVisits: number;
    messages: number;
  };
  kpis: ReportKpi[];
  followers: { date: string; value: number }[];
  pillars: { id: string; name: string; color: number; posts: number; share: number; target: number; rate: number | null }[];
  joinsBySource: { source: string; value: number }[];
  topPosts: ReportPostRow[];
  partners: PartnerRow[];
  annotations: Annotation[];
}

export interface ReportNarrative {
  headline: string;
  summary: string;
  actions: { title: string; body: string }[];
  footnote: string;
  /** Sections and cards removed while editing (keys from REPORT_SECTIONS, or `card:<key>`). */
  hidden?: string[];
  /** KPI tiles removed while editing. */
  hiddenKpis?: string[];
  /** KPIs added while editing, frozen when they were added. */
  addedKpis?: ReportKpi[];
  /** Extra figures typed in by hand. */
  cards?: { id: string; label: string; value: string; note: string }[];
  /** Extra text sections (topics). */
  sections?: { id: string; title: string; body: string }[];
}

export type ReportType = 'weekly' | 'monthly' | 'campaign' | 'custom';

export interface Report {
  id: string;
  wsId: string;
  type: ReportType;
  title: string;
  start: string;
  end: string;
  campaignId: string | null;
  trigger: 'auto' | 'manual';
  status: 'draft' | 'final';
  createdAt: string;
  createdBy: string;
  snapshot: ReportSnapshot;
  narrative: ReportNarrative;
}

export interface Activity {
  id: string;
  wsId: string;
  at: string;
  actorId: string;
  text: string;
  link: string | null;
}

export interface DB {
  version: number;
  workspaces: Workspace[];
  posts: Post[];
  campaigns: Campaign[];
  partners: Partner[];
  deliverables: Deliverable[];
  kpis: Kpi[];
  kpiEntries: KpiEntry[];
  stats: DailyStat[];
  comments: Comment[];
  reports: Report[];
  activity: Activity[];
}

export type Collection = Exclude<keyof DB, 'version'>;
export type Item<C extends Collection> = DB[C][number];

/** All records of one workspace, as the pages and calculations use them. */
export interface WsData {
  ws: Workspace;
  posts: Post[];
  campaigns: Campaign[];
  partners: Partner[];
  deliverables: Deliverable[];
  kpis: Kpi[];
  kpiEntries: KpiEntry[];
  stats: DailyStat[];
  comments: Comment[];
  reports: Report[];
  activity: Activity[];
}
