import { format } from 'date-fns';
import type { Comparator, KpiTarget, KpiUnit, Platform } from '@/data/types';
import { toDate } from './period';

export function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toLocaleString('en-US');
}

export const num = (n: number) => Math.round(n).toLocaleString('en-US');

export function money(n: number, digits = 0) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function minutes(v: number) {
  const m = Math.round(v);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function formatValue(unit: KpiUnit, v: number | null | undefined, opts: { signed?: boolean } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = opts.signed && v > 0 ? '+' : '';
  switch (unit) {
    case 'percent':
      return `${sign}${v.toFixed(1)}%`;
    case 'minutes':
      return minutes(v);
    case 'currency':
      return `${sign}${money(v)}`;
    case 'number':
      return `${sign}${compact(v)}`;
  }
}

export interface Delta {
  text: string;
  dir: 'up' | 'down' | 'flat';
}

/** Change vs a previous value: percentage points for rates, % change otherwise. */
export function formatDelta(unit: KpiUnit, v: number | null, prev: number | null): Delta | null {
  if (v === null || prev === null) return null;
  const diff = v - prev;
  const dir = Math.abs(diff) < 1e-9 ? 'flat' : diff > 0 ? 'up' : 'down';
  if (unit === 'percent') return { text: `${Math.abs(diff).toFixed(1)} pts`, dir };
  if (prev === 0) return { text: diff === 0 ? '0%' : 'new', dir };
  return { text: `${Math.round(Math.abs(diff / prev) * 100)}%`, dir };
}

const CMP: Record<Comparator, string> = { gte: '≥', lte: '≤', growth: '' };

export function targetLabel(unit: KpiUnit, t: KpiTarget | null) {
  if (!t) return 'No target';
  if (t.comparator === 'growth') return t.note || 'Growing period on period';
  return `${CMP[t.comparator]} ${formatValue(unit, t.value)}${t.by ? ` by ${shortDate(t.by)}` : ''}`;
}

export const shortDate = (d: string) => format(toDate(d), 'd MMM');
export const dayLabel = (d: string) => format(toDate(d), 'EEE d MMM');
export const longDate = (d: string) => format(toDate(d), 'd MMM yyyy');
export const timeOf = (dt: string | null) => (dt && dt.length > 10 ? dt.slice(11, 16) : '');

export function dateTimeLabel(dt: string) {
  return `${format(toDate(dt), 'EEE d MMM')}${dt.length > 10 ? ` · ${dt.slice(11, 16)}` : ''}`;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: 'X',
  discord: 'Discord',
  telegram: 'Telegram',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  kick: 'Kick',
};

export const PLATFORM_SHORT: Record<Platform, string> = {
  x: 'X',
  discord: 'DC',
  telegram: 'TG',
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  linkedin: 'IN',
  kick: 'KI',
};

/** Character limits for the caption counter. */
/** A user-typed link, only if it's a web address (never `javascript:` and the like). */
export const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : null);

export const PLATFORM_LIMIT: Partial<Record<Platform, number>> = {
  x: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  telegram: 4096,
  discord: 2000,
  youtube: 5000,
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
