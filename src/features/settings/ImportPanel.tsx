import { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Badge, Button, Card, Segmented, Textarea } from '@/components/ui';
import type { DailyStat, KpiEntry, Platform, Post, WsData } from '@/data/types';
import { csvObjects, download, toCsv } from '@/lib/csv';
import { cap } from '@/lib/format';
import { isIsoDate } from '@/lib/period';

type Kind = 'stats' | 'posts' | 'kpis';

interface Parsed {
  ok: boolean;
  message: string;
  stat?: DailyStat;
  entry?: KpiEntry;
  post?: Post;
}

const HELP: Record<Kind, { title: string; body: string; template: (string | number)[][] }> = {
  stats: {
    title: 'Channel stats (daily)',
    body: 'One row per day and platform, e.g. from X Analytics or a Discord stats bot. Columns starting with click_ are tracked profile links; join_ columns are new members by invite link.',
    template: [
      ['date', 'platform', 'followers', 'members', 'profile_visits', 'leaves', 'messages', 'click_discord', 'click_site', 'join_x', 'join_creators'],
      ['2026-11-23', 'x', 760, '', 210, '', '', 18, 7, '', ''],
      ['2026-11-23', 'discord', '', 372, '', 1, 480, '', '', 9, 6],
    ],
  },
  posts: {
    title: 'Post results',
    body: 'Match on post_id (shown in the post URL), or on date + title to add a post that was published outside Pulse.',
    template: [
      ['post_id', 'date', 'title', 'platform', 'pillar', 'impressions', 'engagements', 'clicks', 'profile_visits'],
      ['', '2026-11-23T12:30', 'Poll: favourite game night', 'x', 'fun', 3200, 190, 12, 20],
    ],
  },
  kpis: {
    title: 'KPI results',
    body: 'Manual KPIs only. Use the KPI id or its exact name. period_start is the Monday of the week (or the 1st for monthly KPIs).',
    template: [
      ['kpi', 'period_start', 'value', 'note'],
      ['Weekly active members', '2026-11-23', 51, '190 of 372 posted or joined voice'],
    ],
  },
};

const n = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : Number(v.replace(/,/g, '')));

function parse(kind: Kind, text: string, d: WsData): Parsed[] {
  const rows = csvObjects(text);
  const platforms = new Set<string>(d.ws.platforms);
  return rows.map((r) => {
    if (kind === 'stats') {
      if (!isIsoDate(r.date)) return { ok: false, message: `Bad date “${r.date ?? ''}”` };
      if (!platforms.has(r.platform)) return { ok: false, message: `Platform “${r.platform ?? ''}” isn’t in this workspace` };
      const id = `${d.ws.id}_${r.platform}_${r.date}`;
      const prev = d.stats.find((s) => s.id === id);
      const pick = (prefix: string, label: (k: string) => string) =>
        Object.fromEntries(
          Object.entries(r)
            .filter(([k, v]) => k.startsWith(prefix) && v !== '')
            .map(([k, v]) => [label(k.slice(prefix.length).replace(/_/g, ' ')), Number(v) || 0]),
        );
      // Same keys as the seed data: lower-case link names, capitalised sources.
      const clicks = pick('click_', (k) => k);
      const joins = pick('join_', cap);
      const stat: DailyStat = {
        id,
        wsId: d.ws.id,
        platform: r.platform as Platform,
        date: r.date,
        followers: n(r.followers) ?? prev?.followers ?? null,
        members: n(r.members) ?? prev?.members ?? null,
        clicks: Object.keys(clicks).length ? clicks : prev?.clicks ?? {},
        joins: Object.keys(joins).length ? joins : prev?.joins ?? {},
        leaves: n(r.leaves) ?? prev?.leaves ?? 0,
        profileVisits: n(r.profile_visits) ?? prev?.profileVisits ?? 0,
        messages: n(r.messages) ?? prev?.messages ?? 0,
      };
      return { ok: true, message: prev ? 'Updates the day' : 'New day', stat };
    }
    if (kind === 'kpis') {
      const kpi = d.kpis.find((k) => k.id === r.kpi || k.name.toLowerCase() === (r.kpi ?? '').toLowerCase());
      if (!kpi) return { ok: false, message: `Unknown KPI “${r.kpi ?? ''}”` };
      if (kpi.source !== 'manual') return { ok: false, message: `${kpi.name} is calculated, not entered` };
      if (!isIsoDate(r.period_start)) return { ok: false, message: `Bad period_start “${r.period_start ?? ''}”` };
      const value = n(r.value);
      if (value === null || Number.isNaN(value)) return { ok: false, message: 'Missing value' };
      return {
        ok: true,
        message: kpi.name,
        entry: { id: `${kpi.id}_${r.period_start}`, wsId: d.ws.id, kpiId: kpi.id, periodStart: r.period_start, cadence: kpi.cadence === 'monthly' ? 'monthly' : 'weekly', value, note: r.note ?? '', source: 'csv' },
      };
    }
    const metrics = { impressions: n(r.impressions) ?? 0, engagements: n(r.engagements) ?? 0, clicks: n(r.clicks) ?? 0, profileVisits: n(r.profile_visits) ?? 0 };
    let post = r.post_id ? d.posts.find((p) => p.id === r.post_id) : undefined;
    if (!post && r.date && r.title) post = d.posts.find((p) => p.date?.slice(0, 16) === r.date.slice(0, 16) && p.title === r.title);
    if (post) return { ok: true, message: `Updates “${post.title}”`, post: { ...post, status: 'published', metrics } };
    if (!r.date || !isIsoDate(r.date.slice(0, 10)) || !r.title) return { ok: false, message: 'No matching post; add date and title to create one' };
    const platform = (platforms.has(r.platform) ? r.platform : d.ws.platforms[0]) as Platform;
    const pillar = d.ws.pillars.find((p) => p.id === r.pillar || p.name.toLowerCase() === (r.pillar ?? '').toLowerCase());
    return {
      ok: true,
      message: 'New published post',
      post: { id: newId('post'), wsId: d.ws.id, title: r.title, caption: '', thread: '', platform, pillarId: pillar?.id ?? d.ws.pillars[0]?.id ?? '', format: 'text', status: 'published', date: r.date.length > 10 ? r.date.slice(0, 16) : `${r.date}T12:00`, campaignId: null, partnerId: null, assigneeId: null, link: '', checklist: {}, metrics },
    };
  });
}

