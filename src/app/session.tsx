import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { format } from 'date-fns';
import { repo } from '@/data/mockRepo';
import type { DB, Member, Role, Workspace, WsData } from '@/data/types';
import { wsData } from '@/data/wsData';
import { can as canDo, type Action } from '@/lib/permissions';
import { runScheduler } from '@/lib/scheduler';

export type ThemePref = 'light' | 'dark' | 'system';

interface Session {
  db: DB;
  data: WsData;
  ws: Workspace;
  member: Member;
  role: Role;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [wsId, setWsIdState] = useState(() => read('pulse-ws') ?? db.workspaces[0].id);
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

  const data = useMemo(() => wsData(db, wsId), [db, wsId]);
  const ws = data.ws;

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', ws.accent);
    document.title = `${ws.name} · Pulse`;
  }, [ws.accent, ws.name]);

  // Automatic reports: create any that came due while the app was closed.
  useEffect(() => {
    for (const w of repo.get().workspaces) {
      const res = runScheduler(wsData(repo.get(), w.id), new Date());
      if (!res) continue;
      repo.upsertMany('reports', res.reports);
      repo.upsert('workspaces', res.ws);
      repo.upsertMany(
        'activity',
        res.reports.map((r) => ({
          id: `a-${r.id}`,
          wsId: w.id,
          at: r.createdAt,
          actorId: 'scheduler',
          text: `generated the ${r.type} report “${r.title}”`,
          link: `/reports/${r.id}`,
        })),
      );
    }
  }, []);

  const member = useMemo<Member>(
    () =>
      ws.members.find((m) => m.role === role) ?? {
        id: `demo-${role}`,
        name: `Demo ${role}`,
        email: '',
        role,
        title: 'Preview',
      },
    [ws.members, role],
  );

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
  const value: Session = {
    db,
    data,
    ws,
    member,
    role,
    today,
    setWsId,
    setRole,
    theme,
    setTheme,
    dark,
    can: (a) => canDo(role, a, ws.settings),
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
