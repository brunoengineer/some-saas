import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { DiscussionButton } from '@/components/Comments';
import { Badge, Button, Card, EmptyState, PageHeader, PlatformBadge, Stars } from '@/components/ui';
import { compact, money, num, PLATFORM_LABEL, shortDate } from '@/lib/format';
import { partnerScore } from '@/lib/metrics';
import { DeliverablesTable } from './DeliverablesTable';
import { PartnerForm, STAGE_TONE } from './PartnerForms';
import { dealLabel } from './PartnersPage';

export function PartnerDetail() {
  const { id } = useParams();
  const { data, can } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const p = data.partners.find((x) => x.id === id);
  if (!p) return <EmptyState title="Partner not found" action={<Link to="/partners" className="text-accent-strong">Back to partners</Link>} />;

  const s = partnerScore(data, p.id);
  const dels = data.deliverables.filter((d) => d.partnerId === p.id).sort((a, b) => (a.due < b.due ? 1 : -1));
  const owed = dels.filter((d) => d.delivered && !d.paid).reduce((sum, d) => sum + d.cost, 0);
  const upcoming = dels.filter((d) => !d.delivered);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/partners" className="inline-flex w-fit items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Partners
      </Link>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.handle} · <PlatformBadge platform={p.platform} full /> · <Badge>{p.type}</Badge> <Badge tone={STAGE_TONE[p.stage]}>{p.stage}</Badge>
          </span>
        }
        actions={
          <>
            <DiscussionButton targetType="partner" targetId={p.id} label={p.name} link={`/partners/${p.id}`} title={`${p.name}: notes and discussion`} />
            {can('edit') && (
              <Button variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Score label="Views" value={s ? compact(s.views) : '—'} />
        <Score label="Clicks" value={s ? num(s.clicks) : '—'} />
        <Score label="New members" value={s ? num(s.newMembers) : '—'} />
        <Score label="7-day retention" value={s?.retention == null ? '—' : `${Math.round(s.retention)}%`} />
        <Score label="Cost per member" value={s?.costPerMember == null ? '—' : money(s.costPerMember, 2)} />
        <Score label="Cost per 1,000 views" value={s?.cpm == null ? '—' : money(s.cpm, 2)} />
      </div>

      <Card title="Profile and deal">
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
          <dt className="text-muted">Audience</dt>
          <dd>
            {compact(p.audience)} on {PLATFORM_LABEL[p.platform]}
          </dd>
          <dt className="text-muted">Niche</dt>
          <dd>{p.niche || '—'}</dd>
          <dt className="text-muted">Contact</dt>
          <dd className="break-all">{p.contact || '—'}</dd>
          <dt className="text-muted">Tracked link</dt>
          <dd className="font-mono text-[12.5px] break-all">{p.trackingCode || '—'}</dd>
          <dt className="text-muted">Deal</dt>
          <dd>
            {dealLabel(p)}
            {p.deal.notes && <span className="block text-[12.5px] text-muted">{p.deal.notes}</span>}
          </dd>
          <dt className="text-muted">Rating</dt>
          <dd>{p.rating ? <Stars value={p.rating} /> : 'Not rated'}</dd>
          <dt className="text-muted">Spent</dt>
          <dd>
            {money(dels.reduce((sum, d) => sum + (d.delivered ? d.cost : 0), 0))}
            {owed > 0 && <Badge tone="warning" className="ml-2">{money(owed)} unpaid</Badge>}
          </dd>
          <dt className="text-muted">Coming up</dt>
          <dd>{upcoming.length ? upcoming.map((d) => `${d.title} (${shortDate(d.due)})`).join(', ') : 'Nothing booked'}</dd>
        </dl>
        {p.notes && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-soft">{p.notes}</p>}
      </Card>

      <Card title="Deliverables" subtitle="Everything booked and delivered. Click a row or the pencil to edit results, cost and payment.">
        <DeliverablesTable partnerId={p.id} />
      </Card>


      {can('edit') && (
        <div>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={() => {
              if (window.confirm(`Remove ${p.name} and their deliverables?`)) {
                actions.deletePartner(p);
                navigate('/partners');
              }
            }}
          >
            Remove partner
          </Button>
        </div>
      )}
      {editing && <PartnerForm partner={p} isNew={false} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-3.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="tabular text-[20px] font-semibold">{value}</span>
    </div>
  );
}
