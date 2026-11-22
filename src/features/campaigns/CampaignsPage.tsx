import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session';
import { Badge, Button, Dot, EmptyState, PageHeader, PlatformBadge, ProgressBar, Segmented } from '@/components/ui';
import type { Campaign } from '@/data/types';
import { formatValue, money, shortDate } from '@/lib/format';
import { campaignGoals, campaignSpend, campaignState, type CampaignState } from '@/lib/metrics';
import { blankCampaign, CampaignForm } from './CampaignForm';

export const STATE_TONE: Record<CampaignState, 'good' | 'info' | 'neutral'> = { live: 'good', planned: 'info', done: 'neutral' };
export const STATE_LABEL: Record<CampaignState, string> = { live: 'Live', planned: 'Planned', done: 'Done' };

export function CampaignsPage() {
  const { data, ws, today, can } = useSession();
  const [filter, setFilter] = useState<'all' | CampaignState>('all');
  const [editing, setEditing] = useState<Campaign | null>(null);

  const list = [...data.campaigns]
    .filter((c) => filter === 'all' || campaignState(c, today) === filter)
    .sort((a, b) => {
      const order = { live: 0, planned: 1, done: 2 };
      return order[campaignState(a, today)] - order[campaignState(b, today)] || (a.start < b.start ? -1 : 1);
    });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Campaigns"
        subtitle="Theme, strategy and goals. Tag posts and partner deliverables to a campaign to track it."
        actions={
          can('edit') && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing(blankCampaign(ws.id, today))}>
              New campaign
            </Button>
          )
        }
      />
      <Segmented
        label="Campaign state"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'live', label: 'Live' },
          { value: 'planned', label: 'Planned' },
          { value: 'done', label: 'Done' },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title="No campaigns here" body="Create one to group posts, partners and goals around a theme." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => {
            const state = campaignState(c, today);
            const posts = data.posts.filter((p) => p.campaignId === c.id);
            const spend = campaignSpend(data, c.id);
            return (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[15.5px] font-semibold">
                      <Dot color={c.color} size={10} /> {c.name}
                    </h2>
                    <p className="text-[12.5px] text-muted">
                      {shortDate(c.start)} – {shortDate(c.end)} {c.end.slice(0, 4)}
                    </p>
                  </div>
                  <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                </div>
                <p className="line-clamp-2 text-[13.5px] text-soft">{c.theme}</p>
                <div className="flex flex-col gap-2">
                  {campaignGoals(data, c, today).map((g) =>
                    g.kpi ? (
                      <div key={g.goal.kpiId} className="flex flex-col gap-1">
                        <span className="flex justify-between gap-2 text-[12.5px]">
                          <span className="truncate text-soft">{g.kpi.name}</span>
                          <span className="tabular text-muted">
                            <b className="font-semibold text-fg">{formatValue(g.kpi.unit, g.value)}</b> / {formatValue(g.kpi.unit, g.goal.target)}
                          </span>
                        </span>
                        <ProgressBar value={g.progress} label={`${g.kpi.name} progress`} tone={g.progress >= 1 ? 'good' : 'accent'} />
                      </div>
                    ) : null,
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[12.5px] text-muted">
                  <span>{posts.length} posts</span>
                  <span>
                    {money(spend)} of {money(c.budget)}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {c.channels.map((p) => (
                      <PlatformBadge key={p} platform={p} />
                    ))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {editing && <CampaignForm campaign={editing} isNew onClose={() => setEditing(null)} />}
    </div>
  );
}
