import type { KpiTarget, KpiUnit, Platform, Status } from '@/data/types';
import { formatDelta, formatValue, PLATFORM_LABEL, targetLabel } from '@/lib/format';
import { cx, StatusPill } from './ui';

export interface TileProps {
  name: string;
  question: string;
  unit: KpiUnit;
  direction: 'up' | 'down';
  platform: Platform | null;
  value: number | null;
  prev: number | null;
  target: KpiTarget | null;
  status: Status;
  detail?: string;
  compareLabel?: string;
  signed?: boolean;
}

export function KpiTile(p: TileProps) {
  const delta = formatDelta(p.unit, p.value, p.prev);
  const better = delta && delta.dir !== 'flat' ? (delta.dir === 'up') === (p.direction === 'up') : null;
  return (
    <div className="break-avoid flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
      <p className="text-[11.5px] font-medium tracking-wide text-muted uppercase">
        {p.platform && <span className="text-soft">{PLATFORM_LABEL[p.platform]} · </span>}
        {p.question}
      </p>
      <p className="text-[13.5px] font-medium text-soft">{p.name}</p>
      <p className="tabular text-[28px] leading-tight font-semibold tracking-tight text-fg">
        {formatValue(p.unit, p.value, { signed: p.signed })}
        {p.detail && <span className="ml-2 align-middle text-[13px] font-normal text-muted">{p.detail}</span>}
      </p>
      <p className="tabular min-h-5 text-[12.5px]">
        {delta ? (
          <span className={cx('font-medium', better === null ? 'text-muted' : better ? 'text-good-text' : 'text-critical-text')}>
            {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '='} {delta.text}
          </span>
        ) : (
          <span className="text-muted">No earlier data to compare</span>
        )}
        {delta && p.compareLabel && <span className="text-muted"> {p.compareLabel}</span>}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className="text-[12px] text-muted">Target: {targetLabel(p.unit, p.target)}</span>
        <StatusPill status={p.status} />
      </div>
    </div>
  );
}
