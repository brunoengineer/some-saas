import { useEffect, useState } from 'react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from '@/components/ui';
import type { DealModel, Deliverable, Partner, PartnerStage, PartnerType, Platform } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';

export const TYPES: PartnerType[] = ['creator', 'streamer', 'clipper', 'affiliate', 'community', 'brand'];
export const STAGES: PartnerStage[] = ['prospect', 'contacted', 'negotiating', 'active', 'paused', 'ended'];
export const DEALS: { value: DealModel; label: string }[] = [
  { value: 'flat', label: 'Flat fee per deliverable' },
  { value: 'cpm', label: 'CPM (per 1,000 views)' },
  { value: 'cpa', label: 'CPA (per member / sign-up)' },
  { value: 'revshare', label: 'Revenue share (%)' },
  { value: 'gifted', label: 'Gifted / barter' },
];
export const STAGE_TONE: Record<PartnerStage, 'neutral' | 'info' | 'warning' | 'good' | 'critical'> = {
  prospect: 'neutral',
  contacted: 'info',
  negotiating: 'warning',
  active: 'good',
  paused: 'neutral',
  ended: 'neutral',
};

const ALL: Platform[] = ['x', 'instagram', 'tiktok', 'youtube', 'kick', 'discord', 'telegram', 'linkedin'];

export function blankPartner(wsId: string): Partner {
  return {
    id: newId('p'),
    wsId,
    name: '',
    handle: '',
    type: 'creator',
    platform: 'x',
    audience: 0,
    niche: '',
    contact: '',
    trackingCode: '',
    deal: { model: 'flat', rate: 0, notes: '' },
    stage: 'prospect',
    rating: 0,
    notes: '',
  };
}

