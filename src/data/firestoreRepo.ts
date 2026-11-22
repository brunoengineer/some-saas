import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where, writeBatch, type DocumentReference, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { reportWriteError, type Repo } from './repo';
import type { Collection, DB, Item, Post, Workspace } from './types';

/*
 * Firestore layout:
 *   meta/owners                      { emails: [...] }  who may create workspaces
 *   workspaces/{wsId}                the Workspace, plus memberEmails / admins / managers / viewers
 *                                    (lists the security rules can check)
 *   workspaces/{wsId}/{collection}/{id}   posts, campaigns, partners, deliverables, kpis,
 *                                    kpiEntries, stats, comments, reports, activity
 *   workspaces/{wsId}/images/{postId}     { data } the full uploaded photo of a post
 */

export const SUB_COLLECTIONS = ['posts', 'campaigns', 'partners', 'deliverables', 'kpis', 'kpiEntries', 'stats', 'comments', 'reports', 'activity'] as const;
type Sub = (typeof SUB_COLLECTIONS)[number];

/** Uploaded photos bigger than this live in `images/{postId}`, so loading the calendar stays light. */
const INLINE_IMAGE_LIMIT = 20_000;
export const IMAGE_REF = 'fsimg:';
/** Records per batched write; at most 16 writes, under the rules' limit of 20 document reads per request. */
const BATCH_SIZE = 8;

export const emptyDb = (): DB => ({
  version: 0,
  workspaces: [],
  posts: [],
  campaigns: [],
  partners: [],
  deliverables: [],
  kpis: [],
  kpiEntries: [],
  stats: [],
  comments: [],
  reports: [],
  activity: [],
});

/** The workspace as stored: the lists the security rules check are derived from `members`. */
export function toWorkspaceDoc(ws: Workspace) {
  const emails = (role: string) => ws.members.filter((m) => m.role === role).map((m) => m.email.toLowerCase());
  return {
    ...ws,
    memberEmails: ws.members.map((m) => m.email.toLowerCase()),
    admins: emails('admin'),
    managers: emails('manager'),
    viewers: emails('viewer'),
  };
}

export function fromWorkspaceDoc(data: Record<string, unknown>): Workspace {
  const { memberEmails: _m, admins: _a, managers: _g, viewers: _v, ...ws } = data;
  return ws as unknown as Workspace;
}

const friendly = (e: unknown) => {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'permission-denied') return 'Your role doesn’t allow this change, so it wasn’t saved.';
  if (code === 'resource-exhausted') return 'The free plan’s daily limit was reached. Changes will save again tomorrow.';
  if (code === 'invalid-argument' && String((e as Error).message).includes('exceeds the maximum')) return 'That item is too large to save (the image is probably too big).';
  return `Couldn’t save: ${(e as Error).message ?? 'unknown error'}`;
};

export interface FirestoreRepo extends Repo {
  /** Start listening for the signed-in user's workspaces. */
  start(email: string): void;
  stop(): void;
  /** True once the list of workspaces has arrived. */
  workspacesLoaded(): boolean;
  loadErrors(): string[];
  pendingCollections(): string[];
}

