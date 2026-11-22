import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { ExternalLink, Lightbulb, Plus } from 'lucide-react';
import { PeriodStepper } from '@/components/PeriodStepper';
import { useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import { DataTable } from '@/components/DataTable';
import { PlatformIcon } from '@/components/PlatformIcon';
import { cardImage } from '@/components/usePostImage';
import { Badge, Button, cx, Dot, IconButton, PageHeader, PlatformBadge, Segmented, Select } from '@/components/ui';
import type { Post, PostStatus } from '@/data/types';
import { dateTimeLabel, PLATFORM_LABEL, safeUrl, timeOf } from '@/lib/format';
import { canEditPost } from '@/lib/permissions';
import { addDaysIso, eachDay, isIsoDate, iso, toDate } from '@/lib/period';
import { blankPost, PostDrawer, type PostDraft } from './PostDrawer';
import { STATUS_LABEL, STATUS_TONE, STATUSES } from './postMeta';

type View = 'month' | 'week' | 'list' | 'board';

export function CalendarPage() {
  const { data, ws, today, role, can } = useSession();
  const actions = useActions();
  const memberName = useMemberName();
  const [params, setParams] = useSearchParams();
  const [showIdeas, setShowIdeas] = useState(true);
  const [draftNew, setDraftNew] = useState<PostDraft | null>(null);
  // ?pillar= comes from the Pillars page ("See these posts in the calendar").
  const [f, setF] = useState(() => ({ platform: '', pillar: params.get('pillar') ?? '', campaign: '', status: '', assignee: '' }));

  const view = (params.get('view') as View) || 'month';
  const d = params.get('d');
  const anchor = isIsoDate(d) ? d : today;
  const openId = params.get('post');
  const openPost = openId ? data.posts.find((p) => p.id === openId) ?? null : null;

  const setParam = (patch: Record<string, string | null>) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) (v === null ? n.delete(k) : n.set(k, v));
      return n;
    });

  const canDrag = can('edit');
  const matches = (p: Post) =>
    (!f.platform || p.platform === f.platform) &&
    (!f.pillar || p.pillarId === f.pillar) &&
    (!f.campaign || (f.campaign === 'none' ? !p.campaignId : p.campaignId === f.campaign)) &&
    (!f.status || p.status === f.status) &&
    (!f.assignee || p.assigneeId === f.assignee);
  const posts = useMemo(() => data.posts.filter(matches), [data.posts, f]);
  const scheduled = posts.filter((p) => p.date);
  const ideas = posts.filter((p) => !p.date);
  const byDay = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of scheduled) {
      const k = p.date!.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => (a.date! < b.date! ? -1 : 1));
    return m;
  }, [scheduled]);

  const step = (dir: 1 | -1) => {
    const a = toDate(anchor);
    const next = view === 'month' ? addMonths(a, dir) : view === 'week' ? new Date(a.getTime() + dir * 7 * 864e5) : addMonths(a, dir);
    setParam({ d: iso(next) });
  };

  const label =
    view === 'week'
      ? `${format(startOfWeek(toDate(anchor), { weekStartsOn: ws.weekStartsOn }), 'd MMM')} – ${format(endOfWeek(toDate(anchor), { weekStartsOn: ws.weekStartsOn }), 'd MMM yyyy')}`
      : format(toDate(anchor), 'MMMM yyyy');

  const onDropDay = (e: DragEvent, day: string) => {
    e.preventDefault();
    const p = data.posts.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (!p) return;
    const time = p.date ? p.date.slice(11, 16) || '12:00' : '12:00';
    actions.movePost(p, `${day}T${time}`, p.status === 'idea' ? 'draft' : undefined);
  };
  const onDropIdeas = (e: DragEvent) => {
    e.preventDefault();
    const p = data.posts.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (p && p.status !== 'published') actions.movePost(p, null, 'idea');
  };
  const onDropStatus = (e: DragEvent, status: PostStatus) => {
    e.preventDefault();
    const p = data.posts.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (p && p.status !== status) actions.setPostStatus(p, status);
  };

  const open = (p: Post) => setParam({ post: p.id });
  const create = (date: string | null) =>
    setDraftNew(
      blankPost(ws.id, date, {
        // Prefill from the filters; otherwise the platform is chosen in the form (the preview shows X until then).
        platform: (f.platform as PostDraft['platform']) || (ws.platforms.length === 1 ? ws.platforms[0] : ''),
        pillarId: f.pillar,
        assigneeId: null,
        campaignId: f.campaign && f.campaign !== 'none' ? f.campaign : null,
      }),
    );
  const canCreate = canEditPost(role, ws.settings, null);

  const chip = (p: Post, compact = true, thumb = false) => (
    <PostChip key={p.id} post={p} compact={compact} thumb={thumb} draggable={canDrag && p.status !== 'published'} onOpen={() => open(p)} />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendar"
        subtitle="Plan, review and schedule posts. Drag to reschedule."
        actions={
          <>
            <Button icon={<Lightbulb size={15} />} onClick={() => setShowIdeas((s) => !s)} aria-pressed={showIdeas}>
              Ideas ({ideas.length})
            </Button>
            {canCreate && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => create(`${today}T12:00`)}>
                New post
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Calendar view"
          value={view}
          onChange={(v) => setParam({ view: v })}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
          ]}
        />
        {(view === 'month' || view === 'week' || view === 'list') && (
          <div className="flex flex-wrap items-center gap-1">
            <PeriodStepper label={label} size="month" onPrev={() => step(-1)} onNext={() => step(1)} />
            <Button size="sm" variant="ghost" onClick={() => setParam({ d: null })}>
              Today
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Calendar filters">
        <FilterSelect label="Platform" value={f.platform} onChange={(v) => setF({ ...f, platform: v })} options={ws.platforms.map((p) => [p, PLATFORM_LABEL[p]])} />
        <FilterSelect label="Pillar" value={f.pillar} onChange={(v) => setF({ ...f, pillar: v })} options={ws.pillars.map((p) => [p.id, p.name])} />
        <FilterSelect label="Campaign" value={f.campaign} onChange={(v) => setF({ ...f, campaign: v })} options={[...data.campaigns.map((c) => [c.id, c.name] as [string, string]), ['none', 'No campaign']]} />
        <FilterSelect label="Status" plural="statuses" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUSES.map((s) => [s, STATUS_LABEL[s]])} />
        <FilterSelect label="Assignee" value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} options={ws.members.map((m) => [m.id, m.name])} />
        <Legend />
      </div>

      <div className={cx('grid gap-4', showIdeas && view !== 'board' ? 'lg:grid-cols-[minmax(0,1fr)_260px]' : 'grid-cols-1')}>
        <div className="min-w-0">
          {view === 'month' && <MonthGrid anchor={anchor} byDay={byDay} today={today} weekStartsOn={ws.weekStartsOn} chip={chip} onDrop={onDropDay} onAdd={canCreate ? (day) => create(`${day}T12:00`) : null} onMore={(day) => setParam({ view: 'week', d: day })} />}
          {view === 'week' && <WeekGrid anchor={anchor} byDay={byDay} today={today} weekStartsOn={ws.weekStartsOn} chip={chip} onDrop={onDropDay} onAdd={canCreate ? (day) => create(`${day}T12:00`) : null} />}
          {view === 'list' && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <DataTable<Post>
                rows={scheduled.filter((p) => p.date!.slice(0, 7) === anchor.slice(0, 7))}
                rowKey={(p) => p.id}
                initialSort={{ key: 'date', dir: 'asc' }}
                onRow={open}
                empty="No posts this month"
                cols={[
                  { key: 'date', label: 'When', render: (p) => <span className="whitespace-nowrap">{dateTimeLabel(p.date!)}</span>, sort: (p) => p.date },
                  { key: 'pl', label: 'Platform', render: (p) => <PlatformBadge platform={p.platform} /> },
                  { key: 'title', label: 'Post', render: (p) => <span className="block max-w-[320px] truncate">{p.title}</span>, sort: (p) => p.title },
                  { key: 'pillar', label: 'Pillar', render: (p) => <PillarTag id={p.pillarId} />, sort: (p) => p.pillarId },
                  { key: 'camp', label: 'Campaign', render: (p) => <CampaignTag id={p.campaignId} /> },
                  { key: 'status', label: 'Status', render: (p) => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>, sort: (p) => STATUSES.indexOf(p.status) },
                  { key: 'who', label: 'Assignee', render: (p) => <span className="text-muted">{memberName(p.assigneeId)}</span> },
                  { key: 'er', label: 'Rate', align: 'right', render: (p) => (p.metrics ? `${((p.metrics.engagements / Math.max(1, p.metrics.impressions)) * 100).toFixed(1)}%` : '—'), sort: (p) => (p.metrics ? p.metrics.engagements / Math.max(1, p.metrics.impressions) : null) },
                ]}
              />
            </div>
          )}
          {view === 'board' && (
            <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {STATUSES.map((s) => {
                const list = posts.filter((p) => p.status === s && (s !== 'published' || (p.date && p.date.slice(0, 10) >= addDaysIso(today, -7)))).sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1));
                return (
                  <section key={s} onDragOver={(e) => canDrag && e.preventDefault()} onDrop={(e) => onDropStatus(e, s)} className="flex min-h-[300px] flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2">
                    <header className="flex items-center justify-between px-1 pt-1">
                      <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>
                      <span className="text-[12px] text-muted">
                        {list.length}
                        {s === 'published' ? ' this week' : ''}
                      </span>
                    </header>
                    {list.slice(0, 40).map((p) => chip(p, false))}
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {showIdeas && view !== 'board' && (
          <aside onDragOver={(e) => canDrag && e.preventDefault()} onDrop={onDropIdeas} className="flex flex-col gap-2 self-start rounded-xl border border-line bg-surface p-3" aria-label="Ideas backlog">
            <header className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Ideas backlog</h2>
              {canCreate && (
                <IconButton label="Add idea" className="h-7 w-7" onClick={() => create(null)}>
                  <Plus size={15} />
                </IconButton>
              )}
            </header>
            <p className="text-[12px] text-muted">{canDrag ? 'Drag an idea onto a day to schedule it.' : 'Unscheduled ideas.'}</p>
            {ideas.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No ideas match.</p>}
            {ideas.map((p) => chip(p, false))}
          </aside>
        )}
      </div>

      {openPost && <PostDrawer post={openPost} isNew={false} onClose={() => setParam({ post: null })} />}
      {draftNew && <PostDrawer post={draftNew} isNew onClose={() => setDraftNew(null)} />}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, plural }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; plural?: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-auto max-w-[190px] text-[13px]">
      <option value="">All {plural ?? `${label.toLowerCase()}s`}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );
}

function Legend() {
  return (
    <span className="ml-auto hidden items-center gap-3 text-[12px] text-muted xl:flex">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded bg-[var(--series-1)]" /> Pillar color
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 rounded border border-dashed border-line-strong" /> Not approved yet
      </span>
    </span>
  );
}

function PillarTag({ id }: { id: string }) {
  const { ws } = useSession();
  const p = ws.pillars.find((x) => x.id === id);
  if (!p) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap">
      <Dot color={p.color} /> {p.name}
    </span>
  );
}

