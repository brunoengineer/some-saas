import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronsUpDown,
  FileText,
  Flag,
  Layers,
  Handshake,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useMemberName, useSession, type ThemePref } from '@/app/session';
import type { Kpi, Platform, Role, Workspace } from '@/data/types';
import { dateTimeLabel, PLATFORM_LABEL } from '@/lib/format';
import { ROLE_HELP, ROLE_LABEL } from '@/lib/permissions';
import { Avatar, Button, cx, Field, IconButton, Input, Modal, useClickOutside } from '@/components/ui';
import { STORAGE_FULL_EVENT } from '@/data/mockRepo';
import { CommandPalette } from './CommandPalette';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/campaigns', label: 'Campaigns', icon: Flag },
  { to: '/pillars', label: 'Pillars', icon: Layers },
  { to: '/partners', label: 'Partners', icon: Handshake },
  { to: '/kpis', label: 'KPIs & Goals', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-content lg:pl-60">
        <Topbar onMenu={() => setMenuOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="app-main mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
          <StorageWarning />
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

/** Shown when browser storage is full (mostly images): changes stay in this tab only until something is removed. */
function StorageWarning() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(true);
    window.addEventListener(STORAGE_FULL_EVENT, on);
    return () => window.removeEventListener(STORAGE_FULL_EVENT, on);
  }, []);
  if (!full) return null;
  return (
    <div role="alert" className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-4 py-3 text-[13.5px]">
      <span className="min-w-0 flex-1">
        <b>Browser storage is full.</b> Your last change works in this tab but will be lost when you close it. Remove a few post images, or reset the sample data in Settings → Data.
      </span>
      <Button size="sm" onClick={() => setFull(false)}>
        Dismiss
      </Button>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <nav
        aria-label="Main"
        className={cx(
          'no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <WorkspaceSwitcher />
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
          <div className="mt-auto pt-3">
            <NavItem to="/settings" label="Settings" icon={Settings} />
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-snug text-muted">
              <b className="block font-semibold text-soft">Prototype</b>
              Sample data, saved in this browser only.
            </p>
          </div>
        </div>
      </nav>
    </>
  );
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
          isActive ? 'bg-accent-soft text-accent-strong' : 'text-soft hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className={isActive ? 'text-accent' : 'text-muted'} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  );
}

function WsMark({ ws, size = 32 }: { ws: Pick<Workspace, 'initials' | 'accent'>; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ width: size, height: size, background: ws.accent, fontSize: size * 0.45 }}>
      {ws.initials}
    </span>
  );
}

