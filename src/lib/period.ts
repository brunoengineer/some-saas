import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns';

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/** An inclusive date range, as 'yyyy-MM-dd' strings. */
export interface Period {
  type: PeriodType;
  start: string;
  end: string;
}

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');
export const toDate = (s: string) => parseISO(s.slice(0, 10));
export const isIsoDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s));
export const addDaysIso = (s: string, n: number) => iso(addDays(toDate(s), n));

export function periodFor(type: PeriodType, anchor: string, weekStartsOn: 0 | 1 = 1): Period {
  const d = toDate(anchor);
  switch (type) {
    case 'day':
      return { type, start: iso(d), end: iso(d) };
    case 'week':
      return { type, start: iso(startOfWeek(d, { weekStartsOn })), end: iso(endOfWeek(d, { weekStartsOn })) };
    case 'month':
      return { type, start: iso(startOfMonth(d)), end: iso(endOfMonth(d)) };
    case 'quarter':
      return { type, start: iso(startOfQuarter(d)), end: iso(endOfQuarter(d)) };
    case 'year':
      return { type, start: iso(startOfYear(d)), end: iso(endOfYear(d)) };
    case 'custom':
      return { type, start: iso(d), end: iso(d) };
  }
}

export function lengthInDays(p: Period) {
  return differenceInCalendarDays(toDate(p.end), toDate(p.start)) + 1;
}

/** Step a period forward or back by its own size. */
export function shiftPeriod(p: Period, dir: 1 | -1, weekStartsOn: 0 | 1 = 1): Period {
  const s = toDate(p.start);
  switch (p.type) {
    case 'day':
      return periodFor('day', iso(addDays(s, dir)), weekStartsOn);
    case 'week':
      return periodFor('week', iso(addDays(s, 7 * dir)), weekStartsOn);
    case 'month':
      return periodFor('month', iso(addMonths(s, dir)), weekStartsOn);
    case 'quarter':
      return periodFor('quarter', iso(addQuarters(s, dir)), weekStartsOn);
    case 'year':
      return periodFor('year', iso(addYears(s, dir)), weekStartsOn);
    case 'custom': {
      const n = lengthInDays(p) * dir;
      return { type: 'custom', start: addDaysIso(p.start, n), end: addDaysIso(p.end, n) };
    }
  }
}

export const previousPeriod = (p: Period, weekStartsOn: 0 | 1 = 1) => shiftPeriod(p, -1, weekStartsOn);

export function rangeLabel(start: string, end: string) {
  const a = toDate(start);
  const b = toDate(end);
  if (start === end) return format(a, 'EEE d MMM yyyy');
  if (format(a, 'yyyy') !== format(b, 'yyyy')) return `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`;
  if (format(a, 'MM') !== format(b, 'MM')) return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`;
  return `${format(a, 'd')}–${format(b, 'd MMM yyyy')}`;
}

export function periodLabel(p: Period) {
  const s = toDate(p.start);
  switch (p.type) {
    case 'day':
      return format(s, 'EEE d MMM yyyy');
    case 'week':
      return `Week of ${rangeLabel(p.start, p.end)}`;
    case 'month':
      return format(s, 'MMMM yyyy');
    case 'quarter':
      return `Q${format(s, 'Q yyyy')}`;
    case 'year':
      return format(s, 'yyyy');
    case 'custom':
      return rangeLabel(p.start, p.end);
  }
}

export const comparedLabel: Record<PeriodType, string> = {
  day: 'vs previous day',
  week: 'vs previous week',
  month: 'vs previous month',
  quarter: 'vs previous quarter',
  year: 'vs previous year',
  custom: 'vs previous period',
};

export function inPeriod(date: string | null | undefined, p: Period) {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= p.start && d <= p.end;
}

export function overlaps(start: string, end: string, p: Period) {
  return start <= p.end && end >= p.start;
}

export function eachDay(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.start; d <= p.end; d = addDaysIso(d, 1)) out.push(d);
  return out;
}

/** Monday-start weeks between two dates (inclusive), as their start dates. */
export function weekStarts(start: string, end: string, weekStartsOn: 0 | 1 = 1): string[] {
  const out: string[] = [];
  let w = periodFor('week', start, weekStartsOn).start;
  while (w <= end) {
    out.push(w);
    w = addDaysIso(w, 7);
  }
  return out;
}

export function monthStarts(start: string, end: string): string[] {
  const out: string[] = [];
  let m = startOfMonth(toDate(start));
  while (iso(m) <= end) {
    out.push(iso(m));
    m = addMonths(m, 1);
  }
  return out;
}

export const monthEnd = (s: string) => iso(endOfMonth(toDate(s)));

/** The `n` periods ending with `last`, oldest first (same type as `last`). */
export function periodsEnding(last: Period, n: number, weekStartsOn: 0 | 1 = 1): Period[] {
  const out = [last];
  for (let i = 1; i < n; i++) out.unshift(shiftPeriod(out[0], -1, weekStartsOn));
  return out;
}
