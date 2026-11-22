import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { usePeriodFilters } from '@/app/useFilters';
import { CategoryBars, ChartCard, Columns, MixBars, TrendChart } from '@/components/charts';
import { DataTable } from '@/components/DataTable';
import { KpiTile } from '@/components/KpiTile';
import { Badge, Card, Dot, PageHeader, PlatformBadge, ProgressBar, StatusPill } from '@/components/ui';
import type { PartnerRow, Post } from '@/data/types';
import { compact, dateTimeLabel, formatValue, money, num, shortDate, targetLabel, timeOf } from '@/lib/format';
import {
  campaignGoals,
  campaignState,
  followerSeries,
  isTracked,
  joinsBySource,
  kpiValue,
  onDashboard,
  pacing,
  partnerRows,
  pillarBreakdown,
  publishedIn,
  statusOf,
  targetAt,
} from '@/lib/metrics';
import { addDaysIso, comparedLabel, periodLabel, previousPeriod } from '@/lib/period';
import { PeriodBar } from './PeriodBar';

export function DashboardPage() {
  const { data, ws } = useSession();
  const { period, filters, compare, today } = usePeriodFilters();
  const navigate = useNavigate();
  const prev = useMemo(() => previousPeriod(period, ws.weekStartsOn), [period, ws.weekStartsOn]);

  const tiles = useMemo(
    () =>
      data.kpis
        .filter((k) => onDashboard(k) && (!filters.platform || !k.platform || k.platform === filters.platform))
        .sort((a, b) => a.order - b.order)
        .map((k) => {
          const cur = kpiValue(k, data, period, filters);
          const before = compare ? kpiValue(k, data, prev, filters).value : null;
          const target = targetAt(k, period.end);
          return { k, value: cur.value, prev: before, target, status: statusOf(k, cur.value, before, target) };
        }),
    [data, period, prev, filters, compare],
  );

  const primary = ws.platforms.find((pl) => data.stats.some((s) => s.platform === pl && s.followers !== null)) ?? null;
  const followers = useMemo(() => followerSeries(data, period, filters.platform ?? primary), [data, period, filters.platform, primary]);
  const pillars = useMemo(() => pillarBreakdown(data, period, filters), [data, period, filters]);
  const joins = useMemo(() => joinsBySource(data, period), [data, period]);
  const posts = useMemo(() => publishedIn(data, period, filters), [data, period, filters]);
  const partners = useMemo(() => partnerRows(data, period, filters), [data, period, filters]);
  const upcoming = useMemo(
    () =>
      data.posts
        .filter((p) => p.date && p.status !== 'published' && p.date.slice(0, 10) >= today && p.date.slice(0, 10) <= addDaysIso(today, 7))
        .filter((p) => !filters.platform || p.platform === filters.platform)
        .sort((a, b) => (a.date! < b.date! ? -1 : 1))
        .slice(0, 8),
    [data.posts, today, filters],
  );
  const headline = useMemo(
    () =>
      data.kpis
        .filter((k) => isTracked(k) && (k.group === 'headline' || k.targets.some((t) => t.by)))
        .map((k) => {
          const v = kpiValue(k, data, { type: 'custom', start: '1900-01-01', end: today }).value;
          const t = targetAt(k, today) ?? k.targets.find((x) => x.from > today) ?? null;
          return { k, v, t, pace: pacing(k, data, today), status: statusOf(k, v, null, targetAt(k, today)) };
        })
        .filter((x) => x.t),
    [data, today],
  );
  const live = data.campaigns.filter((c) => campaignState(c, today) === 'live');
  const pillarName = (id: string) => ws.pillars.find((p) => p.id === id);
  const followerPlatform = filters.platform ?? primary;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Dashboard" subtitle={`${periodLabel(period)}${compare ? ` · ${comparedLabel[period.type]}` : ''}`} />
      <PeriodBar />

      {tiles.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => (
            <KpiTile
              key={t.k.id}
              name={t.k.name}
              question={t.k.question}
              unit={t.k.unit}
              direction={t.k.direction}
              platform={t.k.platform}
              value={t.value}
              prev={t.prev}
              target={t.target}
              status={t.status}
              signed={t.k.calc === 'netFollowers'}
              compareLabel={compare ? comparedLabel[period.type] : undefined}
            />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-[13px] text-muted">No KPIs are shown on the Dashboard for this platform. Choose them in KPIs & Goals → Definitions.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          title={followerPlatform ? `${followerPlatform === 'discord' ? 'Members' : 'Followers'}, day by day` : 'Followers'}
          subtitle="With milestones marked"
          table={{ head: ['Date', 'Total'], rows: followers.map((f) => [f.date, num(f.value)]) }}
        >
          <TrendChart data={followers} annotations={ws.annotations} name="Followers" />
        </ChartCard>
        <ChartCard
          title="Engagement rate by pillar"
          subtitle="Engagements ÷ impressions, published posts"
          table={{ head: ['Pillar', 'Posts', 'Rate'], rows: pillars.map((p) => [p.name, p.posts, p.rate === null ? '—' : `${p.rate.toFixed(1)}%`]) }}
        >
          <CategoryBars
            valueName="Engagement rate"
            data={pillars.map((p) => ({ name: p.name, value: p.rate, color: p.color, note: `${p.posts} posts` }))}
            format={(v) => `${v.toFixed(1)}%`}
            height={220}
          />
        </ChartCard>
        {joins.length > 0 && (
          <ChartCard title="New members by source" subtitle="From tracked invite links · account-wide" table={{ head: ['Source', 'Members'], rows: joins.map((j) => [j.source, j.value]) }}>
            <Columns data={joins.map((j) => ({ label: j.source, value: j.value }))} valueName="New members" />
          </ChartCard>
        )}
        <Card title="Content mix vs plan" subtitle={`${posts.length} published posts · share by pillar`}>
          <MixBars data={pillars} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Top posts" subtitle="Sort by any column. Click to open." pad>
          <DataTable<Post>
            rows={posts}
            rowKey={(p) => p.id}
            initialSort={{ key: 'eng', dir: 'desc' }}
            limit={8}
            onRow={(p) => navigate(`/calendar?post=${p.id}&d=${p.date!.slice(0, 10)}`)}
            empty="No published posts in this period"
            cols={[
              {
                key: 'title',
                label: 'Post',
                render: (p) => (
                  <span className="flex min-w-0 items-center gap-2">
                    <Dot color={pillarName(p.pillarId)?.color ?? 8} />
                    <span className="block max-w-[280px] truncate">{p.title}</span>
                  </span>
                ),
              },
              { key: 'date', label: 'Date', render: (p) => <span className="whitespace-nowrap text-muted">{dateTimeLabel(p.date!)}</span>, sort: (p) => p.date },
              { key: 'imp', label: 'Impr.', align: 'right', render: (p) => compact(p.metrics!.impressions), sort: (p) => p.metrics!.impressions },
              { key: 'eng', label: 'Eng.', align: 'right', render: (p) => num(p.metrics!.engagements), sort: (p) => p.metrics!.engagements },
              {
                key: 'rate',
                label: 'Rate',
                align: 'right',
                render: (p) => `${((p.metrics!.engagements / Math.max(1, p.metrics!.impressions)) * 100).toFixed(1)}%`,
                sort: (p) => p.metrics!.engagements / Math.max(1, p.metrics!.impressions),
              },
            ]}
          />
        </Card>
        <Card title="Next 7 days" subtitle="Planned posts" action={<Link to="/calendar" className="text-[13px] font-medium text-accent-strong hover:underline">Open calendar</Link>}>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing planned.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <Link to={`/calendar?post=${p.id}&d=${p.date!.slice(0, 10)}`} className="flex items-center gap-2.5 py-2 hover:bg-surface-2">
                    <span className="tabular w-[84px] shrink-0 text-[12.5px] text-muted">
                      {dateTimeLabel(p.date!).split(' · ')[0]} <b className="font-medium text-soft">{timeOf(p.date)}</b>
                    </span>
                    <PlatformBadge platform={p.platform} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.title}</span>
                    <Badge tone={p.status === 'scheduled' || p.status === 'approved' ? 'good' : p.status === 'review' ? 'warning' : 'neutral'}>{p.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Creators and partners" subtitle="Deliverables in this period · sorted by cost per new member">
        <DataTable<PartnerRow>
          rows={partners}
          rowKey={(r) => r.id}
          initialSort={{ key: 'cpm', dir: 'asc' }}
          onRow={(r) => navigate(`/partners/${r.id}`)}
          empty="No partner deliverables in this period"
          cols={[
            { key: 'name', label: 'Partner', render: (r) => (<span><b className="font-medium">{r.name}</b> <span className="text-muted">{r.handle}</span></span>), sort: (r) => r.name },
            { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
            { key: 'del', label: 'Deliverables', align: 'right', render: (r) => r.deliverables, sort: (r) => r.deliverables },
            { key: 'views', label: 'Views', align: 'right', render: (r) => compact(r.views), sort: (r) => r.views },
            { key: 'members', label: 'New members', align: 'right', render: (r) => num(r.newMembers), sort: (r) => r.newMembers },
            { key: 'ret', label: '7-day retention', align: 'right', render: (r) => (r.retention === null ? '—' : `${Math.round(r.retention)}%`), sort: (r) => r.retention },
            { key: 'cost', label: 'Cost', align: 'right', render: (r) => money(r.cost), sort: (r) => r.cost },
            { key: 'cpm', label: 'Cost / member', align: 'right', render: (r) => (r.costPerMember === null ? '—' : money(r.costPerMember, 2)), sort: (r) => r.costPerMember },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card title="Live campaigns" action={<Link to="/campaigns" className="text-[13px] font-medium text-accent-strong hover:underline">All campaigns</Link>}>
          {live.length === 0 && <p className="text-[13px] text-muted">No live campaigns.</p>}
          <div className="flex flex-col gap-4">
            {live.map((c) => (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="flex flex-col gap-2 rounded-lg p-1 hover:bg-surface-2">
                <span className="flex items-center gap-2 font-medium">
                  <Dot color={c.color} /> {c.name}
                  <span className="text-[12px] font-normal text-muted">until {shortDate(c.end)}</span>
                </span>
                {campaignGoals(data, c, today).map((g) =>
                  g.kpi ? (
                    <span key={g.goal.kpiId} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-[12.5px]">
                      <span className="truncate text-soft">
                        {g.kpi.name}: <b className="tabular font-semibold text-fg">{formatValue(g.kpi.unit, g.value)}</b> of {formatValue(g.kpi.unit, g.goal.target)}
                      </span>
                      <ProgressBar value={g.progress} label={`${g.kpi.name} progress`} />
                    </span>
                  ) : null,
                )}
              </Link>
            ))}
          </div>
        </Card>
        <Card title="Goals" subtitle="Headline KPIs and deadlines">
          {headline.length === 0 && <p className="text-[13px] text-muted">No headline goals yet.</p>}
          <ul className="flex flex-col divide-y divide-line">
            {headline.map(({ k, v, t, pace, status }) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{k.name}</span>
                  <span className="block text-[12px] text-muted">
                    {targetLabel(k.unit, t)}
                    {t?.from && t.from > today ? ` · starts ${t.from}` : ''}
                    {pace ? ` · on pace for ${formatValue(k.unit, pace.projected)}` : ''}
                  </span>
                </span>
                <span className="tabular text-[15px] font-semibold">{formatValue(k.unit, v)}</span>
                <StatusPill status={pace ? (pace.onTrack ? 'good' : 'critical') : status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