function WorkspaceSwitcher() {
  const { db, ws, setWsId } = useSession();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close, open);
  const navigate = useNavigate();

  return (
    <div ref={ref} className="relative border-b border-line p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-2"
      >
        <WsMark ws={ws} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-fg">{ws.name}</span>
          <span className="block truncate text-[12px] text-muted">{ws.tagline}</span>
        </span>
        <ChevronsUpDown size={16} className="text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute inset-x-3 top-full z-50 mt-1 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="px-2 py-1 text-[11.5px] font-medium tracking-wide text-muted uppercase">Workspaces</p>
          {db.workspaces.map((w) => (
            <button
              key={w.id}
              role="menuitem"
              type="button"
              onClick={() => {
                setWsId(w.id);
                setOpen(false);
                navigate('/dashboard');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
            >
              <WsMark ws={w} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{w.name}</span>
              {w.id === ws.id && <Check size={15} className="text-accent" aria-hidden />}
            </button>
          ))}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-line px-2 py-2 text-left text-[13.5px] text-soft hover:bg-surface-2"
          >
            <Plus size={16} aria-hidden /> New workspace (client)
          </button>
        </div>
      )}
      <NewWorkspaceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

const ACCENTS = ['#2563EB', '#EC001F', '#0F766E', '#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#18181B'];
const ALL_PLATFORMS: Platform[] = ['x', 'instagram', 'tiktok', 'discord', 'telegram', 'youtube', 'linkedin', 'kick'];

function NewWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { member, setWsId } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [platforms, setPlatforms] = useState<Platform[]>(['instagram']);

  const create = () => {
    const id = newId('ws');
    const now = new Date().toISOString().slice(0, 16);
    const ws: Workspace = {
      id,
      name: name.trim(),
      tagline: 'Client workspace',
      initials: name.trim().charAt(0).toUpperCase(),
      accent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStartsOn: 1,
      platforms,
      pillars: [
        { id: 'educate', name: 'Educate', color: 1, targetShare: 35 },
        { id: 'entertain', name: 'Entertain', color: 2, targetShare: 30 },
        { id: 'community', name: 'Community', color: 3, targetShare: 20 },
        { id: 'promote', name: 'Promote', color: 4, targetShare: 15 },
      ],
      checklist: ['Brand voice checked', 'Alt text added', 'Paid partnership labelled (#ad)'],
      members: [{ ...member, role: 'admin' }],
      invites: [],
      annotations: [],
      settings: { managersCanDraft: false, managersCanApprove: true },
      schedules: {
        weekly: { enabled: true, day: 1, time: '08:00', lastRun: now },
        monthly: { enabled: true, day: 1, time: '08:00', lastRun: now },
        recipients: [],
      },
      createdAt: now,
    };
    const p = platforms[0] ?? null;
    const base = { wsId: id, direction: 'up' as const, cadence: 'weekly' as const, phase: 'Ongoing', aggregate: 'sum' as const, platform: p };
    const target = (value: number | null, comparator: 'gte' | 'growth') => [{ from: now.slice(0, 10), value, comparator, by: null, note: '' }];
    const kpis: Kpi[] = [
      { ...base, id: `${id}-er`, name: 'Engagement rate', question: 'Is our content working?', unit: 'percent', group: 'weekly', source: 'calc', calc: 'engagementRate', aggregate: 'avg', order: 1, targets: target(3, 'gte') },
      { ...base, id: `${id}-netf`, name: 'Net new followers', question: 'Is our reach growing?', unit: 'number', group: 'weekly', source: 'calc', calc: 'netFollowers', order: 2, targets: target(null, 'growth') },
      { ...base, id: `${id}-clicks`, name: 'Link clicks', question: 'Are we sending people somewhere?', unit: 'number', group: 'weekly', source: 'calc', calc: 'profileClicks', order: 3, targets: target(null, 'growth') },
      { ...base, id: `${id}-posts`, name: 'Posts published', question: 'Are we keeping the rhythm?', unit: 'number', platform: null, group: 'other', source: 'calc', calc: 'postsPublished', order: 4, targets: [] },
    ];
    actions.createWorkspace(ws, kpis);
    setWsId(id);
    onClose();
    setName('');
    navigate('/settings');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New workspace"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || !platforms.length} onClick={create}>
            Create workspace
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">One workspace per brand or client. Posts, KPIs, partners and members are kept separate. It starts with four standard KPIs you can change.</p>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bloom Coffee Co." autoFocus />
        </Field>
        <Field label="Accent color">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Accent ${a}`}
                aria-pressed={a === accent}
                onClick={() => setAccent(a)}
                className={cx('h-8 w-8 rounded-lg ring-offset-2 ring-offset-surface', a === accent && 'ring-2 ring-fg')}
                style={{ background: a }}
              />
            ))}
          </div>
        </Field>
        <Field label="Platforms">
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                  className={cx('rounded-lg border px-2.5 py-1 text-[13px]', on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-soft')}
                >
                  {PLATFORM_LABEL[p]}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { member } = useSession();
  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-3 backdrop-blur sm:px-5">
      <IconButton label="Open menu" onClick={onMenu} className="lg:hidden">
        <Menu size={20} />
      </IconButton>
      <button
        type="button"
        onClick={onSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13.5px] text-muted hover:border-line-strong sm:max-w-sm"
      >
        <Search size={16} aria-hidden />
        <span className="truncate">Search posts, campaigns, partners…</span>
        <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[11px] sm:inline">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <RoleSwitcher />
        <Notifications />
        <ThemeMenu />
        <span className="ml-1 hidden items-center gap-2 sm:flex" title={`${member.name} · ${member.title}`}>
          <Avatar name={member.name} size={30} />
        </span>
      </div>
    </header>
  );
}

function RoleSwitcher() {
  const { role, setRole, member } = useSession();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close, open);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 text-[13px] text-soft hover:bg-surface-2"
        title="Preview the app as another role"
      >
        <span className="hidden text-muted sm:inline">View as</span>
        <b className="font-semibold text-fg">{ROLE_LABEL[role]}</b>
        <ChevronsUpDown size={14} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="px-2 py-1 text-[12px] text-muted">Prototype only: preview permissions. Now acting as {member.name}.</p>
          {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={r === role}
              type="button"
              onClick={() => {
                setRole(r);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
            >
              <Check size={15} className={cx('mt-0.5 shrink-0', r === role ? 'text-accent' : 'invisible')} aria-hidden />
              <span>
                <b className="block text-[13.5px] font-semibold">{ROLE_LABEL[r]}</b>
                <span className="block text-[12px] text-muted">{ROLE_HELP[r]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { data } = useSession();
  const name = useMemberName();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(close, open);
  const items = useMemo(() => [...data.activity].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12), [data.activity]);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(`pulse-seen-${data.ws.id}`) ?? '';
    } catch {
      return '';
    }
  });
  const unread = items.filter((a) => a.at > seen).length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && items[0]) {
      setSeen(items[0].at);
      try {
        localStorage.setItem(`pulse-seen-${data.ws.id}`, items[0].at);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <IconButton label={`Notifications${unread ? ` (${unread} new)` : ''}`} onClick={toggle} className="relative">
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />}
      </IconButton>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[min(360px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="px-2 py-1 text-[12px] font-medium tracking-wide text-muted uppercase">Activity</p>
          {items.length === 0 && <p className="px-2 py-3 text-[13px] text-muted">Nothing yet.</p>}
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                if (a.link) navigate(a.link);
                setOpen(false);
              }}
              className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
            >
              <span className="text-[13px] text-fg">
                <b className="font-semibold">{name(a.actorId)}</b> {a.text}
              </span>
              <span className="text-[11.5px] text-muted">{dateTimeLabel(a.at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useSession();
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <IconButton label={`Theme: ${theme} (click to change)`} onClick={() => setTheme(next[theme])}>
      <Icon size={18} />
    </IconButton>
  );
}
