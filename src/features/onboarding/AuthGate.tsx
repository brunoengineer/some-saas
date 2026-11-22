import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/app/auth';
import { LoadTrouble, SlowSplash, Splash } from '@/components/Splash';
import { Button } from '@/components/ui';
import { firestoreRepo } from '@/data';
import { NewWorkspaceForm } from './NewWorkspaceForm';

/**
 * In the real app (Firebase settings present): sign in with Google, then
 * either the app, first-time setup, or "no access yet". The prototype skips all this.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const db = useSyncExternalStore(
    (l) => firestoreRepo?.subscribe(l) ?? (() => undefined),
    () => firestoreRepo?.get() ?? null,
  );

  if (auth.mode === 'prototype') return <>{children}</>;
  if (auth.status === 'loading') return <Splash text="Loading…" />;
  if (auth.status === 'signedOut') return <SignIn />;
  const errors = firestoreRepo?.loadErrors() ?? [];
  if (errors.some((e) => e.startsWith('workspaces:')))
    return (
      <LoadTrouble
        title="Couldn’t load your workspaces"
        problems={errors}
        hint="Firestore sent an error. If it mentions permissions, publish the rules from firestore.rules (Firestore → Rules → Publish), then reload."
      />
    );
  if (!firestoreRepo?.workspacesLoaded() || auth.ownersClaimed === null) return <SlowSplash text="Loading your workspaces…" />;
  if (db && db.workspaces.length > 0) return <>{children}</>;
  return <FirstRun />;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="mb-5 flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">P</span> Pulse
        </p>
        {children}
      </div>
    </div>
  );
}

function SignIn() {
  const { signIn, error } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Frame>
      <h1 className="text-[22px] font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[14px] text-soft">Social content, KPIs and partnerships in one place. Use the Google account your admin added.</p>
      <Button
        variant="primary"
        className="mt-6 w-full justify-center"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signIn();
          setBusy(false);
        }}
      >
        <GoogleMark /> {busy ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      {error && <p className="mt-3 text-[13px] text-critical-text">{error}</p>}
    </Frame>
  );
}

function FirstRun() {
  const auth = useAuth();
  const user = auth.user!;
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const signOutLink = (
    <button type="button" onClick={() => void auth.signOut()} className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
      <LogOut size={14} aria-hidden /> Sign out ({user.email})
    </button>
  );

  // Very first sign-in on this Firebase project: claim it.
  if (!auth.ownersClaimed) {
    return (
      <Frame>
        <h1 className="text-[22px] font-semibold tracking-tight">Set up Pulse</h1>
        <p className="mt-1 text-[14px] text-soft">
          Nobody owns this installation yet. As the owner, <b>{user.email}</b> can create workspaces and add people to them.
        </p>
        <Button
          variant="primary"
          className="mt-6 w-full justify-center"
          disabled={claiming}
          onClick={async () => {
            setClaiming(true);
            setClaimError('');
            try {
              await auth.claimOwnership();
            } catch (e) {
              setClaimError(`Couldn’t claim it: ${(e as Error).message}. Check that the security rules are published (see the README).`);
            } finally {
              setClaiming(false);
            }
          }}
        >
          {claiming ? 'Setting up…' : 'Make me the owner'}
        </Button>
        {claimError && <p className="mt-3 text-[13px] text-critical-text">{claimError}</p>}
        {signOutLink}
      </Frame>
    );
  }

  if (auth.isOwner) {
    return (
      <Frame>
        <h1 className="text-[22px] font-semibold tracking-tight">Your first workspace</h1>
        <div className="mt-4">
          <NewWorkspaceForm admin={{ id: user.email, name: user.name, email: user.email, role: 'admin', title: 'Owner' }} onCreated={() => undefined} />
        </div>
        {signOutLink}
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-[22px] font-semibold tracking-tight">No access yet</h1>
      <p className="mt-1 text-[14px] text-soft">
        You’re signed in as <b>{user.email}</b>, but no workspace has added this email. Ask an admin to add it in Settings → Members & roles, then reload this page.
      </p>
      {signOutLink}
    </Frame>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className="shrink-0 rounded-sm bg-white p-[1px]">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z" />
    </svg>
  );
}
