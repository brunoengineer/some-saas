import type { Collection, DB, Workspace } from '@/data/types';

export const RECORD_COLLECTIONS = ['posts', 'campaigns', 'partners', 'deliverables', 'kpis', 'kpiEntries', 'stats', 'comments', 'reports', 'activity'] as const satisfies readonly Collection[];

/** Read a Pulse backup file (the JSON from Settings → Data). Throws a readable error if it isn't one. */
export function parseBackup(text: string): DB {
  let db: unknown;
  try {
    db = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const d = db as Partial<DB>;
  if (!d || !Array.isArray(d.workspaces) || !d.workspaces.length || !Array.isArray(d.posts)) throw new Error('That file isn’t a Pulse backup.');
  for (const c of RECORD_COLLECTIONS) if (!Array.isArray(d[c])) (d as Record<string, unknown>)[c] = [];
  return d as DB;
}

/**
 * Copy one workspace from a backup into another: every record gets the target's
 * id. The target keeps its name, accent and members; it takes the source's
 * platforms, pillars, checklist, milestones and manager options.
 */
export function copyWorkspace(backup: DB, sourceId: string, target: Workspace) {
  const src = backup.workspaces.find((w) => w.id === sourceId);
  if (!src) throw new Error('That workspace isn’t in the backup.');
  const ws: Workspace = {
    ...target,
    platforms: src.platforms,
    pillars: src.pillars,
    checklist: src.checklist,
    annotations: src.annotations,
    settings: src.settings,
    weekStartsOn: src.weekStartsOn,
    timezone: src.timezone,
  };
  const records = RECORD_COLLECTIONS.map((c) => ({
    collection: c,
    items: (backup[c] as { wsId: string }[]).filter((x) => x.wsId === sourceId).map((x) => ({ ...x, wsId: target.id })),
  })).filter((r) => r.items.length);
  const count = records.reduce((n, r) => n + r.items.length, 0);
  return { ws, records, count };
}

/** One workspace's records in the backup format (so it can be imported again). */
export function exportWorkspace(db: DB, wsId: string): DB {
  const out = { version: db.version, workspaces: db.workspaces.filter((w) => w.id === wsId) } as DB;
  for (const c of RECORD_COLLECTIONS) (out as unknown as Record<string, unknown>)[c] = (db[c] as { wsId: string }[]).filter((x) => x.wsId === wsId);
  return out;
}
