import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { FLUSH } from '@/data/seed/flush';
import { toWorkspaceDoc, fromWorkspaceDoc } from '@/data/firestoreRepo';
import { copyWorkspace, exportWorkspace, parseBackup } from './backup';

const db = buildSeed();
const flush = db.workspaces.find((w) => w.id === FLUSH)!;

describe('backups', () => {
  it('round-trips through JSON', () => {
    const back = parseBackup(JSON.stringify(db));
    expect(back.posts.length).toBe(db.posts.length);
    expect(() => parseBackup('{"hello":1}')).toThrow('isn’t a Pulse backup');
    expect(() => parseBackup('nope')).toThrow('valid JSON');
  });

  it('copies a workspace into another, keeping the target’s name and members', () => {
    const target = { ...flush, id: 'ws-new', name: 'Flush (live)', members: [{ id: 'me@x.com', name: 'Me', email: 'me@x.com', role: 'admin' as const, title: '' }] };
    const { ws, records, count } = copyWorkspace(db, FLUSH, target);
    expect(ws.name).toBe('Flush (live)');
    expect(ws.members).toHaveLength(1);
    expect(ws.pillars).toEqual(flush.pillars);
    expect(records.every((r) => r.items.every((x) => (x as { wsId: string }).wsId === 'ws-new'))).toBe(true);
    expect(count).toBe(exportWorkspace(db, FLUSH).posts.length + records.filter((r) => r.collection !== 'posts').reduce((n, r) => n + r.items.length, 0));
    // The free plan allows 20,000 writes a day: the sample workspace must fit easily.
    expect(count).toBeLessThan(5_000);
  });
});

describe('workspace documents', () => {
  it('list members by role for the security rules, and strip those lists on the way back', () => {
    const d = toWorkspaceDoc(flush);
    expect(d.memberEmails).toHaveLength(flush.members.length);
    expect(d.admins.length + d.managers.length + d.viewers.length).toBe(flush.members.length);
    expect(d.memberEmails.every((e) => e === e.toLowerCase())).toBe(true);
    expect(fromWorkspaceDoc(d as unknown as Record<string, unknown>)).toEqual(flush);
  });
});
