import type { Kpi, Member, Platform, Workspace } from '@/data/types';

export const ACCENTS = ['#2563EB', '#EC001F', '#0F766E', '#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#18181B'];
export const ALL_PLATFORMS: Platform[] = ['x', 'instagram', 'tiktok', 'discord', 'telegram', 'youtube', 'linkedin', 'kick'];

/** A new, empty workspace with the creator as admin, standard pillars and four starter KPIs. */
export function buildWorkspace(args: { id: string; name: string; accent: string; platforms: Platform[]; admin: Member; now: string }): { ws: Workspace; kpis: Kpi[] } {
  const { id, name, accent, platforms, admin, now } = args;
  const ws: Workspace = {
    id,
    name: name.trim(),
    tagline: 'Social and community',
    initials: name.trim().charAt(0).toUpperCase(),
    accent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekStartsOn: 1,
    platforms,
    pillars: [
      { id: 'educate', name: 'Educate', color: 1, targetShare: 35, description: '' },
      { id: 'entertain', name: 'Entertain', color: 2, targetShare: 30, description: '' },
      { id: 'community', name: 'Community', color: 3, targetShare: 20, description: '' },
      { id: 'promote', name: 'Promote', color: 4, targetShare: 15, description: '' },
    ],
    checklist: ['Brand voice checked', 'Alt text added', 'Paid partnership labelled (#ad)'],
    members: [{ ...admin, role: 'admin' }],
    annotations: [],
    settings: { managersCanDraft: false, managersCanApprove: true },
    createdAt: now,
  };
  const p = platforms[0] ?? null;
  const base = { wsId: id, direction: 'up' as const, cadence: 'weekly' as const, phase: 'Ongoing', aggregate: 'sum' as const, platform: p };
  const target = (value: number | null, comparator: 'gte' | 'growth') => [{ from: now.slice(0, 10), value, comparator, by: null, note: '' }];
  const kpis: Kpi[] = [
    { ...base, id: `${id}-er`, name: 'Engagement rate', question: 'Is our content working?', unit: 'percent', group: 'weekly', source: 'calc', calc: 'engagementRate', aggregate: 'avg', order: 1, targets: target(3, 'gte') },
    { ...base, id: `${id}-netf`, name: 'Net new followers', question: 'Is our reach growing?', unit: 'number', group: 'weekly', source: 'calc', calc: 'netFollowers', order: 2, targets: target(null, 'growth') },
    { ...base, id: `${id}-clicks`, name: 'Link clicks', question: 'Are we sending people somewhere?', unit: 'number', group: 'weekly', source: 'calc', calc: 'profileClicks', order: 3, targets: target(null, 'growth') },
    { ...base, id: `${id}-posts`, name: 'Posts published', question: 'Are we keeping the rhythm?', unit: 'number', platform: null, group: 'other', source: 'calc', calc: 'postsPublished', order: 4, targets: [] },
  ];
  return { ws, kpis };
}
