import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { DataTable } from '@/components/DataTable';
import { Badge, Button, Card, Input, PageHeader, PlatformBadge, Segmented, Select, Stars } from '@/components/ui';
import type { Partner, PartnerStage } from '@/data/types';
import { compact, money, num } from '@/lib/format';
import { partnerScore } from '@/lib/metrics';
import { DeliverablesTable } from './DeliverablesTable';
import { blankPartner, DEALS, PartnerForm, STAGE_TONE, STAGES, TYPES } from './PartnerForms';

export function dealLabel(p: Partner) {
  const r = p.deal.rate;
  switch (p.deal.model) {
    case 'flat':
      return r ? `${money(r)} flat` : 'Flat (tbd)';
    case 'cpm':
      return `${money(r, 2)} CPM`;
    case 'cpa':
      return `${money(r)} per member`;
    case 'revshare':
      return `${r}% rev-share`;
    case 'gifted':
      return 'Gifted';
  }
}

export function PartnersPage() {
  const { data, ws, can } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const [view, setView] = useState<'table' | 'pipeline' | 'deliverables'>('table');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState<Partner | null>(null);

  const rows = useMemo(
    () =>
      data.partners
        .filter((p) => (!type || p.type === type) && (!q || `${p.name} ${p.handle} ${p.niche}`.toLowerCase().includes(q.toLowerCase())))
        .map((p) => ({ p, s: partnerScore(data, p.id) })),
    [data, type, q],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Partners"
        subtitle="Creators, streamers, clippers, affiliates and partner communities: deals, deliverables and what they bring."
        actions={
          can('edit') && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(blankPartner(ws.id))}>
              Add partner
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Partners view"
          value={view}
          onChange={setView}
          options={[
            { value: 'table', label: 'Scorecard' },
            { value: 'pipeline', label: 'Pipeline' },
            { value: 'deliverables', label: 'Deliverables' },
          ]}
        />
        {view !== 'deliverables' && (
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-auto max-w-[180px] text-[13px]">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        )}
        {view !== 'deliverables' && (
        <span className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search partners" aria-label="Search partners" className="h-8 w-56 pl-8 text-[13px]" />
        </span>
        )}
      </div>

      {view === 'deliverables' ? (
        <Card subtitle="All partners’ deliverables: what’s booked, late, delivered or unpaid. Click a row to edit.">
          <DeliverablesTable />
        </Card>
      ) : view === 'table' ? (
        <Card subtitle="All-time results from delivered work. Click a row for the full profile.">
          <DataTable
            rows={rows}
            rowKey={(r) => r.p.id}
            onRow={(r) => navigate(`/partners/${r.p.id}`)}
            initialSort={{ key: 'members', dir: 'desc' }}
            cols={[
              {
                key: 'name',
                label: 'Partner',
                render: (r) => (
                  <span className="flex items-center gap-2">
                    <PlatformBadge platform={r.p.platform} />
                    <span className="min-w-0">
                      <b className="block truncate font-medium">{r.p.name}</b>
                      <span className="block truncate text-[12px] text-muted">{r.p.handle}</span>
                    </span>
                  </span>
                ),
                sort: (r) => r.p.name,
              },
              { key: 'type', label: 'Type', render: (r) => <Badge>{r.p.type}</Badge>, sort: (r) => r.p.type },
              { key: 'stage', label: 'Stage', render: (r) => <Badge tone={STAGE_TONE[r.p.stage]}>{r.p.stage}</Badge>, sort: (r) => STAGES.indexOf(r.p.stage) },
              { key: 'aud', label: 'Audience', align: 'right', render: (r) => compact(r.p.audience), sort: (r) => r.p.audience },
              { key: 'deal', label: 'Deal', render: (r) => <span className="whitespace-nowrap text-soft">{dealLabel(r.p)}</span> },
              { key: 'views', label: 'Views', align: 'right', render: (r) => (r.s ? compact(r.s.views) : '—'), sort: (r) => r.s?.views ?? null },
              { key: 'members', label: 'New members', align: 'right', render: (r) => (r.s ? num(r.s.newMembers) : '—'), sort: (r) => r.s?.newMembers ?? null },
              { key: 'ret', label: 'Retention', align: 'right', render: (r) => (r.s?.retention == null ? '—' : `${Math.round(r.s.retention)}%`), sort: (r) => r.s?.retention ?? null },
              { key: 'cpm', label: 'Cost / member', align: 'right', render: (r) => (r.s?.costPerMember == null ? '—' : money(r.s.costPerMember, 2)), sort: (r) => r.s?.costPerMember ?? null },
              { key: 'rating', label: 'Rating', render: (r) => (r.p.rating ? <Stars value={r.p.rating} /> : <span className="text-muted">—</span>), sort: (r) => r.p.rating },
            ]}
          />
        </Card>
      ) : (
        <div className="grid auto-cols-[minmax(210px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage: PartnerStage) => {
            const list = rows.filter((r) => r.p.stage === stage);
            return (
              <section
                key={stage}
                onDragOver={(e) => can('edit') && e.preventDefault()}
                onDrop={(e) => {
                  const p = data.partners.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                  if (p && p.stage !== stage) actions.savePartner({ ...p, stage }, false);
                }}
                className="flex min-h-[260px] flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2"
              >
                <header className="flex items-center justify-between px-1 pt-1">
                  <Badge tone={STAGE_TONE[stage]}>{stage}</Badge>
                  <span className="text-[12px] text-muted">{list.length}</span>
                </header>
                {list.map(({ p, s }) => (
                  <Link
                    key={p.id}
                    to={`/partners/${p.id}`}
                    draggable={can('edit')}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                    className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-2.5 hover:border-line-strong"
                  >
                    <span className="flex items-center gap-2">
                      <PlatformBadge platform={p.platform} />
                      <b className="truncate text-[13.5px] font-medium">{p.name}</b>
                    </span>
                    <span className="text-[12px] text-muted">
                      {p.type} · {compact(p.audience)} audience
                    </span>
                    <span className="text-[12px] text-soft">{DEALS.find((d) => d.value === p.deal.model)?.label}</span>
                    {s && <span className="text-[12px] text-muted">{num(s.newMembers)} members brought</span>}
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {adding && <PartnerForm partner={adding} isNew onClose={() => setAdding(null)} />}
    </div>
  );
}
