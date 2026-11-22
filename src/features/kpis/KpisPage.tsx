import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, Calculator, ChevronRight as Chevron, LayoutDashboard, Pause, Pencil, Play, Plus, Upload } from 'lucide-react';
import { PeriodStepper } from '@/components/PeriodStepper';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Sparkline } from '@/components/Sparkline';
import { Badge, Button, Card, cx, IconButton, Input, PageHeader, Segmented, Select, StatusPill } from '@/components/ui';
import type { Kpi, KpiEntry, KpiGroup, Status, WsData } from '@/data/types';
import { cap, formatDelta, formatValue, PLATFORM_LABEL, targetLabel } from '@/lib/format';
import { isTracked, kpiValue, lastDataDate, onDashboard, pacing, sourceLabel, statusOf, targetAt } from '@/lib/metrics';
import { periodFor, periodLabel, periodsEnding, shiftPeriod, toDate, type Period } from '@/lib/period';
import { blankKpi, KpiEditor } from './KpiEditor';
import { DailyNumbers } from './DailyNumbers';
import { KpiHistory } from './KpiHistory';

export const GROUP_LABEL: Record<KpiGroup, string> = {
  weekly: 'Weekly numbers',
  daily: 'Daily checks',
  headline: 'Headline goals',
  other: 'Other KPIs',
};
const GROUPS: KpiGroup[] = ['weekly', 'daily', 'headline', 'other'];
type Tab = 'overview' | 'enter' | 'daily' | 'definitions';
export type Cadence = 'weekly' | 'monthly';

/** Is this KPI judged / entered in weekly or in monthly periods? */
export const kpiCadence = (k: Kpi): Cadence => (k.cadence === 'monthly' ? 'monthly' : 'weekly');

export function periodOf(c: Cadence, anchor: string, weekStartsOn: 0 | 1): Period {
  return periodFor(c === 'weekly' ? 'week' : 'month', anchor, weekStartsOn);
}

/** One period at a time, stepped with arrows: the page never grows sideways. */
function usePeriodPicker() {
  const { data, today, ws } = useSession();
  const last = lastDataDate(data);
  const latest = last && last < today ? last : today;
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [anchor, setAnchor] = useState(latest);
  const period = periodOf(cadence, anchor, ws.weekStartsOn);
  return {
    cadence,
    setCadence,
    period,
    latest,
    isLatest: period.end >= latest,
    step: (dir: 1 | -1) => setAnchor(shiftPeriod(period, dir, ws.weekStartsOn).start),
    reset: () => setAnchor(latest),
  };
}

function PeriodPicker({ p }: { p: ReturnType<typeof usePeriodPicker> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Period length"
        value={p.cadence}
        onChange={p.setCadence}
        options={[
          { value: 'weekly', label: 'Week' },
          { value: 'monthly', label: 'Month' },
        ]}
      />
      <PeriodStepper label={periodLabel(p.period)} onPrev={() => p.step(-1)} onNext={() => p.step(1)} nextDisabled={p.isLatest} />
      {/* Always rendered (hidden when already on the latest period) so nothing shifts. */}
      <Button size="sm" variant="ghost" onClick={p.reset} className={p.isLatest ? 'invisible' : ''} aria-hidden={p.isLatest} tabIndex={p.isLatest ? -1 : 0}>
        Latest
      </Button>
    </div>
  );
}

