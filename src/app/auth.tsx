import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestoreRepo } from '@/data';
import { firebaseAuth, firestore } from '@/firebase/app';

export interface AuthUser {
  email: string;
  name: string;
  photo: string | null;
}

interface Auth {
  /** 'prototype': no Firebase settings, sample data in this browser, no sign-in. */
  mode: 'prototype' | 'firebase';
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  /** Owners may create workspaces. null while loading. */
  isOwner: boolean | null;
  /** False until someone has claimed this installation (the very first sign-in). */
  ownersClaimed: boolean | null;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** First sign-in only: become the owner of this installation. */
  claimOwnership: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

const toUser = (u: User): AuthUser => ({ email: (u.email ?? '').toLowerCase(), name: u.displayName || (u.email ?? '').split('@')[0], photo: u.photoURL });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Auth['status']>(firebaseAuth ? 'loading' : 'signedIn');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [owners, setOwners] = useState<string[] | null>(null);
  const [ownersClaimed, setOwnersClaimed] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (u) => {
      if (u && u.email && u.emailVerified) {
        const au = toUser(u);
        setUser(au);
        setStatus('signedIn');
        firestoreRepo?.start(au.email);
      } else {
        setUser(null);
        setStatus('signedOut');
        firestoreRepo?.stop();
      }
    });
  }, []);

  // Who owns this installation (may create workspaces).
  useEffect(() => {
    if (!firestore || !user) return;
    return onSnapshot(
      doc(firestore, 'meta', 'owners'),
      (snap) => {
        setOwnersClaimed(snap.exists());
        setOwners((snap.data()?.emails as string[] | undefined) ?? []);
      },
      () => {
        setOwnersClaimed(null);
        setOwners([]);
      },
    );
  }, [user]);

  const value = useMemo<Auth>(
    () => ({
      mode: firebaseAuth ? 'firebase' : 'prototype',
      status,
      user,
      isOwner: firebaseAuth ? (owners === null || !user ? null : owners.includes(user.email)) : true,
      ownersClaimed: firebaseAuth ? ownersClaimed : true,
      error,
      async signIn() {
        if (!firebaseAuth) return;
        setError('');
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(firebaseAuth, provider);
        } catch (e) {
          const code = (e as { code?: string }).code ?? '';
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          if (code === 'auth/popup-blocked') setError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.');
          else if (code === 'auth/unauthorized-domain') setError('This address isn’t allowed to sign in yet. Add it in Firebase: Authentication → Settings → Authorized domains.');
          else setError(`Sign-in failed: ${(e as Error).message}`);
        }
      },
      async signOut() {
        if (firebaseAuth) await fbSignOut(firebaseAuth);
      },
      async claimOwnership() {
        if (!firestore || !user) return;
        await setDoc(doc(firestore, 'meta', 'owners'), { emails: [user.email] });
      },
    }),
    [status, user, owners, ownersClaimed, error],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}