export function ImportPanel() {
  const { data, can } = useSession();
  const actions = useActions();
  const [kind, setKind] = useState<Kind>('stats');
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const parsed = useMemo(() => (text.trim() ? parse(kind, text, data) : []), [kind, text, data]);
  const good = parsed.filter((p) => p.ok);
  const help = HELP[kind];

  const run = () => {
    actions.importRows(
      { stats: good.flatMap((p) => (p.stat ? [p.stat] : [])), entries: good.flatMap((p) => (p.entry ? [p.entry] : [])), posts: good.flatMap((p) => (p.post ? [p.post] : [])) },
      help.title,
    );
    setDone(`Imported ${good.length} rows.`);
    setText('');
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.2fr]">
      <Card title="Import a CSV" subtitle="Manual entry and CSV come first; platform APIs can come later.">
        <div className="flex flex-col gap-3">
          <Segmented
            label="What to import"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setDone('');
            }}
            options={[
              { value: 'stats', label: 'Channel stats' },
              { value: 'posts', label: 'Post results' },
              { value: 'kpis', label: 'KPI results' },
            ]}
          />
          <p className="text-[13px] text-soft">{help.body}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Download size={14} />} onClick={() => download(`pulse-template-${kind}.csv`, toCsv(help.template))}>
              Download template
            </Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium hover:bg-surface-2">
              <Upload size={14} /> Choose file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setText(await f.text());
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="…or paste CSV here" className="font-mono text-[12px]" aria-label="CSV text" />
          {done && <p className="text-[13px] text-good-text">{done}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-muted">{parsed.length ? `${good.length} of ${parsed.length} rows ready` : 'Nothing parsed yet'}</span>
            <Button variant="primary" disabled={!good.length || !can('kpi.enter')} onClick={run}>
              Import {good.length || ''} rows
            </Button>
          </div>
          {!can('kpi.enter') && <p className="text-[12.5px] text-muted">Only admins can import.</p>}
        </div>
      </Card>
      <Card title="Preview">
        {parsed.length === 0 ? (
          <p className="text-[13px] text-muted">Rows appear here with a check before anything is saved.</p>
        ) : (
          <ul className="flex max-h-[460px] flex-col divide-y divide-line overflow-y-auto">
            {parsed.map((p, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="tabular w-8 text-muted">{i + 2}</span>
                <Badge tone={p.ok ? 'good' : 'critical'}>{p.ok ? 'OK' : 'Skip'}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  {p.message}
                  {p.stat && <span className="text-muted"> · {p.stat.platform} {p.stat.date}</span>}
                  {p.entry && <span className="text-muted"> · {p.entry.periodStart} = {p.entry.value}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
