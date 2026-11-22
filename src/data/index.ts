import { firestore } from '@/firebase/app';
import { createFirestoreRepo, type FirestoreRepo } from './firestoreRepo';
import { createMockRepo } from './mockRepo';
import type { Repo } from './repo';

/** Firestore when the Firebase settings are present; otherwise the in-browser prototype. */
export const firestoreRepo: FirestoreRepo | null = firestore ? createFirestoreRepo(firestore) : null;
export const repo: Repo = firestoreRepo ?? createMockRepo();