export function CampaignTag({ id }: { id: string | null }) {
  const { data } = useSession();
  const c = data.campaigns.find((x) => x.id === id);
  if (!c) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[12px] whitespace-nowrap text-soft">
      <Dot color={c.color} size={7} /> {c.name}
    </span>
  );
}

function PostChip({ post, compact, thumb, draggable, onOpen }: { post: Post; compact: boolean; thumb: boolean; draggable: boolean; onOpen: () => void }) {
  const { ws, data } = useSession();
  const pillar = ws.pillars.find((p) => p.id === post.pillarId);
  const campaign = data.campaigns.find((c) => c.id === post.campaignId);
  const tentative = post.status === 'idea' || post.status === 'draft' || post.status === 'review';
  const liveUrl = safeUrl(post.postUrl);
  const link = liveUrl ? (
    <a
      href={liveUrl}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`Open the live post “${post.title}” (opens a new tab)`}
      title="Open the live post"
      className="shrink-0 rounded text-muted hover:text-accent-strong"
    >
      <ExternalLink size={11} />
    </a>
  ) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      title={`${post.title} · ${STATUS_LABEL[post.status]}${campaign ? ` · ${campaign.name}` : ''}`}
      style={{ borderLeftColor: `var(--series-${pillar?.color ?? 8})` }}
      className={cx(
        'flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-l-[3px] bg-surface text-left hover:bg-surface-2',
        tentative ? 'border-dashed border-line-strong' : 'border-line',
        post.status === 'published' && 'opacity-75',
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {compact ? (
        // Month view: one line.
        <span className="flex min-w-0 items-center gap-1 text-[12px]">
          {post.date && <span className="tabular shrink-0 text-muted">{timeOf(post.date)}</span>}
          {post.platform !== ws.platforms[0] && <PlatformIcon platform={post.platform} size={11} className="text-muted" />}
          <span className="min-w-0 flex-1 truncate font-medium text-fg">{post.title}</span>
          {link}
          {campaign && <Dot color={campaign.color} size={7} />}
        </span>
      ) : (
        // Week view, board and ideas: image (week only), then time and platform, then the title on its own lines.
        <>
          {thumb && cardImage(post) && <img src={cardImage(post)!} alt="" loading="lazy" draggable={false} className="mb-1 aspect-video w-full rounded object-cover" />}
          {post.date && (
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
              <span className="tabular shrink-0">{timeOf(post.date)}</span>
              <PlatformIcon platform={post.platform} size={11} />
              <span className="flex-1" />
              {link}
              {campaign && <Dot color={campaign.color} size={7} />}
            </span>
          )}
          <span className="line-clamp-2 text-[12.5px] leading-snug font-medium break-words text-fg">{post.title}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted">
            {!post.date && <PlatformIcon platform={post.platform} size={11} />}
            {!post.date && link}
            <Badge tone={STATUS_TONE[post.status]} className="!text-[11px]">
              {STATUS_LABEL[post.status]}
            </Badge>
            {post.date && !thumb && <span>{format(toDate(post.date), 'EEE d MMM')}</span>}
            {campaign && <span className="max-w-full truncate">{campaign.name}</span>}
          </span>
        </>
      )}
    </div>
  );
}

