import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { buildDeck } from './pptx';

describe('PPTX export', () => {
  it('builds a deck for the week-4 report', async () => {
    const db = buildSeed();
    const report = db.reports.find((r) => r.id === 'r-w4')!;
    const ws = db.workspaces.find((w) => w.id === report.wsId)!;
    const deck = await buildDeck(report, ws);
    const buf = (await deck.write({ outputType: 'nodebuffer' })) as Buffer;
    expect(buf.length).toBeGreaterThan(20_000);
    // .pptx is a zip: starts with "PK".
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    if (process.env.PPTX_OUT) (await import('node:fs')).writeFileSync(process.env.PPTX_OUT, buf);
  });
});
