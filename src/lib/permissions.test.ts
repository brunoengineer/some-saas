import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { BLOOM } from '@/data/seed/bloom';
import { wsData } from '@/data/wsData';
import { kpiValue } from './metrics';
import { periodFor } from './period';
import { can, canEditPost } from './permissions';
import { dueRuns } from './scheduler';

const settings = { managersCanDraft: false, managersCanApprove: true };

describe('roles', () => {
  it('admin can do everything', () => {
    for (const a of ['comment', 'approve', 'edit', 'kpi.enter', 'report.generate', 'report.edit', 'settings'] as const) expect(can('admin', a, settings)).toBe(true);
  });
  it('manager can see, comment and approve, not edit', () => {
    expect(can('manager', 'comment', settings)).toBe(true);
    expect(can('manager', 'approve', settings)).toBe(true);
    expect(can('manager', 'edit', settings)).toBe(false);
    expect(can('manager', 'settings', settings)).toBe(false);
    expect(can('manager', 'approve', { ...settings, managersCanApprove: false })).toBe(false);
  });
  it('managers may draft only when allowed, and only ideas/drafts', () => {
    expect(canEditPost('manager', settings, { status: 'draft' })).toBe(false);
    const allow = { ...settings, managersCanDraft: true };
    expect(canEditPost('manager', allow, { status: 'draft' })).toBe(true);
    expect(canEditPost('manager', allow, { status: 'scheduled' })).toBe(false);
  });
  it('viewer is read-only but can export', () => {
    expect(can('viewer', 'comment', settings)).toBe(false);
    expect(can('viewer', 'edit', settings)).toBe(false);
    expect(can('viewer', 'report.export', settings)).toBe(true);
    expect(canEditPost('viewer', settings, null)).toBe(false);
  });
});

describe('second workspace (Bloom)', () => {
  const d = wsData(buildSeed(), BLOOM);
  it('keeps data separate and calculates its own KPIs', () => {
    expect(d.posts.every((p) => p.wsId === BLOOM)).toBe(true);
    const week = periodFor('week', '2026-11-18');
    const er = kpiValue(d.kpis.find((k) => k.id === 'b-er')!, d, week).value;
    expect(er).not.toBeNull();
    expect(er!).toBeGreaterThan(4);
    expect(kpiValue(d.kpis.find((k) => k.id === 'b-netf')!, d, week).value).toBe(134);
  });
  it('respects the weekly schedule being off', () => {
    expect(dueRuns(d.ws, new Date(2026, 10, 23, 10, 0))).toEqual([]);
  });
});
