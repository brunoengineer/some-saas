import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { DataTable } from '@/components/DataTable';
import { PlatformIcon } from '@/components/PlatformIcon';
import { Badge, Button, IconButton, Segmented, Select } from '@/components/ui';
import type { Deliverable, Platform } from '@/data/types';
import { compact, money, num, PLATFORM_LABEL, safeUrl, shortDate } from '@/lib/format';
import { CampaignTag } from '../calendar/CalendarPage';
import { blankDeliverable, DeliverableForm } from './PartnerForms';

type StateFilter = 'all' | 'booked' | 'late' | 'delivered' | 'unpaid';

export function deliverableState(d: Deliverable, today: string): 'delivered' | 'late' | 'booked' {
  if (d.delivered) return 'delivered';
  return d.due < today ? 'late' : 'booked';
}

/**
 * Every deliverable with its results and payment, filterable, each row editable.
 * Used on a partner's page (one partner) and on Partners → Deliverables (all).
 */
export function DeliverablesTable({ partnerId }: { partnerId?: string }) {
  const { data, ws, today, can } = useSession();
  const actions = useActions();
  const [state, setState] = useState<StateFilter>('all');
  const [campaign, setCampaign] = useState('');
  const [partner, setPartner] = useState('');
  const [editing, setEditing] = useState<{ d: Deliverable; isNew: boolean } | null>(null);
  const editable = can('edit');
  const showPartner = !partnerId;
  const partnerName = (id: string) => data.partners.find((p) => p.id === id)?.name ?? 'Unknown';
  const platformOf = (d: Deliverable): Platform | null => d.platform ?? data.partners.find((p) => p.id === d.partnerId)?.platform ?? null;

  const rows = useMemo(
    () =>
      data.deliverables.filter(
        (d) =>
          (!partnerId || d.partnerId === partnerId) &&
          (!partner || d.partnerId === partner) &&
          (!campaign || (campaign === 'none' ? !d.campaignId : d.campaignId === campaign)) &&
          (state === 'all' || (state === 'unpaid' ? !!d.delivered && !d.paid && d.cost > 0 : deliverableState(d, today) === state)),
      ),
    [data.deliverables, partnerId, partner, campaign, state, today],
  );
  const totals = rows.reduce(
    (t, d) => ({
      views: t.views + (d.results?.views ?? 0),
      members: t.members + (d.results?.newMembers ?? 0),
      cost: t.cost + d.cost,
      unpaid: t.unpaid + (d.delivered && !d.paid ? d.cost : 0),
    }),
    { views: 0, members: 0, cost: 0, unpaid: 0 },
  );
  const count = (f: StateFilter) =>
    data.deliverables.filter((d) => (!partnerId || d.partnerId === partnerId) && (f === 'unpaid' ? !!d.delivered && !d.paid && d.cost > 0 : deliverableState(d, today) === f)).length;

  const add = () => {
    const p = partnerId ? data.partners.find((x) => x.id === partnerId) : null;
    setEditing({ d: blankDeliverable(ws.id, partnerId ?? '', today, p?.deal.model === 'flat' ? p.deal.rate : 0), isNew: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          label="Deliverable status"
          value={state}
          onChange={setState}
          options={[
            { value: 'all', label: 'All' },
            { value: 'booked', label: `Booked (${count('booked')})` },
            { value: 'late', label: `Late (${count('late')})` },
            { value: 'delivered', label: `Delivered (${count('delivered')})` },
            { value: 'unpaid', label: `Unpaid (${count('unpaid')})` },
          ]}
        />
        {showPartner && (
          <Select aria-label="Partner" value={partner} onChange={(e) => setPartner(e.target.value)} className="h-8 w-auto max-w-[200px] text-[13px]">
            <option value="">All partners</option>
            {data.partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} className="h-8 w-auto max-w-[200px] text-[13px]">
          <option value="">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">No campaign</option>
        </Select>
        {editable && (
          <Button size="sm" variant="primary" className="ml-auto" icon={<Plus size={14} />} onClick={add}>
            Add deliverable
          </Button>
        )}
      </div>

      <DataTable<Deliverable>
        rows={rows}
        rowKey={(d) => d.id}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRow={editable ? (d) => setEditing({ d, isNew: false }) : undefined}
        empty={state === 'all' ? 'No deliverables yet' : 'Nothing with this status'}
        cols={[
          ...(showPartner
            ? [
                {
                  key: 'partner',
                  label: 'Partner',
                  render: (d: Deliverable) => (
                    <Link to={`/partners/${d.partnerId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                      {partnerName(d.partnerId)}
                    </Link>
                  ),
                  sort: (d: Deliverable) => partnerName(d.partnerId),
                },
              ]
            : []),
          {
            key: 'title',
            label: 'Deliverable',
            render: (d) => (
              <span className="flex max-w-[280px] items-start gap-1.5">
                <span className="min-w-0">
                  <span className="block truncate">{d.title}</span>
                  <span className="text-[12px] text-muted">
                    {d.kind}
                    {d.postId ? ' · from a calendar post' : ''}
                  </span>
                </span>
                {safeUrl(d.url) && (
                  <a
                    href={safeUrl(d.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Open ${d.title} (opens a new tab)`}
                    title={d.url}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-accent-strong hover:bg-accent-soft"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </span>
            ),
            sort: (d) => d.title,
          },
          {
            key: 'platform',
            label: 'Platform',
            render: (d) => {
              const pl = platformOf(d);
              return pl ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <PlatformIcon platform={pl} size={13} /> {PLATFORM_LABEL[pl]}
                </span>
              ) : (
                <span className="text-muted">—</span>
              );
            },
            sort: (d) => platformOf(d) ?? '',
          },
          { key: 'date', label: 'Date', render: (d) => <span className="whitespace-nowrap">{shortDate(d.delivered ?? d.due)}</span>, sort: (d) => d.delivered ?? d.due },
          {
            key: 'state',
            label: 'Status',
            render: (d) => {
              const st = deliverableState(d, today);
              return <Badge tone={st === 'delivered' ? 'good' : st === 'late' ? 'critical' : 'info'}>{st === 'delivered' ? 'Delivered' : st === 'late' ? 'Late' : 'Booked'}</Badge>;
            },
            sort: (d) => deliverableState(d, today),
          },
          { key: 'camp', label: 'Campaign', render: (d) => <CampaignTag id={d.campaignId} /> },
          { key: 'views', label: 'Views', align: 'right', render: (d) => (d.results ? compact(d.results.views) : '—'), sort: (d) => d.results?.views ?? null },
          { key: 'members', label: 'Members', align: 'right', render: (d) => (d.results ? num(d.results.newMembers) : '—'), sort: (d) => d.results?.newMembers ?? null },
          {
            key: 'ret',
            label: '7-day ret.',
            align: 'right',
            render: (d) => (d.results?.retained7d != null && d.results.newMembers ? `${Math.round((d.results.retained7d / d.results.newMembers) * 100)}%` : '—'),
          },
          { key: 'cost', label: 'Cost', align: 'right', render: (d) => money(d.cost), sort: (d) => d.cost },
          {
            key: 'paid',
            label: 'Paid',
            render: (d) =>
              d.cost === 0 ? (
                <span className="text-muted">—</span>
              ) : d.paid ? (
                <Badge tone="good">Paid</Badge>
              ) : editable && d.delivered ? (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.saveDeliverable({ ...d, paid: true }, partnerName(d.partnerId));
                  }}
                >
                  Mark paid
                </Button>
              ) : (
                <Badge>Due</Badge>
              ),
          },
          ...(editable
            ? [
                {
                  key: 'edit',
                  label: '',
                  render: (d: Deliverable) => (
                    <IconButton
                      label={`Edit ${d.title}`}
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing({ d, isNew: false });
                      }}
                    >
                      <Pencil size={15} />
                    </IconButton>
                  ),
                },
              ]
            : []),
        ]}
      />
      {rows.length > 0 && (
        <p className="tabular text-[12.5px] text-muted">
          {rows.length} deliverables · {compact(totals.views)} views · {num(totals.members)} new members · {money(totals.cost)} cost
          {totals.unpaid > 0 && <b className="font-medium text-warning-text"> · {money(totals.unpaid)} unpaid</b>}
        </p>
      )}
      {editing && <DeliverableForm deliverable={editing.d} isNew={editing.isNew} choosePartner={showPartner && editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
