import type { Collection, DB, Item, Post } from './types';

/**
 * The only way pages read or write data. Two implementations with the same shape:
 * - `mockRepo`: the prototype. Sample data kept in this browser (localStorage).
 * - `firestoreRepo`: the real app. `get()` returns a cache kept fresh by
 *   Firestore listeners; writes go to Firestore, whose security rules
 *   (`firestore.rules`) enforce the same permissions as `lib/permissions.ts`.
 */
export interface Repo {
  get(): DB;
  subscribe(listener: () => void): () => void;
  upsert<C extends Collection>(collection: C, item: Item<C>): Promise<void>;
  upsertMany<C extends Collection>(collection: C, items: Item<C>[]): Promise<void>;
  remove<C extends Collection>(collection: C, id: string): Promise<void>;
  /** Prototype only: restore the sample data. */
  reset(): void;
  /** Firestore only: which workspace's records to load. */
  setWorkspace?(wsId: string): void;
  /** True once the chosen workspace's records have arrived (always true in the prototype). */
  isReady(): boolean;
  /** Real app: what failed to load (empty when all is well). */
  loadErrors?(): string[];
  /** Real app: collections of the open workspace still waiting for their first answer. */
  pendingCollections?(): string[];
  /** A post's full image. Uploaded photos are stored apart from the post in Firestore. */
  loadImage(post: Pick<Post, 'id' | 'wsId' | 'image'>): Promise<string | null>;
}

/** Fired with a message when a change could not be saved. The app shows it. */
export const WRITE_ERROR_EVENT = 'pulse:write-error';

export function reportWriteError(message: string) {
  window.dispatchEvent(new CustomEvent(WRITE_ERROR_EVENT, { detail: message }));
}
