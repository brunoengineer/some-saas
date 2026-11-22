import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Platform } from '@/data/types';
import { lastDataDate, type Filters } from '@/lib/metrics';
import { isIsoDate, periodFor, type Period, type PeriodType } from '@/lib/period';
import { useSession } from './session';

const TYPES: PeriodType[] = ['day', 'week', 'month', 'quarter', 'year', 'custom'];

/**
 * Period and platform filter live in the URL (?p=week&d=2026-11-16&platform=x),
 * so a filtered dashboard can be shared as a link.
 */
export function usePeriodFilters() {
  const [params, setParams] = useSearchParams();
  const { data, today, ws } = useSession();

  return useMemo(() => {
    const last = lastDataDate(data);
    const fallback = last && last < today ? last : today;
    const typeParam = params.get('p') as PeriodType | null;
    const type: PeriodType = typeParam && TYPES.includes(typeParam) ? typeParam : 'week';
    const d = params.get('d');
    const anchor = isIsoDate(d) ? d : fallback;

    let period: Period;
    if (type === 'custom') {
      const from = params.get('from');
      const to = params.get('to');
      const start = isIsoDate(from) ? from : periodFor('month', anchor).start;
      const end = isIsoDate(to) && to >= start ? to : anchor >= start ? anchor : start;
      period = { type, start, end };
    } else period = periodFor(type, anchor, ws.weekStartsOn);

    const filters: Filters = {
      platform: (params.get('platform') as Platform | null) || null,
      campaignId: null,
      pillarId: null,
      partnerId: null,
    };
    const compare = params.get('cmp') !== '0';

    const update = (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );

    const setPeriod = (p: Period) =>
      p.type === 'custom'
        ? update({ p: 'custom', from: p.start, to: p.end, d: null })
        : update({ p: p.type, d: p.start, from: null, to: null });

    return { period, filters, compare, update, setPeriod, today: fallback };
  }, [params, setParams, data, today, ws.weekStartsOn]);
}
