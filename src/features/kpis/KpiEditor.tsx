import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Button, Field, IconButton, Input, Modal, Select, Toggle } from '@/components/ui';
import type { CalcKey, Comparator, Kpi, KpiFormula, KpiGroup, KpiTarget, KpiUnit, Platform } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { CALC_LABEL, FORMULA_OP } from '@/lib/metrics';
import { GROUP_LABEL } from './KpisPage';

export function blankKpi(wsId: string): Kpi {
  return {
    id: newId('k'),
    wsId,
    name: '',
    question: '',
    unit: 'number',
    direction: 'up',
    platform: null,
    cadence: 'weekly',
    phase: 'Ongoing',
    group: 'weekly',
    source: 'manual',
    calc: null,
    aggregate: 'avg',
    targets: [],
    order: 100,
  };
}

/** Common KPIs to start from. The platform, targets and section can be changed after. */
const TEMPLATES: { label: string; kpi: Partial<Kpi> }[] = [
  { label: 'Engagement rate', kpi: { name: 'Engagement rate', question: 'Is our content working?', unit: 'percent', source: 'calc', calc: 'engagementRate' } },
  { label: 'Net new followers', kpi: { name: 'Net new followers', question: 'Is our reach growing?', unit: 'number', source: 'calc', calc: 'netFollowers' } },
  { label: 'Impressions', kpi: { name: 'Impressions', question: 'How many people saw us?', unit: 'number', source: 'calc', calc: 'impressions' } },
  { label: 'Engagements', kpi: { name: 'Engagements', question: 'How many people reacted?', unit: 'number', source: 'calc', calc: 'engagements' } },
  { label: 'Average reach per post', kpi: { name: 'Average reach per post', question: 'Does each post travel?', unit: 'number', source: 'calc', calc: 'avgImpressions' } },
  { label: 'Link clicks from posts', kpi: { name: 'Link clicks from posts', question: 'Do posts send traffic?', unit: 'number', source: 'calc', calc: 'postClicks' } },
  { label: 'Posts published', kpi: { name: 'Posts published', question: 'Are we keeping the rhythm?', unit: 'number', source: 'calc', calc: 'postsPublished' } },
  { label: 'Partner views', kpi: { name: 'Partner views', question: 'How far do partners take us?', unit: 'number', source: 'calc', calc: 'partnerViews' } },
  { label: 'Partner cost per new member', kpi: { name: 'Cost per new member', question: 'Are partners worth it?', unit: 'currency', direction: 'down', source: 'calc', calc: 'costPerMember', group: 'other' } },
  { label: 'Median reply time (by hand)', kpi: { name: 'Median reply time', question: 'Do we answer fast?', unit: 'minutes', direction: 'down', source: 'manual', aggregate: 'avg', cadence: 'daily', group: 'daily' } },
  { label: 'Video views (by hand)', kpi: { name: 'Video views', question: 'Do people watch?', unit: 'number', source: 'manual', aggregate: 'sum' } },
  { label: 'Saves (by hand)', kpi: { name: 'Saves', question: 'Is it worth keeping?', unit: 'number', source: 'manual', aggregate: 'sum' } },
  { label: 'Weekly active members % (Discord sync)', kpi: { name: 'Weekly active members', question: 'Is the community alive?', unit: 'percent', platform: 'discord', source: 'calc', calc: 'activeShare', aggregate: 'avg' } },
  { label: '7-day retention (Discord sync)', kpi: { name: '7-day retention', question: 'Do newcomers stick?', unit: 'percent', platform: 'discord', source: 'calc', calc: 'retention7', aggregate: 'avg' } },
  { label: 'Weekly active members % (by hand)', kpi: { name: 'Weekly active members', question: 'Is the community alive?', unit: 'percent', source: 'manual', aggregate: 'avg' } },
];

