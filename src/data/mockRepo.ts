import type { Repo } from './repo';
import type { Collection, DB, Item } from './types';
import { buildSeed, SEED_VERSION } from './seed';

const KEY = 'pulse-db';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === SEED_VERSION) return db;
    }
  } catch {
    // Storage blocked or corrupt: fall back to fresh sample data.
  }
  return buildSeed();
}

/** Fired when a change could not be stored (usually: storage full of images). The app shows a warning. */
export const STORAGE_FULL_EVENT = 'pulse:storage-full';

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Private mode or full storage: the app keeps working in memory, but says so.
    window.dispatchEvent(new Event(STORAGE_FULL_EVENT));
  }
}

export function createMockRepo(): Repo {
  let db = load();
  const listeners = new Set<() => void>();

  const commit = (next: DB) => {
    db = next;
    save(db);
    listeners.forEach((l) => l());
  };

  const upsertMany = <C extends Collection>(collection: C, items: Item<C>[]) => {
    if (items.length === 0) return;
    const list = db[collection] as Item<C>[];
    const byId = new Map(items.map((i) => [i.id, i]));
    const next = list.map((x) => (byId.has(x.id) ? byId.get(x.id)! : x));
    const existing = new Set(list.map((x) => x.id));
    for (const i of items) if (!existing.has(i.id)) next.push(i);
    commit({ ...db, [collection]: next });
  };

  return {
    get: () => db,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    upsert: (collection, item) => upsertMany(collection, [item]),
    upsertMany,
    remove(collection, id) {
      const list = db[collection] as { id: string }[];
      commit({ ...db, [collection]: list.filter((x) => x.id !== id) });
    },
    reset() {
      commit(buildSeed());
    },
  };
}

export const repo: Repo = createMockRepo();
