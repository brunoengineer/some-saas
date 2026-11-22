import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { format } from 'date-fns';
import { LoadTrouble, SlowSplash } from '@/components/Splash';
import { repo } from '@/data';
import type { DB, Member, Role, Workspace, WsData } from '@/data/types';
import { wsData } from '@/data/wsData';
import { can as canDo, type Action } from '@/lib/permissions';
import { useAuth, type AuthUser } from './auth';

export type ThemePref = 'light' | 'dark' | 'system';

interface Session {
  db: DB;
  data: WsData;
  ws: Workspace;
  member: Member;
  /** The role in use: the member's own, or a lower one picked in "View as". */
  role: Role;
  /** The member's own role in this workspace. */
  realRole: Role;
  /** The signed-in Google account (null in the prototype). */
  user: AuthUser | null;
  /** Today as 'yyyy-MM-dd' (local time). */
  today: string;
  setWsId: (id: string) => void;
  setRole: (r: Role) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  dark: boolean;
  can: (a: Action) => boolean;
}

const Ctx = createContext<Session | null>(null);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
};

export function useDb(): DB {
  return useSyncExternalStore(repo.subscribe, repo.get);
}

/** Lower number = more permissions. "View as" can only pick an equal or lower role. */
const RANK: Record<Role, number> = { admin: 0, manager: 1, viewer: 2 };

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const auth = useAuth();
  const [wsIdPref, setWsIdState] = useState(() => read('pulse-ws'));
  const wsId = db.workspaces.some((w) => w.id === wsIdPref) ? wsIdPref! : (db.workspaces[0]?.id ?? '');
  useEffect(() => {
    if (wsId) repo.setWorkspace?.(wsId);
  }, [wsId]);
  const [role, setRoleState] = useState<Role>(() => (read('pulse-role') as Role) || 'admin');
  const [theme, setThemeState] = useState<ThemePref>(() => (read('pulse-theme') as ThemePref) || 'system');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const ready = !!wsId && repo.isReady();
  const data = useMemo(() => (ready ? wsData(db, wsId) : null), [db, wsId, ready]);
  const ws = data?.ws ?? null;

  useEffect(() => {
    if (!ws) return;
    document.documentElement.style.setProperty('--accent', ws.accent);
    document.title = `${ws.name} · Pulse`;
  }, [ws?.accent, ws?.name]); // eslint-disable-line react-hooks/exhaustive-deps


  const signedIn = auth.mode === 'firebase' ? auth.user : null;
  // Real app: you are the member with your Google email. Prototype: "View as" picks a sample member.
  const own = useMemo<Member | null>(() => {
    if (!ws) return null;
    if (signedIn) return ws.members.find((m) => m.email.toLowerCase() === signedIn.email) ?? { id: signedIn.email, name: signedIn.name, email: signedIn.email, role: 'viewer', title: '' };
    return null;
  }, [ws, signedIn]);
  const realRole: Role = own ? own.role : 'admin';
  const effectiveRole: Role = RANK[role] >= RANK[realRole] ? role : realRole;
  const member = useMemo<Member>(() => {
    if (own) return own;
    return (
      ws?.members.find((m) => m.role === effectiveRole) ?? {
        id: `demo-${effectiveRole}`,
        name: `Demo ${effectiveRole}`,
        email: '',
        role: effectiveRole,
        title: 'Preview',
      }
    );
  }, [own, ws, effectiveRole]);

  const setWsId = useCallback((id: string) => {
    write('pulse-ws', id);
    setWsIdState(id);
  }, []);
  const setRole = useCallback((r: Role) => {
    write('pulse-role', r);
    setRoleState(r);
  }, []);
  const setTheme = useCallback((t: ThemePref) => {
    write('pulse-theme', t);
    setThemeState(t);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const loadErrors = repo.loadErrors?.() ?? [];
  if (loadErrors.length)
    return (
      <LoadTrouble
        title="Couldn’t load the workspace"
        problems={loadErrors}
        hint={
          loadErrors.some((e) => e.includes('permission'))
            ? 'Firestore refused to send the data. Check that the rules from firestore.rules are published (Firestore → Rules → Publish), then reload.'
            : 'Firestore sent an error. Reload to try again; if it keeps happening, send these lines to whoever set up Pulse.'
        }
      />
    );
  if (!data || !ws) return <SlowSplash text={wsId ? 'Loading the workspace…' : 'Loading…'} waitingFor={() => repo.pendingCollections?.() ?? []} />;
  const value: Session = {
    db,
    data,
    ws,
    member,
    role: effectiveRole,
    realRole,
    user: signedIn,
    today,
    setWsId,
    setRole,
    theme,
    setTheme,
    dark,
    can: (a) => canDo(effectiveRole, a, ws.settings),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** Display name for a member id (or the scheduler). */
export function useMemberName() {
  const { ws } = useSession();
  return (id: string | null) => {
    if (!id) return 'Unassigned';
    if (id === 'scheduler') return 'Auto report';
    return ws.members.find((m) => m.id === id)?.name ?? 'Former member';
  };
}