export function KpiEditor({ kpi, isNew, onClose }: { kpi: Kpi; isNew: boolean; onClose: () => void }) {
  const { ws, today, data } = useSession();
  const actions = useActions();
  const [k, setK] = useState(kpi);
  const others = data.kpis.filter((x) => x.id !== k.id).sort((a, b) => a.order - b.order);
  const formula: KpiFormula = k.formula ?? { a: '', op: 'divide', b: '', percent: false };
  const setF = (patch: Partial<KpiFormula>) => set('formula', { ...formula, ...patch });
  const valid = !!k.name.trim() && (k.source !== 'calc' || !!k.calc) && (k.source !== 'formula' || (!!formula.a && !!formula.b));
  const set = <K extends keyof Kpi>(key: K, v: Kpi[K]) => setK({ ...k, [key]: v });
  const setT = (i: number, patch: Partial<KpiTarget>) => set('targets', k.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? 'New KPI' : `Edit ${kpi.name}`}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Delete ${kpi.name}? Its entered results are kept but hidden.`)) {
                  actions.deleteKpi(kpi);
                  onClose();
                }
              }}
            >
              Delete
            </Button>
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              actions.saveKpi(k, isNew);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isNew && (
          <Field label="Start from a template (optional)" className="sm:col-span-2" hint="Fills in the fields below. You can change anything after.">
            <Select
              value=""
              onChange={(e) => {
                const t = TEMPLATES[Number(e.target.value)];
                if (t) setK({ ...k, ...t.kpi });
              }}
            >
              <option value="">Choose a common KPI…</option>
              {TEMPLATES.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Name">
          <Input value={k.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="e.g. Weekly active members" />
        </Field>
        <Field label="Question it answers">
          <Input value={k.question} onChange={(e) => set('question', e.target.value)} placeholder="e.g. Is the community alive?" />
        </Field>
        <Field label="Unit">
          <Select value={k.unit} onChange={(e) => set('unit', e.target.value as KpiUnit)}>
            <option value="number">Number</option>
            <option value="percent">Percent</option>
            <option value="minutes">Minutes</option>
            <option value="currency">Currency</option>
          </Select>
        </Field>
        <Field label="Better when">
          <Select value={k.direction} onChange={(e) => set('direction', e.target.value as Kpi['direction'])}>
            <option value="up">Higher</option>
            <option value="down">Lower (e.g. reply time)</option>
          </Select>
        </Field>
        <Field label="Platform">
          <Select value={k.platform ?? ''} onChange={(e) => set('platform', (e.target.value || null) as Platform | null)}>
            <option value="">Any / all</option>
            {ws.platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section">
          <Select value={k.group} onChange={(e) => set('group', e.target.value as KpiGroup)}>
            {(Object.keys(GROUP_LABEL) as KpiGroup[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reported">
          <Select value={k.cadence} onChange={(e) => set('cadence', e.target.value as Kpi['cadence'])}>
            <option value="daily">Daily check (entered weekly)</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="once">Once / phase end</option>
          </Select>
        </Field>
        <Field label="Phase">
          <Input value={k.phase} onChange={(e) => set('phase', e.target.value)} placeholder="e.g. From week 3, Alpha, Launch" />
        </Field>
        <Field label="Source">
          <Select value={k.source} onChange={(e) => set('source', e.target.value as Kpi['source'])}>
            <option value="manual">Entered manually (or CSV)</option>
            <option value="calc">Calculated by the app</option>
            <option value="formula">Formula from two other KPIs</option>
          </Select>
        </Field>
        {k.source === 'formula' ? (
          <div className="grid grid-cols-[minmax(0,1fr)_70px_minmax(0,1fr)] items-end gap-2 sm:col-span-2">
            <Field label="First KPI">
              <Select value={formula.a} onChange={(e) => setF({ a: e.target.value })}>
                <option value="">Choose</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.platform ? ` (${PLATFORM_LABEL[o.platform]})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Do">
              <Select value={formula.op} onChange={(e) => setF({ op: e.target.value as KpiFormula['op'] })} aria-label="Operation">
                {(Object.keys(FORMULA_OP) as KpiFormula['op'][]).map((op) => (
                  <option key={op} value={op}>
                    {FORMULA_OP[op]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Second KPI">
              <Select value={formula.b} onChange={(e) => setF({ b: e.target.value })}>
                <option value="">Choose</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.platform ? ` (${PLATFORM_LABEL[o.platform]})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="col-span-3">
              <Toggle checked={formula.percent} onChange={(v) => setF({ percent: v })} label="Multiply by 100 (show a ratio as a percentage)" />
            </div>
          </div>
        ) : k.source === 'calc' ? (
          <Field label="Calculation">
            <Select value={k.calc ?? ''} onChange={(e) => set('calc', (e.target.value || null) as CalcKey | null)}>
              <option value="">Choose</option>
              {(Object.keys(CALC_LABEL) as CalcKey[]).map((c) => (
                <option key={c} value={c}>
                  {CALC_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Over longer periods, combine as">
            <Select value={k.aggregate} onChange={(e) => set('aggregate', e.target.value as Kpi['aggregate'])}>
              <option value="avg">Average (rates, times)</option>
              <option value="sum">Sum (counts)</option>
              <option value="last">Latest value (totals)</option>
            </Select>
          </Field>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:col-span-2">
          <Toggle checked={!k.paused} onChange={(v) => set('paused', !v)} label="Track this KPI" />
          <p className="-mt-1 pl-11 text-[12px] text-muted">When off, it leaves the overview, the entry form, the dashboard and new reports. Its history is kept.</p>
          <Toggle checked={k.onDashboard ?? k.group === 'weekly'} onChange={(v) => set('onDashboard', v)} label="Show as a tile on the Dashboard" />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-medium text-soft">Targets</span>
          <p className="text-[12px] text-muted">To recalibrate, add a new target with a later start date. Older ones stay in the history, and past periods are judged against the target that applied then.</p>
          {k.targets.map((t, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line p-2 sm:grid-cols-[130px_110px_100px_130px_1fr_auto]">
              <Field label="From">
                <Input type="date" value={t.from} onChange={(e) => setT(i, { from: e.target.value })} />
              </Field>
              <Field label="Rule">
                <Select value={t.comparator} onChange={(e) => setT(i, { comparator: e.target.value as Comparator })}>
                  <option value="gte">At least</option>
                  <option value="lte">At most</option>
                  <option value="growth">Growing</option>
                </Select>
              </Field>
              <Field label="Value">
                <Input type="number" disabled={t.comparator === 'growth'} value={t.value ?? ''} onChange={(e) => setT(i, { value: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
              <Field label="By (optional)">
                <Input type="date" value={t.by ?? ''} onChange={(e) => setT(i, { by: e.target.value || null })} />
              </Field>
              <Field label="Note">
                <Input value={t.note} onChange={(e) => setT(i, { note: e.target.value })} />
              </Field>
              <IconButton label="Remove target" onClick={() => set('targets', k.targets.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          <div>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => set('targets', [...k.targets, { from: today, value: null, comparator: 'gte', by: null, note: '' }])}>
              Add target
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
