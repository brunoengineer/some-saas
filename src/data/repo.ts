import type { Collection, DB, Item } from './types';

/**
 * The only way pages read or write data. Phase 0 uses `mockRepo` (seeded data
 * kept in localStorage). Phase 1 adds a `firestoreRepo` with the same shape:
 * `get()` returns a cache kept fresh by onSnapshot listeners, and the writes
 * call setDoc/deleteDoc (security rules enforce the same permissions as
 * `lib/permissions.ts`).
 */
export interface Repo {
  get(): DB;
  subscribe(listener: () => void): () => void;
  upsert<C extends Collection>(collection: C, item: Item<C>): void;
  upsertMany<C extends Collection>(collection: C, items: Item<C>[]): void;
  remove<C extends Collection>(collection: C, id: string): void;
  /** Restore the sample data. */
  reset(): void;
}
