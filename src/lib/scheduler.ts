// Automatic reports. In the prototype this runs when the app opens; in Phase 2
// the same function runs in a scheduled Cloud Function every hour.
import { format, setDate, subDays, subMonths } from 'date-fns';
import type { Report, ScheduleSetting, Workspace, WsData } from '@/data/types';
import { iso, periodFor, type Period } from './period';
import { createReport } from './report';

export interface DueRun {
  kind: 'weekly' | 'monthly';
  runAt: string;
  period: Period;
}

const at = (d: Date, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

/** The most recent scheduled time at or before `now`. */
export function lastSlot(kind: 'weekly' | 'monthly', s: ScheduleSetting, now: Date): Date {
  if (kind === 'weekly') {
    let c = at(now, s.time);
    while (c.getDay() !== s.day || c > now) c = at(subDays(c, 1), s.time);
    return c;
  }
  let c = at(setDate(now, s.day), s.time);
  if (c > now) c = at(setDate(subMonths(now, 1), s.day), s.time);
  return c;
}

export function nextSlot(kind: 'weekly' | 'monthly', s: ScheduleSetting, now: Date): Date {
  const last = lastSlot(kind, s, now);
  const n = new Date(last);
  if (kind === 'weekly') n.setDate(n.getDate() + 7);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

const stamp = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function dueRuns(ws: Workspace, now: Date): DueRun[] {
  const out: DueRun[] = [];
  for (const kind of ['weekly', 'monthly'] as const) {
    const s = ws.schedules[kind];
    if (!s.enabled) continue;
    const slot = lastSlot(kind, s, now);
    if (s.lastRun && stamp(slot) <= s.lastRun) continue;
    // Report on the last complete period before the run.
    const before = iso(subDays(slot, 1));
    out.push({ kind, runAt: stamp(slot), period: periodFor(kind === 'weekly' ? 'week' : 'month', before, ws.weekStartsOn) });
  }
  return out;
}

/** Create the reports that are due; returns them plus the workspace with updated lastRun. */
export function runScheduler(d: WsData, now: Date): { reports: Report[]; ws: Workspace } | null {
  const runs = dueRuns(d.ws, now);
  if (!runs.length) return null;
  const ws: Workspace = { ...d.ws, schedules: { ...d.ws.schedules } };
  const reports = runs.map((r) => {
    ws.schedules[r.kind] = { ...ws.schedules[r.kind], lastRun: r.runAt };
    return createReport(d, {
      type: r.kind,
      period: r.period,
      campaignId: null,
      trigger: 'auto',
      createdBy: 'scheduler',
      now: r.runAt,
    });
  });
  return { reports, ws };
}

export const slotLabel = (d: Date) => format(d, "EEE d MMM yyyy 'at' HH:mm");