export function KpisPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'definitions' || raw === 'enter' || raw === 'daily' ? raw : 'overview';
  const { can, ws, data } = useSession();
  const [editing, setEditing] = useState<{ k: Kpi; isNew: boolean } | null>(null);
  const manualCount = data.kpis.filter((k) => k.source === 'manual').length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="KPIs & Goals"
        subtitle="How each number is doing against its target, and where to enter the results the app can’t calculate."
        actions={
          <>
            {can('kpi.enter') && (
              <Link to="/settings?tab=import">
                <Button icon={<Upload size={15} />}>Import CSV</Button>
              </Link>
            )}
            {can('edit') && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({ k: blankKpi(ws.id), isNew: true })}>
                New KPI
              </Button>
            )}
          </>
        }
      />
      <Segmented
        label="KPI section"
        value={tab}
        onChange={(v) => setParams(v === 'overview' ? {} : { tab: v })}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'enter', label: `Enter results (${manualCount})` },
          { value: 'daily', label: 'Daily numbers' },
          { value: 'definitions', label: 'Definitions & targets' },
        ]}
      />
      {tab === 'overview' && <Overview onEnter={() => setParams({ tab: 'enter' })} />}
      {tab === 'enter' && <EnterResults />}
      {tab === 'daily' && <DailyNumbers />}
      {tab === 'definitions' && <Definitions onEdit={(k) => setEditing({ k, isNew: false })} />}
      {editing && <KpiEditor kpi={editing.k} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}

interface Row {
  k: Kpi;
  value: number | null;
  prev: number | null;
  trend: (number | null)[];
  status: Status;
  missing: boolean;
  /** A calculated KPI whose value for this period was typed in by hand. */
  edited: boolean;
}

function rowFor(k: Kpi, data: WsData, period: Period, weekStartsOn: 0 | 1): Row {
  const periods = periodsEnding(period, 8, weekStartsOn);
  const results = periods.map((p) => kpiValue(k, data, p));
  const trend = results.map((r) => r.value);
  const value = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  return {
    k,
    value,
    prev,
    trend,
    // Only judge a KPI in the period length it is reported in.
    status: kpiCadence(k) === (period.type === 'month' ? 'monthly' : 'weekly') ? statusOf(k, value, prev, targetAt(k, period.end)) : 'none',
    edited: !!results[results.length - 1].edited,
    missing: k.source === 'manual' && kpiCadence(k) === (period.type === 'month' ? 'monthly' : 'weekly') && k.cadence !== 'once' && value === null,
  };
}

