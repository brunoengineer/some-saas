import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';

/** Full-screen waiting message (signing in, loading a workspace). */
export function Splash({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4" role="status">
      <p className="text-[14px] text-muted">{text}</p>
    </div>
  );
}

/** True once `ms` have passed since the component mounted. */
export function useTookLong(ms: number) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLate(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return late;
}

/** The loading message; after 15 seconds, what is still missing and the likely causes. */
export function SlowSplash({ text, waitingFor }: { text: string; waitingFor?: () => string[] }) {
  const late = useTookLong(15_000);
  if (!late) return <Splash text={text} />;
  const pending = waitingFor?.() ?? [];
  return (
    <LoadTrouble
      title="This is taking longer than it should"
      problems={pending.length ? [`Still waiting for: ${pending.join(', ')}`] : []}
      hint="The browser isn’t getting answers from Firestore. Usual causes: an ad blocker or privacy extension blocking firestore.googleapis.com (allow it for this site), a VPN or company network, or the Firestore database not created yet. Reload after fixing it."
    />
  );
}

/**
 * Loading failed, or is taking far too long: say what is wrong instead of
 * waiting forever, with a way out (reload or sign out).
 */
export function LoadTrouble({ title, problems, hint }: { title: string; problems: string[]; hint: string }) {
  const auth = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[520px] rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8" role="alert">
        <h1 className="text-[18px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] text-soft">{hint}</p>
        {problems.length > 0 && (
          <ul className="mt-4 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[12px] leading-5 text-soft">
            {problems.map((p) => (
              <li key={p} className="break-words">
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-accent px-3.5 py-2 text-[14px] font-medium text-white hover:opacity-90">
            Reload
          </button>
          {auth.mode === 'firebase' && auth.user && (
            <button type="button" onClick={() => void auth.signOut()} className="text-[13px] text-muted hover:text-fg">
              Sign out ({auth.user.email})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