export function createFirestoreRepo(fs: Firestore): FirestoreRepo {
  let db: DB = emptyDb();
  let email: string | null = null;
  let wsId: string | null = null;
  let wsLoaded = false;
  const loaded = new Set<Sub>();
  /** Listeners that failed (shown on the loading screen instead of waiting forever). */
  let loadErrors: string[] = [];
  const listeners = new Set<() => void>();
  let unsubWs: Unsubscribe | null = null;
  let unsubData: Unsubscribe[] = [];
  const images = new Map<string, string>();

  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<DB>) => {
    db = { ...db, ...patch };
    emit();
  };

  const refFor = (c: Collection, item: { id: string; wsId?: string }): DocumentReference =>
    c === 'workspaces' ? doc(fs, 'workspaces', item.id) : doc(fs, 'workspaces', item.wsId!, c, item.id);

  /** What gets written for one record (posts: a big photo moves to `images/{postId}`). */
  const prepare = <C extends Collection>(c: C, item: Item<C>) => {
    if (c === 'workspaces') return { data: toWorkspaceDoc(item as Workspace), image: null as null | { ref: DocumentReference; data: string | null } };
    if (c !== 'posts') return { data: item as object, image: null };
    const p = item as Post;
    const before = db.posts.find((x) => x.id === p.id);
    const imgRef = doc(fs, 'workspaces', p.wsId, 'images', p.id);
    if (p.image && p.image.startsWith('data:') && p.image.length > INLINE_IMAGE_LIMIT) {
      const key = `${IMAGE_REF}${p.id}:${Date.now().toString(36)}`;
      images.set(key, p.image);
      return { data: { ...p, image: key }, image: { ref: imgRef, data: p.image } };
    }
    // The photo was removed or replaced by a small one: delete the stored copy.
    if (before?.image?.startsWith(IMAGE_REF) && !p.image?.startsWith(IMAGE_REF)) return { data: p, image: { ref: imgRef, data: null } };
    return { data: p, image: null };
  };

  const write = (op: Promise<unknown>) =>
    op.then(
      () => undefined,
      (e) => {
        reportWriteError(friendly(e));
        throw e;
      },
    );

  const listenWorkspace = (id: string) => {
    unsubData.forEach((u) => u());
    unsubData = [];
    loaded.clear();
    loadErrors = loadErrors.filter((x) => x.startsWith('workspaces:'));
    db = { ...emptyDb(), workspaces: db.workspaces };
    emit();
    for (const c of SUB_COLLECTIONS) {
      unsubData.push(
        onSnapshot(
          collection(fs, 'workspaces', id, c),
          (snap) => {
            loaded.add(c);
            set({ [c]: snap.docs.map((d) => d.data()) } as Partial<DB>);
          },
          (e) => {
            // Usually: you were removed from this workspace while it was open, or the rules aren't published.
            console.error(`Pulse: couldn’t load ${c}`, e);
            loaded.add(c);
            loadErrors = [...loadErrors.filter((x) => !x.startsWith(`${c}:`)), `${c}: ${e.code ?? ''} ${e.message}`.trim()];
            reportWriteError(`Couldn’t load ${c}: ${e.message}`);
            // A new object, so screens waiting on the data redraw.
            set({});
          },
        ),
      );
    }
  };

  return {
    get: () => db,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start(userEmail) {
      if (email === userEmail.toLowerCase() && unsubWs) return;
      this.stop();
      email = userEmail.toLowerCase();
      unsubWs = onSnapshot(
        query(collection(fs, 'workspaces'), where('memberEmails', 'array-contains', email)),
        (snap) => {
          wsLoaded = true;
          set({ workspaces: snap.docs.map((d) => fromWorkspaceDoc(d.data())) });
        },
        (e) => {
          console.error('Pulse: couldn’t load your workspaces', e);
          wsLoaded = true;
          loadErrors = [...loadErrors, `workspaces: ${e.code ?? ''} ${e.message}`.trim()];
          reportWriteError(`Couldn’t load your workspaces: ${e.message}`);
          set({});
        },
      );
    },
    stop() {
      unsubWs?.();
      unsubWs = null;
      unsubData.forEach((u) => u());
      unsubData = [];
      email = null;
      wsId = null;
      wsLoaded = false;
      loaded.clear();
      loadErrors = [];
      images.clear();
      db = emptyDb();
      emit();
    },
    workspacesLoaded: () => wsLoaded,
    setWorkspace(id) {
      if (id === wsId) return;
      wsId = id;
      listenWorkspace(id);
    },
    isReady: () => wsLoaded && (!wsId || loaded.size === SUB_COLLECTIONS.length),
    loadErrors: () => loadErrors,
    pendingCollections: () => (wsId ? SUB_COLLECTIONS.filter((c) => !loaded.has(c)) : []),

    upsert(c, item) {
      const { data, image } = prepare(c, item);
      const ops: Promise<unknown>[] = [];
      if (image) ops.push(image.data === null ? deleteDoc(image.ref) : setDoc(image.ref, { wsId: (item as Post).wsId, data: image.data }));
      ops.push(setDoc(refFor(c, item as { id: string; wsId?: string }), data));
      return write(Promise.all(ops));
    },
    async upsertMany(c, items) {
      // Small batches: the security rules may make only 20 document reads per batch,
      // and each write checks your role with one (a post with a photo is two writes).
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(fs);
        for (const item of items.slice(i, i + BATCH_SIZE)) {
          const { data, image } = prepare(c, item);
          if (image) {
            if (image.data === null) batch.delete(image.ref);
            else batch.set(image.ref, { wsId: (item as Post).wsId, data: image.data });
          }
          batch.set(refFor(c, item as { id: string; wsId?: string }), data);
        }
        await write(batch.commit());
      }
    },
    remove(c, id) {
      const item = (db[c] as { id: string; wsId?: string }[]).find((x) => x.id === id);
      if (!item) return Promise.resolve();
      const ops: Promise<unknown>[] = [deleteDoc(refFor(c, item))];
      if (c === 'posts' && (item as Post).image?.startsWith(IMAGE_REF)) ops.push(deleteDoc(doc(fs, 'workspaces', item.wsId!, 'images', id)));
      return write(Promise.all(ops));
    },
    reset() {
      throw new Error('Reset only exists in the prototype.');
    },
    async loadImage(post) {
      if (!post.image) return null;
      if (!post.image.startsWith(IMAGE_REF)) return post.image;
      const hit = images.get(post.image);
      if (hit) return hit;
      const owner = post.image.slice(IMAGE_REF.length).split(':')[0] || post.id;
      const snap = await getDoc(doc(fs, 'workspaces', post.wsId, 'images', owner));
      const data = (snap.data()?.data as string | undefined) ?? null;
      if (data) images.set(post.image, data);
      return data;
    },
  };
}
