import { PeriodStepper } from '@/components/PeriodStepper';
import { useSession } from '@/app/session';
import { usePeriodFilters } from '@/app/useFilters';
import { Button, Input, Segmented, Select, Toggle } from '@/components/ui';
import { PLATFORM_LABEL } from '@/lib/format';
import { periodFor, periodLabel, shiftPeriod, type PeriodType } from '@/lib/period';

const TYPES: { value: PeriodType; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

export function PeriodBar() {
  const { ws } = useSession();
  const { period, filters, compare, update, setPeriod, today } = usePeriodFilters();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Period"
        value={period.type}
        options={TYPES}
        onChange={(t) => setPeriod(t === 'custom' ? { ...period, type: 'custom' } : periodFor(t, period.end < today ? period.end : today, ws.weekStartsOn))}
      />
      <div className="flex flex-wrap items-center gap-1">
        {period.type === 'custom' ? (
          <span className="flex items-center gap-1.5">
            <Input type="date" aria-label="From" value={period.start} max={period.end} onChange={(e) => e.target.value && setPeriod({ ...period, start: e.target.value })} className="w-[150px]" />
            <span className="text-muted">–</span>
            <Input type="date" aria-label="To" value={period.end} min={period.start} onChange={(e) => e.target.value && setPeriod({ ...period, end: e.target.value })} className="w-[150px]" />
          </span>
        ) : (
          <PeriodStepper
            label={periodLabel(period)}
            onPrev={() => setPeriod(shiftPeriod(period, -1, ws.weekStartsOn))}
            onNext={() => setPeriod(shiftPeriod(period, 1, ws.weekStartsOn))}
            overlay={
              <input
                type="date"
                aria-label="Pick a date"
                value={period.start}
                onChange={(e) => e.target.value && setPeriod(periodFor(period.type, e.target.value, ws.weekStartsOn))}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            }
          />
        )}
        <Button size="sm" variant="ghost" onClick={() => setPeriod(periodFor(period.type === 'custom' ? 'week' : period.type, today, ws.weekStartsOn))}>
          Latest
        </Button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {ws.platforms.length > 1 && (
          <Select aria-label="Platform" className="h-8 w-[140px] text-[13px]" value={filters.platform ?? ''} onChange={(e) => update({ platform: e.target.value || null })}>
            <option value="">All platforms</option>
            {ws.platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        )}
        <Toggle checked={compare} onChange={(v) => update({ cmp: v ? null : '0' })} label="Compare to last period" />
      </div>
    </div>
  );
}