export function PartnerForm({ partner, isNew, onClose }: { partner: Partner; isNew: boolean; onClose: () => void }) {
  const actions = useActions();
  const [p, setP] = useState(partner);
  useEffect(() => setP(partner), [partner]);
  const set = <K extends keyof Partner>(k: K, v: Partner[K]) => setP({ ...p, [k]: v });

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? 'Add partner' : `Edit ${partner.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!p.name.trim()}
            onClick={() => {
              actions.savePartner(p, isNew);
              onClose();
            }}
          >
            {isNew ? 'Add partner' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={p.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Handle">
          <Input value={p.handle} onChange={(e) => set('handle', e.target.value)} placeholder="@handle" />
        </Field>
        <Field label="Type">
          <Select value={p.type} onChange={(e) => set('type', e.target.value as PartnerType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Main platform">
          <Select value={p.platform} onChange={(e) => set('platform', e.target.value as Platform)}>
            {ALL.map((x) => (
              <option key={x} value={x}>
                {PLATFORM_LABEL[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Audience size">
          <Input type="number" min={0} value={p.audience} onChange={(e) => set('audience', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Niche">
          <Input value={p.niche} onChange={(e) => set('niche', e.target.value)} />
        </Field>
        <Field label="Contact">
          <Input value={p.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Email or where to DM" />
        </Field>
        <Field label="Tracked link or code" hint="One per partner, so new members and sign-ups can be credited.">
          <Input value={p.trackingCode} onChange={(e) => set('trackingCode', e.target.value)} />
        </Field>
        <Field label="Deal model">
          <Select value={p.deal.model} onChange={(e) => set('deal', { ...p.deal, model: e.target.value as DealModel })}>
            {DEALS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={p.deal.model === 'revshare' ? 'Rate (%)' : 'Rate (USD)'}>
          <Input type="number" min={0} value={p.deal.rate} onChange={(e) => set('deal', { ...p.deal, rate: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="Deal notes" className="sm:col-span-2">
          <Input value={p.deal.notes} onChange={(e) => set('deal', { ...p.deal, notes: e.target.value })} placeholder="e.g. $400 per 2h stream, #ad + Paid Partnership label" />
        </Field>
        <Field label="Stage">
          <Select value={p.stage} onChange={(e) => set('stage', e.target.value as PartnerStage)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rating">
          <Select value={p.rating} onChange={(e) => set('rating', Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Not rated' : '★'.repeat(n)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={p.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}

export function blankDeliverable(wsId: string, partnerId: string, today: string, cost: number): Deliverable {
  return { id: newId('d'), wsId, partnerId, campaignId: null, kind: 'post', title: '', due: today, delivered: null, results: null, cost, paid: false };
}

export function DeliverableForm({
  deliverable,
  isNew,
  onClose,
  choosePartner = false,
}: {
  deliverable: Deliverable;
  isNew: boolean;
  onClose: () => void;
  /** Show a partner picker (when adding from the all-deliverables list). */
  choosePartner?: boolean;
}) {
  const { data } = useSession();
  const actions = useActions();
  const [d, setD] = useState(deliverable);
  const partner = data.partners.find((p) => p.id === d.partnerId) ?? null;
  const partnerName = partner?.name ?? 'partner';
  const set = <K extends keyof Deliverable>(k: K, v: Deliverable[K]) => setD({ ...d, [k]: v });
  const r = d.results ?? { views: 0, clicks: 0, signups: 0, newMembers: 0, retained7d: null };
  const setR = (k: keyof typeof r, v: string) =>
    set('results', { ...r, [k]: k === 'retained7d' && v === '' ? null : Math.max(0, Number(v) || 0) });

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? (choosePartner ? 'New deliverable' : `New deliverable for ${partnerName}`) : `Edit “${deliverable.title}” · ${partnerName}`}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm(`Delete “${deliverable.title}”?`)) return;
                actions.deleteDeliverable(d);
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!d.title.trim() || !d.partnerId}
            onClick={() => {
              actions.saveDeliverable({ ...d, results: d.delivered ? d.results : null }, partnerName);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choosePartner && (
          <Field label="Partner" className="sm:col-span-2">
            <Select
              value={d.partnerId}
              onChange={(e) => {
                const p = data.partners.find((x) => x.id === e.target.value);
                setD({ ...d, partnerId: e.target.value, cost: d.cost || (p?.deal.model === 'flat' ? p.deal.rate : 0) });
              }}
            >
              <option value="">Choose a partner</option>
              {data.partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.handle})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Title" className="sm:col-span-2">
          <Input value={d.title} onChange={(e) => set('title', e.target.value)} autoFocus={!choosePartner} placeholder="e.g. Tournament opening stream" />
        </Field>
        <Field label="Kind">
          <Select value={d.kind} onChange={(e) => set('kind', e.target.value as Deliverable['kind'])}>
            {['post', 'stream', 'clip', 'video', 'event'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Campaign">
          <Select value={d.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || null)}>
            <option value="">No campaign</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Platform" hint={d.platform ? undefined : 'The partner’s main platform until you choose.'}>
          <Select value={d.platform ?? partner?.platform ?? ''} onChange={(e) => set('platform', (e.target.value || null) as Deliverable['platform'])}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((pl) => (
              <option key={pl} value={pl}>
                {PLATFORM_LABEL[pl]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" value={d.due} onChange={(e) => set('due', e.target.value)} />
        </Field>
        <Field label="Link to their post" className="sm:col-span-2" hint="The partner’s published post, stream or video. It shows as a link icon in the deliverables list.">
          <Input type="url" value={d.url ?? ''} onChange={(e) => set('url', e.target.value.trim())} placeholder="https://" />
        </Field>
        <Field label="Cost (USD)">
          <Input type="number" min={0} value={d.cost} onChange={(e) => set('cost', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Toggle checked={!!d.delivered} onChange={(v) => set('delivered', v ? d.due : null)} label="Delivered" />
          <Toggle checked={d.paid} onChange={(v) => set('paid', v)} label="Paid" />
        </div>
        {d.delivered && (
          <>
            <Field label="Delivered on">
              <Input type="date" value={d.delivered} onChange={(e) => set('delivered', e.target.value)} />
            </Field>
            <span />
            <Field label="Views">
              <Input type="number" min={0} value={r.views} onChange={(e) => setR('views', e.target.value)} />
            </Field>
            <Field label="Clicks">
              <Input type="number" min={0} value={r.clicks} onChange={(e) => setR('clicks', e.target.value)} />
            </Field>
            <Field label="New members (tracked link)">
              <Input type="number" min={0} value={r.newMembers} onChange={(e) => setR('newMembers', e.target.value)} />
            </Field>
            <Field label="Sign-ups">
              <Input type="number" min={0} value={r.signups} onChange={(e) => setR('signups', e.target.value)} />
            </Field>
            <Field label="Still active after 7 days" hint="Leave empty until a week has passed.">
              <Input type="number" min={0} value={r.retained7d ?? ''} onChange={(e) => setR('retained7d', e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