interface GridProps {
  anchor: string;
  byDay: Map<string, Post[]>;
  today: string;
  weekStartsOn: 0 | 1;
  chip: (p: Post, compact?: boolean, thumb?: boolean) => ReactNode;
  onDrop: (e: DragEvent, day: string) => void;
  onAdd: ((day: string) => void) | null;
}

function weekdayNames(weekStartsOn: 0 | 1) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekStartsOn === 1 ? [...names.slice(1), names[0]] : names;
}

function MonthGrid({ anchor, byDay, today, weekStartsOn, chip, onDrop, onAdd, onMore }: GridProps & { onMore: (day: string) => void }) {
  const a = toDate(anchor);
  const start = iso(startOfWeek(startOfMonth(a), { weekStartsOn }));
  const end = iso(endOfWeek(endOfMonth(a), { weekStartsOn }));
  const days = eachDay({ type: 'custom', start, end });
  const month = anchor.slice(0, 7);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="grid min-w-[760px] grid-cols-7">
        {weekdayNames(weekStartsOn).map((n) => (
          <div key={n} className="border-b border-line px-2 py-1.5 text-[12px] font-medium text-muted">
            {n}
          </div>
        ))}
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month;
          return (
            <div
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, day)}
              className={cx('group flex min-h-[118px] flex-col gap-1 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-surface-2/60')}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    'tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px]',
                    day === today ? 'bg-accent font-semibold text-white' : inMonth ? 'text-soft' : 'text-muted',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {onAdd && (
                  <button type="button" aria-label={`Add post on ${day}`} onClick={() => onAdd(day)} className="invisible rounded p-0.5 text-muted group-hover:visible hover:bg-surface-2 hover:text-fg focus:visible">
                    <Plus size={14} />
                  </button>
                )}
              </div>
              {list.slice(0, 3).map((p) => chip(p))}
              {list.length > 3 && (
                <button type="button" onClick={() => onMore(day)} className="rounded px-1 text-left text-[12px] font-medium text-muted hover:text-fg">
                  +{list.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ anchor, byDay, today, weekStartsOn, chip, onDrop, onAdd }: GridProps) {
  const start = iso(startOfWeek(toDate(anchor), { weekStartsOn }));
  const days = eachDay({ type: 'custom', start, end: addDaysIso(start, 6) });
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="grid min-w-[700px] grid-cols-7">
        {days.map((day) => (
          <div key={day} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, day)} className="flex min-h-[420px] flex-col gap-1.5 border-r border-line p-2 last:border-r-0">
            <div className="flex items-center justify-between pb-1">
              <span className={cx('text-[12.5px] font-medium', day === today ? 'text-accent-strong' : 'text-soft')}>{format(toDate(day), 'EEE d')}</span>
              {onAdd && (
                <button type="button" aria-label={`Add post on ${day}`} onClick={() => onAdd(day)} className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg">
                  <Plus size={14} />
                </button>
              )}
            </div>
            {(byDay.get(day) ?? []).map((p) => chip(p, false, true))}
          </div>
        ))}
      </div>
    </div>
  );
}
