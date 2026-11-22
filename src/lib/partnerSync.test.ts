import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import type { Deliverable, Post } from '@/data/types';
import { partnerDeliverableFor } from './partnerSync';

const db = buildSeed();
const [p1, p2] = db.partners.filter((p) => p.wsId === db.posts[0].wsId);
const post: Post = { ...db.posts[0], id: 'post-test', title: 'Collab clip', partnerId: p1.id, date: '2026-12-03T18:00', format: 'video', platform: 'x', campaignId: null };
let n = 0;
const id = () => `d-test-${++n}`;

describe('a post with a partner', () => {
  it('creates a deliverable with the same title on that partner', () => {
    const r = partnerDeliverableFor(post, db.partners, [], '2026-11-22', id)!;
    expect(r.created).toBe(true);
    expect(r.deliverable).toMatchObject({ partnerId: p1.id, title: 'Collab clip', due: '2026-12-03', kind: 'video', platform: 'x', postId: 'post-test', delivered: null });
  });

  it('keeps it in sync instead of adding a second one', () => {
    const first = partnerDeliverableFor(post, db.partners, [], '2026-11-22', id)!.deliverable;
    const renamed = partnerDeliverableFor({ ...post, title: 'Collab clip v2' }, db.partners, [first], '2026-11-22', id)!;
    expect(renamed.created).toBe(false);
    expect(renamed.deliverable).toMatchObject({ id: first.id, title: 'Collab clip v2' });
    expect(partnerDeliverableFor(post, db.partners, [first], '2026-11-22', id)).toBeNull();
  });

  it('moves an open deliverable when the partner changes, but leaves delivered ones alone', () => {
    const first = partnerDeliverableFor(post, db.partners, [], '2026-11-22', id)!.deliverable;
    const moved = partnerDeliverableFor({ ...post, partnerId: p2.id }, db.partners, [first], '2026-11-22', id)!;
    expect(moved.deliverable).toMatchObject({ id: first.id, partnerId: p2.id });
    const delivered: Deliverable = { ...first, delivered: '2026-12-03' };
    expect(partnerDeliverableFor({ ...post, title: 'Changed' }, db.partners, [delivered], '2026-11-22', id)).toBeNull();
  });

  it('does nothing without a partner', () => {
    expect(partnerDeliverableFor({ ...post, partnerId: null }, db.partners, [], '2026-11-22', id)).toBeNull();
  });
});
