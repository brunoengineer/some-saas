import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Trash2 } from 'lucide-react';
import { nowStamp, useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import { DiscussionButton } from '@/components/Comments';
import { DataTable } from '@/components/DataTable';
import { Badge, Button, Card, Dot, EmptyState, PageHeader, PlatformBadge, ProgressBar, Select } from '@/components/ui';
import type { Campaign, Deliverable, Post } from '@/data/types';
import { sourceLabel, campaignAutoState, campaignGoals, campaignPeriod, campaignSpend, campaignState, rateOf } from '@/lib/metrics';
import { compact, dateTimeLabel, formatValue, longDate, money, num, shortDate } from '@/lib/format';
import { createReport } from '@/lib/report';
import { STATUS_LABEL, STATUS_TONE } from '../calendar/postMeta';
import { CampaignForm } from './CampaignForm';
import { STATE_LABEL, STATE_TONE } from './CampaignsPage';

export function CampaignDetail() {
  const { id } = useParams();
  const { data, today, can, member } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const name = useMemberName();
  const [editing, setEditing] = useState(false);
  const c = data.campaigns.find((x) => x.id === id);

  if (!c) return <EmptyState title="Campaign not found" action={<Link to="/campaigns" className="text-accent-strong">Back to campaigns</Link>} />;

  const state = campaignState(c, today);
  const posts = data.posts.filter((p) => p.campaignId === c.id).sort((a, b) => ((a.date ?? '9') < (b.date ?? '9') ? -1 : 1));
  const published = posts.filter((p) => p.status === 'published' && p.metrics);
  const deliverables = data.deliverables.filter((d) => d.campaignId === c.id);
  const spend = campaignSpend(data, c.id);
  const rate = rateOf(published);
  const period = campaignPeriod(c, today);
  const partnerName = (pid: string) => data.partners.find((p) => p.id === pid)?.name ?? 'Unknown';

  const generate = () => {
    if (!period) return;
    const r = createReport(data, { type: 'campaign', period, campaignId: c.id, trigger: 'manual', createdBy: member.id, now: nowStamp() });
    actions.saveReport(r, 'generated');
    navigate(`/reports/${r.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/campaigns" className="inline-flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Campaigns
      </Link>
      <PageHeader
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Dot color={c.color} /> {longDate(c.start)} – {longDate(c.end)} ·{' '}
            {can('edit') ? (
              <Select
                aria-label="Campaign status"
                value={c.status ?? ''}
                onChange={(e) => actions.saveCampaign({ ...c, status: (e.target.value || null) as Campaign['status'] }, false)}
                className="h-7 w-[190px] text-[12.5px]"
              >
                <option value="">Automatic ({STATE_LABEL[campaignAutoState(c, today)]})</option>
                <option value="planned">Planned (set by hand)</option>
                <option value="live">Live (set by hand)</option>
                <option value="done">Done (set by hand)</option>
              </Select>
            ) : (
              <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
            )}{' '}
            · Owner: {name(c.ownerId)}
          </span>
        }
        actions={
          <>
            <DiscussionButton targetType="campaign" targetId={c.id} label={c.name} link={`/campaigns/${c.id}`} title={c.name} />
            {period && can('report.generate') && (
              <Button icon={<FileText size={15} />} onClick={generate}>
                Campaign report
              </Button>
            )}
            {can('edit') && (
              <Button variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Theme and strategy">
          <p className="text-[15px] font-medium text-fg">{c.theme || 'No theme yet'}</p>
          <p className="mt-2 text-[13.5px] whitespace-pre-wrap text-soft">{c.strategy || 'No strategy written yet.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {c.channels.map((p) => (
              <PlatformBadge key={p} platform={p} full />
            ))}
          </div>
        </Card>
        <Card title="Goals" subtitle={period ? `Measured ${shortDate(period.start)} – ${shortDate(period.end)}` : 'Starts on ' + longDate(c.start)}>
          {c.goals.length === 0 && <p className="text-[13px] text-muted">No goals set.</p>}
          <div className="flex flex-col gap-3">
            {campaignGoals(data, c, today).map((g) =>
              g.kpi ? (
                <div key={g.goal.kpiId} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-2 text-[13.5px]">
                    <span className="font-medium">{g.kpi.name}</span>
                    <span className="tabular">
                      <b>{formatValue(g.kpi.unit, g.value)}</b> <span className="text-muted">of {formatValue(g.kpi.unit, g.goal.target)}</span>
                    </span>
                  </span>
                  <ProgressBar value={g.progress} label={`${g.kpi.name} progress`} tone={g.progress >= 1 ? 'good' : 'accent'} />
                  <span className="text-[12px] text-muted">
                    {sourceLabel(g.kpi, data.kpis)}
                    {!g.scoped && ' · account-wide during the campaign'}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Posts" value={`${published.length} / ${posts.length}`} hint="published / planned" />
        <Stat label="Engagement rate" value={rate === null ? '—' : `${rate.toFixed(1)}%`} hint="campaign posts" />
        <Stat label="Partner deliverables" value={`${deliverables.filter((d) => d.delivered).length} / ${deliverables.length}`} hint="delivered / booked" />
        <Stat label="Budget used" value={money(spend)} hint={`of ${money(c.budget)}`} progress={c.budget ? spend / c.budget : 0} />
      </div>

      <Card title="Posts in this campaign">
        <DataTable<Post>
          rows={posts}
          rowKey={(p) => p.id}
          limit={10}
          onRow={(p) => navigate(`/calendar?post=${p.id}${p.date ? `&d=${p.date.slice(0, 10)}` : ''}`)}
          empty="No posts tagged yet. Pick this campaign in a post’s details."
          cols={[
            { key: 'date', label: 'When', render: (p) => <span className="whitespace-nowrap">{p.date ? dateTimeLabel(p.date) : 'Idea'}</span>, sort: (p) => p.date },
            { key: 'pl', label: '', render: (p) => <PlatformBadge platform={p.platform} /> },
            { key: 'title', label: 'Post', render: (p) => <span className="block max-w-[360px] truncate">{p.title}</span> },
            { key: 'status', label: 'Status', render: (p) => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge> },
            { key: 'imp', label: 'Impr.', align: 'right', render: (p) => (p.metrics ? compact(p.metrics.impressions) : '—'), sort: (p) => p.metrics?.impressions ?? null },
            { key: 'rate', label: 'Rate', align: 'right', render: (p) => (p.metrics ? `${((p.metrics.engagements / Math.max(1, p.metrics.impressions)) * 100).toFixed(1)}%` : '—'), sort: (p) => (p.metrics ? p.metrics.engagements / Math.max(1, p.metrics.impressions) : null) },
          ]}
        />
      </Card>

      <Card title="Partner deliverables">
        <DataTable<Deliverable>
          rows={deliverables}
          rowKey={(d) => d.id}
          onRow={(d) => navigate(`/partners/${d.partnerId}`)}
          empty="No partner deliverables tagged."
          cols={[
            { key: 'who', label: 'Partner', render: (d) => partnerName(d.partnerId), sort: (d) => partnerName(d.partnerId) },
            { key: 'what', label: 'Deliverable', render: (d) => <span className="block max-w-[220px] truncate">{d.title}</span> },
            { key: 'due', label: 'Date', render: (d) => shortDate(d.delivered ?? d.due), sort: (d) => d.delivered ?? d.due },
            { key: 'members', label: 'Members', align: 'right', render: (d) => (d.results ? num(d.results.newMembers) : '—') },
            { key: 'cost', label: 'Cost', align: 'right', render: (d) => money(d.cost), sort: (d) => d.cost },
          ]}
        />
      </Card>

      {can('edit') && (
        <div>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={() => {
              if (window.confirm(`Delete the campaign “${c.name}”? Posts stay, untagged.`)) {
                actions.deleteCampaign(c);
                navigate('/campaigns');
              }
            }}
          >
            Delete campaign
          </Button>
        </div>
      )}
      {editing && <CampaignForm campaign={c} isNew={false} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Stat({ label, value, hint, progress }: { label: string; value: string; hint: string; progress?: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="tabular text-[22px] font-semibold">{value}</span>
      <span className="text-[12px] text-muted">{hint}</span>
      {progress !== undefined && <ProgressBar value={progress} label={`${label}`} tone={progress > 1 ? 'critical' : 'accent'} />}
    </div>
  );
}
