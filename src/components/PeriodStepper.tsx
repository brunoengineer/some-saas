import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx, IconButton } from './ui';

/**
 * ◀ label ▶ with a fixed-width label, so the arrows never move when the text
 * changes length ("1–7 Nov" vs "28 Dec 2026 – 3 Jan 2027"). Sized for the
 * longest label of its kind; anything longer is truncated with a tooltip.
 */
export function PeriodStepper({
  label,
  onPrev,
  onNext,
  nextDisabled,
  size = 'week',
  overlay,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  /** 'week' fits a week that spans two years; 'month' fits a month or short range. */
  size?: 'week' | 'month';
  /** e.g. an invisible date input laid over the label to jump to a date. */
  overlay?: ReactNode;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <IconButton label="Previous period" onClick={onPrev}>
        <ChevronLeft size={18} />
      </IconButton>
      <span
        title={label}
        className={cx(
          'tabular relative inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface px-3 text-[13.5px] font-medium',
          size === 'week' ? 'w-[250px]' : 'w-[190px]',
        )}
      >
        <span className="truncate">{label}</span>
        {overlay}
      </span>
      <IconButton label="Next period" onClick={onNext} disabled={nextDisabled} className="disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronRight size={18} />
      </IconButton>
    </span>
  );
}
