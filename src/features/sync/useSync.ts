import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { reportWriteError } from '@/data/repo';
import type { SyncState } from '@/data/types';
import { firestore } from '@/firebase/app';

/** The sync script checks in every 5 minutes; after this long without news it counts as stopped. */
export const RUNNER_TIMEOUT_MS = 12 * 60_000;

/** Live `workspaces/{id}/sync/state` (null in the prototype, or before anything was synced). */
export function useSyncState(wsId: string): SyncState | null {
  const [state, setState] = useState<SyncState | null>(null);
  useEffect(() => {
    setState(null);
    if (!firestore) return;
    return onSnapshot(
      doc(firestore, 'workspaces', wsId, 'sync', 'state'),
      (snap) => setState((snap.data() as SyncState | undefined) ?? null),
      () => setState(null),
    );
  }, [wsId]);
  return state;
}

/** Redraw every `ms` (for "5 min ago" and the script's online check). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export const runnerOnline = (s: SyncState | null, now: number) => !!s?.runnerSeenAt && now - Date.parse(s.runnerSeenAt) < RUNNER_TIMEOUT_MS;

/** The Update button: ask the sync script to run now. */
export async function requestSync(wsId: string, email: string) {
  if (!firestore) return;
  try {
    await setDoc(
      doc(firestore, 'workspaces', wsId, 'sync', 'state'),
      { id: 'state', wsId, status: 'requested', requestedAt: new Date().toISOString(), requestedBy: email },
      { merge: true },
    );
  } catch (e) {
    reportWriteError(`Couldn’t ask for an update: ${(e as Error).message}`);
  }
}
