import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Columns } from '@/components/charts';
import { Badge, Button, Drawer, Input, Segmented, StatusPill } from '@/components/ui';
import type { Kpi, KpiEntry } from '@/data/types';
import { formatDelta, formatValue, PLATFORM_LABEL, targetLabel } from '@/lib/format';
import { calculatedValue, sourceLabel, kpiValue, lastDataDate, statusOf, targetAt } from '@/lib/metrics';
import { periodLabel, periodsEnding, toDate } from '@/lib/period';
import { kpiCadence, periodOf, type Cadence } from './KpisPage';

const PAGE = 12;

/**
 * One KPI's whole history as a vertical list (newest first), loaded a page at
 * a time, so a year of data never turns into a sideways-scrolling table.
 */
export function KpiHistory({ kpi, onClose }: { kpi: Kpi; onClose: () => void }) {
  const { data, ws, today, can } = useSession();
  const actions = useActions();
  const [cadence, setCadence] = useState<Cadence>(kpiCadence(kpi));
  const [count, setCount] = useState(PAGE);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const last = lastDataDate(data);
  const latest = last && last < today ? last : today;
  // Hand-entered KPIs are typed in; calculated ones can be corrected (the typed value replaces the calculation).
  const editable = can('kpi.enter') && cadence === kpiCadence(kpi);
  const calculated = kpi.source !== 'manual';

  const firstData = useMemo(() => {
    const dates = [...data.stats.map((s) => s.date), ...data.kpiEntries.filter((e) => e.kpiId === kpi.id).map((e) => e.periodStart)];
    return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : latest;
  }, [data, kpi.id, latest]);

  // Newest first, never earlier than the first data: no empty pre-launch rows.
  const all = useMemo(() => periodsEnding(periodOf(cadence, latest, ws.weekStartsOn), count, ws.weekStartsOn).reverse(), [cadence, latest, count, ws.weekStartsOn]);
  const periods = all.filter((p) => p.end >= firstData);
  const hasMore = periods.length === all.length && all[all.length - 1].start > firstData;
  const rows = periods.map((p, i) => {
    const value = kpiValue(kpi, data, p).value;
    const prevP = periods[i + 1];
    const prev = prevP ? kpiValue(kpi, data, prevP).value : null;
    const entry = data.kpiEntries.find((e) => e.kpiId === kpi.id && e.periodStart === p.start) ?? null;
    const target = targetAt(kpi, p.end);
    const calc = calculated ? calculatedValue(kpi, data, p) : null;
    return { p, value, prev, entry, calc, target, status: cadence === kpiCadence(kpi) ? statusOf(kpi, value, prev, target) : ('none' as const) };
  });
  const chart = [...rows]
    .reverse()
    .filter((r) => r.value !== null)
    .slice(-PAGE)
    .map((r) => ({ label: format(toDate(r.p.start), cadence === 'weekly' ? 'd MMM' : 'MMM yy'), value: r.value! }));

  const changed = Object.entries(drafts).filter(([start, v]) => {
    const e = data.kpiEntries.find((x) => x.kpiId === kpi.id && x.periodStart === start);
    return v.trim() !== (e ? String(e.value) : '');
  });
  const save = () => {
    const ups: KpiEntry[] = [];
    const rems: KpiEntry[] = [];
    for (const [start, v] of changed) {
      const e = data.kpiEntries.find((x) => x.kpiId === kpi.id && x.periodStart === start) ?? null;
      if (v.trim() === '') {
        if (e) rems.push(e);
      } else if (!Number.isNaN(Number(v))) {
        ups.push({ id: `${kpi.id}_${start}`, wsId: ws.id, kpiId: kpi.id, periodStart: start, cadence, value: Number(v), note: e?.note ?? '', source: 'manual' });
      }
    }
    actions.saveEntries(ups, rems, kpi.name);
    setDrafts({});
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {kpi.name}
          {kpi.platform && <Badge>{PLATFORM_LABEL[kpi.platform]}</Badge>}
          <Badge>{kpi.source === 'calc' ? 'Calculated' : kpi.source === 'formula' ? 'Formula' : 'Entered by hand'}</Badge>
        </span>
      }
      footer={
        editable ? (
          <>
            <span className="mr-auto text-[13px] text-muted">
              {changed.length
                ? `${changed.length} unsaved change(s)`
                : calculated
                  ? 'Type a value to replace the calculation.'
                  : 'Edit any past value, then save.'}
            </span>
            <Button disabled={!changed.length} onClick={() => setDrafts({})}>
              Discard
            </Button>
            <Button variant="primary" disabled={!changed.length} onClick={save}>
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13.5px]">
          <p className="text-soft">{kpi.question}</p>
          <p className="text-[12.5px] text-muted">
            {sourceLabel(kpi, data.kpis)} · Target now: {targetLabel(kpi.unit, targetAt(kpi, latest))}
          </p>
        </div>
        <Segmented
          size="sm"
          label="History by"
          value={cadence}
          onChange={(c) => {
            setCadence(c);
            setCount(PAGE);
            setDrafts({});
          }}
          options={[
            { value: 'weekly', label: 'By week' },
            { value: 'monthly', label: 'By month' },
          ]}
        />
        <div className="rounded-xl border border-line p-3">
          <Columns data={chart} valueName={kpi.name} height={180} format={(v) => formatValue(kpi.unit, v)} />
        </div>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="border-b border-line py-2 font-medium">{cadence === 'weekly' ? 'Week' : 'Month'}</th>
              <th className="border-b border-line py-2 text-right font-medium">Value</th>
              <th className="border-b border-line py-2 pl-3 font-medium">Change</th>
              <th className="border-b border-line py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = formatDelta(kpi.unit, r.value, r.prev);
              return (
                <tr key={r.p.start} className="border-b border-line/70">
                  <td className="py-2 pr-2">
                    <span className="block whitespace-nowrap">{periodLabel(r.p).replace('Week of ', '')}</span>
                    {r.entry?.note && <span className="block text-[12px] text-muted">{r.entry.note}</span>}
                  </td>
                  <td className="tabular py-1.5 text-right">
                    {editable ? (
                      <>
                        <Input
                          aria-label={`${kpi.name}, ${periodLabel(r.p)}`}
                          inputMode="decimal"
                          value={drafts[r.p.start] ?? (r.entry ? String(r.entry.value) : '')}
                          onChange={(e) => setDrafts({ ...drafts, [r.p.start]: e.target.value })}
                          placeholder={calculated ? formatValue(kpi.unit, r.calc) : '—'}
                          title={calculated ? 'Leave empty to use the calculated value' : undefined}
                          className="tabular ml-auto h-8 w-24 text-right"
                        />
                        {calculated && r.entry && <span className="mt-0.5 block text-[11.5px] text-muted">Calculated: {formatValue(kpi.unit, r.calc)}</span>}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {calculated && r.entry && <Pencil size={11} className="text-accent" aria-label="Edited by hand" />}
                        {formatValue(kpi.unit, r.value)}
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2 pl-3 text-[12.5px] whitespace-nowrap text-muted">{d ? `${d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '='} ${d.text}` : ''}</td>
                  <td className="py-2">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore ? (
          <Button onClick={() => setCount((c) => c + PAGE)}>Show {PAGE} earlier {cadence === 'weekly' ? 'weeks' : 'months'}</Button>
        ) : (
          <p className="text-center text-[12.5px] text-muted">That’s the start of the data.</p>
        )}
      </div>
    </Drawer>
  );
}