function Overview({ onEnter }: { onEnter: () => void }) {
  const { data, ws, can } = useSession();
  const picker = usePeriodPicker();
  const [group, setGroup] = useState('');
  const [platform, setPlatform] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  // The open history panel lives in the URL (?kpi=…), so it can be linked to.
  const [params, setParams] = useSearchParams();
  const open = data.kpis.find((k) => k.id === params.get('kpi')) ?? null;
  const setOpen = (k: Kpi | null) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (k) n.set('kpi', k.id);
      else n.delete('kpi');
      return n;
    });

  const rows = useMemo(
    () =>
      [...data.kpis]
        .sort((a, b) => a.order - b.order)
        .filter(isTracked)
        .filter((k) => (!group || k.group === group) && (!platform || (platform === 'none' ? !k.platform : k.platform === platform)) && (!source || k.source === source))
        .map((k) => rowFor(k, data, picker.period, ws.weekStartsOn))
        .filter((r) => !status || (status === 'missing' ? r.missing : r.status === status)),
    [data, picker.period, ws.weekStartsOn, group, platform, source, status],
  );
  const all = useMemo(() => data.kpis.filter(isTracked).map((k) => rowFor(k, data, picker.period, ws.weekStartsOn)), [data, picker.period, ws.weekStartsOn]);
  const counts = (s: Status) => all.filter((r) => r.status === s).length;
  const missing = all.filter((r) => r.missing).length;
  const chip = 'h-8 w-auto max-w-[190px] text-[13px]';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker p={picker} />
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <StatusPill status="good" /> <span className="tabular mr-1.5 text-muted">{counts('good')}</span>
          <StatusPill status="warning" /> <span className="tabular mr-1.5 text-muted">{counts('warning')}</span>
          <StatusPill status="critical" /> <span className="tabular mr-1.5 text-muted">{counts('critical')}</span>
          {missing > 0 && (
            <button type="button" onClick={onEnter} className="font-medium text-accent-strong hover:underline">
              {missing} result{missing > 1 ? 's' : ''} to enter →
            </button>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="KPI filters">
        <Select aria-label="Section" value={group} onChange={(e) => setGroup(e.target.value)} className={chip}>
          <option value="">All sections</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]}
            </option>
          ))}
        </Select>
        <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className={chip}>
          <option value="">All platforms</option>
          {ws.platforms.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
          <option value="none">Not platform-specific</option>
        </Select>
        <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} className={chip}>
          <option value="">All sources</option>
          <option value="calc">Calculated by the app</option>
          <option value="manual">Entered by hand</option>
        </Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={chip}>
          <option value="">Any status</option>
          <option value="good">On track</option>
          <option value="warning">At risk</option>
          <option value="critical">Off track</option>
          <option value="none">No target</option>
          <option value="missing">Waiting for results</option>
        </Select>
      </div>

      <Card pad={false}>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="border-b border-line py-2.5 pr-3 pl-4 font-medium">KPI</th>
              <th className="border-b border-line px-3 py-2.5 text-right font-medium">{picker.cadence === 'weekly' ? 'This week' : 'This month'}</th>
              <th className="hidden border-b border-line px-3 py-2.5 font-medium sm:table-cell">vs previous</th>
              <th className="hidden border-b border-line px-3 py-2.5 font-medium lg:table-cell">Last 8 {picker.cadence === 'weekly' ? 'weeks' : 'months'}</th>
              <th className="hidden border-b border-line px-3 py-2.5 font-medium md:table-cell">Target</th>
              <th className="border-b border-line px-3 py-2.5 font-medium">Status</th>
              <th className="w-8 border-b border-line pr-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[13px] text-muted">
                  No KPIs match these filters
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const d = formatDelta(r.k.unit, r.value, r.prev);
              const better = d && d.dir !== 'flat' ? (d.dir === 'up') === (r.k.direction === 'up') : null;
              return (
                <tr key={r.k.id} onClick={() => setOpen(r.k)} className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-surface-2">
                  <td className="py-2.5 pr-3 pl-4">
                    <span className="flex items-start gap-2">
                      {r.k.source === 'calc' ? (
                        <Calculator size={13} className="mt-1 shrink-0 text-muted" aria-label="Calculated" />
                      ) : (
                        <Pencil size={13} className="mt-1 shrink-0 text-muted" aria-label="Entered by hand" />
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium">{r.k.name}</span>
                        <span className="block text-[12px] text-muted">
                          {r.k.platform ? `${PLATFORM_LABEL[r.k.platform]} · ` : ''}
                          {GROUP_LABEL[r.k.group]}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-[15px] font-semibold whitespace-nowrap">
                    {r.missing ? (
                      can('kpi.enter') ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEnter();
                          }}
                          className="text-[13px] font-medium text-accent-strong hover:underline"
                        >
                          Enter
                        </button>
                      ) : (
                        <span className="text-[13px] font-normal text-muted">Not entered</span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5" title={r.edited ? 'Edited by hand for this period' : undefined}>
                        {r.edited && <Pencil size={12} className="text-accent" aria-label="Edited by hand" />}
                        {formatValue(r.k.unit, r.value, { signed: r.k.calc === 'netFollowers' })}
                      </span>
                    )}
                  </td>
                  <td className="tabular hidden px-3 py-2.5 text-[12.5px] whitespace-nowrap sm:table-cell">
                    {d ? (
                      <span className={better === null ? 'text-muted' : better ? 'text-good-text' : 'text-critical-text'}>
                        {d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '='} {d.text}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-1.5 lg:table-cell">
                    <Sparkline values={r.trend} label={`${r.k.name} trend`} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-[12.5px] text-muted md:table-cell">{targetLabel(r.k.unit, targetAt(r.k, picker.period.end))}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="pr-3 text-muted">
                    <Chevron size={16} aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-[12.5px] text-muted">Click a KPI to see its full history{can('kpi.enter') ? ' and correct past results' : ''}.</p>
      {open && <KpiHistory kpi={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

interface Draft {
  value: string;
  note: string;
}

function EnterResults() {
  const { data, ws, can } = useSession();
  const actions = useActions();
  const picker = usePeriodPicker();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [showOnce, setShowOnce] = useState(false);
  const [saved, setSaved] = useState('');
  const editable = can('kpi.enter');
  const p = picker.period;

  const manual = data.kpis.filter((k) => isTracked(k) && k.source === 'manual' && kpiCadence(k) === picker.cadence).sort((a, b) => a.order - b.order);
  const regular = manual.filter((k) => k.cadence !== 'once');
  const once = manual.filter((k) => k.cadence === 'once');
  const calculated = data.kpis.filter((k) => isTracked(k) && k.source !== 'manual').length;
  const entryFor = (k: Kpi): KpiEntry | null => data.kpiEntries.find((e) => e.kpiId === k.id && e.periodStart === p.start) ?? null;
  const current = (k: Kpi): Draft => drafts[k.id] ?? { value: entryFor(k) ? String(entryFor(k)!.value) : '', note: entryFor(k)?.note ?? '' };
  const changed = Object.entries(drafts).filter(([id, d]) => {
    const k = data.kpis.find((x) => x.id === id)!;
    const e = entryFor(k);
    return d.value.trim() !== (e ? String(e.value) : '') || d.note !== (e?.note ?? '');
  });
  const invalid = changed.some(([, d]) => d.value.trim() !== '' && Number.isNaN(Number(d.value)));
  const filled = regular.filter((k) => current(k).value.trim() !== '').length;

  const setDraft = (k: Kpi, patch: Partial<Draft>) => {
    setSaved('');
    setDrafts((ds) => ({ ...ds, [k.id]: { ...current(k), ...patch } }));
  };
  const move = (dir: 1 | -1) => {
    if (changed.length && !window.confirm('You have unsaved results. Leave this period anyway?')) return;
    setDrafts({});
    setSaved('');
    picker.step(dir);
  };
  const save = () => {
    const ups: KpiEntry[] = [];
    const rems: KpiEntry[] = [];
    for (const [id, d] of changed) {
      const k = data.kpis.find((x) => x.id === id)!;
      const e = entryFor(k);
      if (d.value.trim() === '') {
        if (e) rems.push(e);
      } else {
        ups.push({ id: `${k.id}_${p.start}`, wsId: ws.id, kpiId: k.id, periodStart: p.start, cadence: picker.cadence, value: Number(d.value), note: d.note, source: 'manual' });
      }
    }
    actions.saveEntries(ups, rems, periodLabel(p));
    setDrafts({});
    setSaved(`Saved ${ups.length + rems.length} result${ups.length + rems.length === 1 ? '' : 's'} for ${periodLabel(p)}.`);
  };

  const row = (k: Kpi) => {
    const d = current(k);
    const prevP = shiftPeriod(p, -1, ws.weekStartsOn);
    const prev = kpiValue(k, data, prevP).value;
    const t = targetAt(k, p.end);
    const v = d.value.trim() === '' || Number.isNaN(Number(d.value)) ? null : Number(d.value);
    return (
      <li key={k.id} className="grid grid-cols-1 gap-3 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_150px_minmax(0,1fr)_110px] md:items-center">
        <div className="min-w-0">
          <p className="font-medium">
            {k.name} {k.platform && <span className="text-[12px] font-normal text-muted">· {PLATFORM_LABEL[k.platform]}</span>}
          </p>
          <p className="text-[12.5px] text-muted">
            {k.question}
            {k.cadence === 'daily' && ' Enter the median for the week.'}
          </p>
        </div>
        <div className="text-[12.5px] text-muted">
          <span className="block">Target: {targetLabel(k.unit, t)}</span>
          <span className="block">Previous: {formatValue(k.unit, prev)}</span>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">{k.name} value</span>
          <Input
            inputMode="decimal"
            value={d.value}
            disabled={!editable}
            onChange={(e) => setDraft(k, { value: e.target.value })}
            placeholder={k.unit === 'percent' ? 'e.g. 48' : k.unit === 'minutes' ? 'minutes' : 'value'}
            className={cx('tabular text-right', d.value.trim() !== '' && Number.isNaN(Number(d.value)) && 'border-critical')}
          />
          <span className="w-6 text-[12.5px] text-muted">{k.unit === 'percent' ? '%' : k.unit === 'minutes' ? 'min' : ''}</span>
        </label>
        <Input value={d.note} disabled={!editable} onChange={(e) => setDraft(k, { note: e.target.value })} placeholder="Note (optional), e.g. 134 of 291 active" aria-label={`${k.name} note`} />
        <span>{v !== null && <StatusPill status={statusOf(k, v, prev, t)} />}</span>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Period length"
            value={picker.cadence}
            onChange={(c) => {
              if (changed.length && !window.confirm('You have unsaved results. Switch anyway?')) return;
              setDrafts({});
              picker.setCadence(c);
            }}
            options={[
              { value: 'weekly', label: 'Weekly results' },
              { value: 'monthly', label: 'Monthly results' },
            ]}
          />
          <PeriodStepper label={periodLabel(p)} onPrev={() => move(-1)} onNext={() => move(1)} nextDisabled={picker.isLatest} />
        </div>
        <Badge tone={filled === regular.length && regular.length ? 'good' : 'neutral'}>
          {filled} of {regular.length} entered
        </Badge>
      </div>

      <Card
        title={`Results to enter for ${periodLabel(p)}`}
        subtitle={`Only the ${manual.length} ${picker.cadence} KPIs entered by hand are listed. ${calculated} others are calculated from posts, channel stats and partner deliverables: correct those in Daily numbers, or click one in Overview to type over a week or month.`}
      >
        {!editable && <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">Only admins enter results. You can see what has been entered.</p>}
        {regular.length === 0 ? (
          <p className="text-[13px] text-muted">No {picker.cadence} manual KPIs. Monthly ones are under “Monthly results”.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">{regular.map(row)}</ul>
        )}
        {once.length > 0 && (
          <div className="mt-2 border-t border-line pt-3">
            <button type="button" onClick={() => setShowOnce((s) => !s)} className="text-[13px] font-medium text-soft hover:text-fg">
              {showOnce ? '▾' : '▸'} One-off and phase-end KPIs ({once.length})
            </button>
            {showOnce && <ul className="flex flex-col divide-y divide-line">{once.map(row)}</ul>}
          </div>
        )}
      </Card>

      {editable && (
        <div className="sticky bottom-3 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line bg-surface/95 p-2.5 shadow-lg backdrop-blur">
          <span className="mr-auto pl-1 text-[13px] text-muted">
            {saved ? <span className="text-good-text">{saved}</span> : changed.length ? `${changed.length} unsaved change${changed.length > 1 ? 's' : ''}` : 'No changes'}
          </span>
          <Button disabled={!changed.length} onClick={() => setDrafts({})}>
            Discard
          </Button>
          <Button variant="primary" disabled={!changed.length || invalid} onClick={save}>
            Save results
          </Button>
        </div>
      )}
    </div>
  );
}

function Definitions({ onEdit }: { onEdit: (k: Kpi) => void }) {
  const { data, can, today } = useSession();
  const actions = useActions();
  const kpis = [...data.kpis].sort((a, b) => a.order - b.order);
  /** Swap a KPI with its neighbour in the same section, then renumber the whole list. */
  const move = (k: Kpi, dir: -1 | 1) => {
    const list = kpis.filter((x) => x.group === k.group);
    const i = list.findIndex((x) => x.id === k.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const others = kpis.filter((x) => x.group !== k.group);
    const ordered = GROUPS.flatMap((g) => (g === k.group ? list : others.filter((x) => x.group === g)));
    actions.reorderKpis(ordered.map((x, n) => ({ ...x, order: n + 1 })), k.name);
  };
  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((g) => {
        const list = kpis.filter((k) => k.group === g);
        if (!list.length) return null;
        return (
          <Card key={g} title={GROUP_LABEL[g]} subtitle={g === 'weekly' ? 'Shown on the Dashboard unless you turn it off per KPI.' : undefined}>
            <ul className="flex flex-col divide-y divide-line">
              {list.map((k, idx) => {
                const pace = pacing(k, data, today);
                return (
                  <li key={k.id} className={cx('flex flex-wrap items-start gap-x-4 gap-y-2 py-3', k.paused && 'opacity-60')}>
                    <div className="min-w-[220px] flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {k.name} {k.platform && <span className="text-[12px] font-normal text-muted">· {PLATFORM_LABEL[k.platform]}</span>}
                        {k.paused && <Badge>Paused</Badge>}
                        {onDashboard(k) && (
                          <Badge tone="accent">
                            <LayoutDashboard size={11} aria-hidden /> Dashboard
                          </Badge>
                        )}
                      </p>
                      <p className="text-[13px] text-soft">{k.question}</p>
                      <p className="text-[12px] text-muted">
                        {sourceLabel(k, data.kpis)} · {cap(k.cadence)} · {k.phase}
                        {k.direction === 'down' ? ' · lower is better' : ''}
                      </p>
                      {pace && (
                        <p className={cx('text-[12px]', pace.onTrack ? 'text-good-text' : 'text-critical-text')}>
                          {pace.onTrack ? '▲ On pace' : '▼ Behind'}: {formatValue(k.unit, pace.projected)} by {format(toDate(pace.target.by!), 'd MMM')}
                        </p>
                      )}
                    </div>
                    <div className="flex min-w-[220px] flex-col gap-1">
                      {k.targets.length === 0 && <span className="text-[12.5px] text-muted">No target</span>}
                      {[...k.targets]
                        .sort((a, b) => (a.from < b.from ? -1 : 1))
                        .map((t, i, arr) => (
                          <span key={t.from + i} className={cx('text-[12.5px]', i < arr.length - 1 ? 'text-muted line-through decoration-line-strong' : 'text-fg')}>
                            From {format(toDate(t.from), 'd MMM yyyy')}: <b className="font-medium">{targetLabel(k.unit, t)}</b>
                            {t.note && <span className="text-muted"> · {t.note}</span>}
                          </span>
                        ))}
                    </div>
                    <span className="flex items-center gap-0.5">
                      <Badge className="mr-1">{k.unit}</Badge>
                      {can('edit') && (
                        <>
                          <IconButton label={`Move ${k.name} up`} disabled={idx === 0} className="disabled:opacity-30" onClick={() => move(k, -1)}>
                            <ArrowUp size={15} />
                          </IconButton>
                          <IconButton label={`Move ${k.name} down`} disabled={idx === list.length - 1} className="disabled:opacity-30" onClick={() => move(k, 1)}>
                            <ArrowDown size={15} />
                          </IconButton>
                          <IconButton
                            label={onDashboard(k) ? `Remove ${k.name} from the Dashboard` : `Show ${k.name} on the Dashboard`}
                            aria-pressed={onDashboard(k)}
                            disabled={!!k.paused}
                            className={cx('disabled:opacity-30', onDashboard(k) && 'text-accent-strong')}
                            onClick={() => actions.saveKpi({ ...k, onDashboard: !onDashboard(k) }, false)}
                          >
                            <LayoutDashboard size={15} />
                          </IconButton>
                          <IconButton label={k.paused ? `Resume tracking ${k.name}` : `Pause ${k.name}`} onClick={() => actions.saveKpi({ ...k, paused: !k.paused }, false)}>
                            {k.paused ? <Play size={15} /> : <Pause size={15} />}
                          </IconButton>
                          <IconButton label={`Edit ${k.name}`} onClick={() => onEdit(k)}>
                            <Pencil size={15} />
                          </IconButton>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

