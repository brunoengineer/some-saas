import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import { Avatar, Button, Card, cx, Field, IconButton, Input, PageHeader, Segmented, Select, Toggle } from '@/components/ui';
import { repo } from '@/data';
import type { DB, Member, Platform, Role, Workspace } from '@/data/types';
import { copyWorkspace, exportWorkspace, parseBackup } from '@/lib/backup';
import { useAuth } from '@/app/auth';
import { download } from '@/lib/csv';
import { dateTimeLabel, PLATFORM_LABEL } from '@/lib/format';
import { PERMISSION_ROWS, ROLE_HELP, ROLE_LABEL } from '@/lib/permissions';
import { iso } from '@/lib/period';
import { ImportPanel } from './ImportPanel';

type Tab = 'workspace' | 'members' | 'import' | 'audit' | 'data';
const ALL: Platform[] = ['x', 'instagram', 'tiktok', 'discord', 'telegram', 'youtube', 'linkedin', 'kick'];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'workspace';
  const { can } = useSession();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" subtitle={can('settings') ? 'Workspace, people and data.' : 'Only admins can change settings. You can look around.'} />
      <Segmented
        label="Settings section"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        options={[
          { value: 'workspace', label: 'Workspace' },
          { value: 'members', label: 'Members & roles' },
          { value: 'import', label: 'Import' },
          { value: 'audit', label: 'Audit log' },
          { value: 'data', label: 'Data' },
        ]}
      />
      {tab === 'workspace' && <WorkspaceSettings />}
      {tab === 'members' && <Members />}
      {tab === 'import' && <ImportPanel />}
      {tab === 'audit' && <Audit />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

function WorkspaceSettings() {
  const { ws, can } = useSession();
  const actions = useActions();
  const [w, setW] = useState<Workspace>(ws);
  const [newItem, setNewItem] = useState('');
  const set = <K extends keyof Workspace>(k: K, v: Workspace[K]) => setW({ ...w, [k]: v });
  const dirty = JSON.stringify(w) !== JSON.stringify(ws);
  const disabled = !can('settings');

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-3">
      <Card title="Brand">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Workspace name">
            <Input value={w.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Tagline">
            <Input value={w.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="Initials (logo)">
            <Input value={w.initials} maxLength={2} onChange={(e) => set('initials', e.target.value.toUpperCase())} />
          </Field>
          <Field label="Accent color" hint="Used for the menu, buttons, report headers and the PPTX export.">
            <span className="flex items-center gap-2">
              <input type="color" value={w.accent} onChange={(e) => set('accent', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line bg-surface" aria-label="Accent color" />
              <Input value={w.accent} onChange={(e) => set('accent', e.target.value)} className="w-32 font-mono" />
            </span>
          </Field>
          <Field label="Timezone">
            <Input value={w.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Weeks start on">
            <Select value={w.weekStartsOn} onChange={(e) => set('weekStartsOn', Number(e.target.value) as 0 | 1)}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Field>
        </div>
      </Card>
      <Card title="Platforms">
        <div className="flex flex-wrap gap-2">
          {ALL.map((p) => {
            const on = w.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => set('platforms', on ? w.platforms.filter((x) => x !== p) : [...w.platforms, p])}
                className={cx('rounded-lg border px-3 py-1.5 text-[13px]', on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-soft')}
              >
                {PLATFORM_LABEL[p]}
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Content pillars">
        <p className="text-[13.5px] text-soft">
          Pillars, their colors and the target mix now live on their own page, next to how each one performs.{' '}
          <Link to="/pillars" className="font-medium text-accent-strong hover:underline">
            Open Pillars
          </Link>
        </p>
      </Card>
      <Card title="Pre-publish checklist" subtitle="Shown on every post. Use it for compliance: age lines, #ad labels, T&Cs.">
        <div className="flex flex-col gap-2">
          {w.checklist.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={c} aria-label={`Checklist item ${i + 1}`} onChange={(e) => set('checklist', w.checklist.map((x, j) => (j === i ? e.target.value : x)))} />
              <IconButton label="Remove item" onClick={() => set('checklist', w.checklist.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newItem.trim()) set('checklist', [...w.checklist, newItem.trim()]);
              setNewItem('');
            }}
          >
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" aria-label="New checklist item" />
            <Button type="submit">Add</Button>
          </form>
        </div>
      </Card>
      {!disabled && (
        <div className="sticky bottom-3 flex justify-end gap-2">
          <Button disabled={!dirty} onClick={() => setW(ws)}>
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty || !w.name.trim()} onClick={() => actions.saveWorkspace(w, 'workspace settings')}>
            Save changes
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function Members() {
  const { ws, can, member, user } = useSession();
  const actions = useActions();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const admins = ws.members.filter((m) => m.role === 'admin').length;
  const disabled = !can('settings');

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
      <Card title="Members" subtitle="People sign in with Google. Admins set their role per workspace.">
        <ul className="flex flex-col divide-y divide-line">
          {ws.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Avatar name={m.name} size={34} />
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] font-medium">
                  {m.name} {m.id === member.id && <span className="font-normal text-muted">(you)</span>}
                </b>
                <span className="block truncate text-[12.5px] text-muted">
                  {m.title} · {m.email}
                </span>
              </span>
              <Select
                aria-label={`Role for ${m.name}`}
                value={m.role}
                disabled={disabled || (m.role === 'admin' && admins === 1) || (!!user && m.email.toLowerCase() === user.email)}
                title={user && m.email.toLowerCase() === user.email ? 'Another admin can change your role' : undefined}
                onChange={(e) => actions.saveWorkspace({ ...ws, members: ws.members.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Role } : x)) }, `${m.name}’s role`)}
                className="w-32"
              >
                {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              {!disabled && m.role !== 'admin' && (
                <IconButton label={`Remove ${m.name}`} onClick={() => window.confirm(`Remove ${m.name} from ${ws.name}?`) && actions.saveWorkspace({ ...ws, members: ws.members.filter((x) => x.id !== m.id) }, `removed ${m.name}`)}>
                  <Trash2 size={15} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        {!disabled && (
          <form
            className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_128px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const em = email.trim().toLowerCase();
              if (!/^\S+@\S+\.\S+$/.test(em)) return setError('Enter a full email address.');
              if (ws.members.some((m) => m.email.toLowerCase() === em)) return setError('That email is already a member.');
              const m: Member = { id: em, name: name.trim() || em.split('@')[0], email: em, role, title: '' };
              actions.saveWorkspace({ ...ws, members: [...ws.members, m] }, `added ${em} as ${ROLE_LABEL[role].toLowerCase()}`);
              setEmail('');
              setName('');
              setError('');
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="New member name" />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" aria-label="New member email" />
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="New member role">
              {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary">
              Add member
            </Button>
            {error && <p className="text-[12.5px] text-critical-text sm:col-span-4">{error}</p>}
            <p className="text-[12px] text-muted sm:col-span-4">They get in the first time they sign in with Google using this email. Nothing is emailed to them: send them the link yourself.</p>
          </form>
        )}
      </Card>
      <div className="flex flex-col gap-3">
        <Card title="What each role can do">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="border-b border-line py-1.5 font-medium" />
                  {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
                    <th key={r} className="border-b border-line px-2 py-1.5 text-center font-medium">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-line/70 last:border-0">
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td className="px-2 text-center">{r.admin}</td>
                    <td className="px-2 text-center">{r.manager}</td>
                    <td className="px-2 text-center">{r.viewer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-muted">
            {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
              <li key={r}>
                <b className="text-soft">{ROLE_LABEL[r]}:</b> {ROLE_HELP[r]}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Manager options">
          <div className="flex flex-col gap-3">
            <Toggle disabled={disabled} checked={ws.settings.managersCanApprove} onChange={(v) => actions.saveWorkspace({ ...ws, settings: { ...ws.settings, managersCanApprove: v } }, 'manager approvals')} label="Managers can approve or request changes on posts" />
            <Toggle disabled={disabled} checked={ws.settings.managersCanDraft} onChange={(v) => actions.saveWorkspace({ ...ws, settings: { ...ws.settings, managersCanDraft: v } }, 'manager drafting')} label="Managers can create and edit ideas and drafts" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Audit() {
  const { data } = useSession();
  const name = useMemberName();
  const list = [...data.activity].sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <Card title="Audit log" subtitle="Who changed what in this workspace">
      {list.length === 0 && <p className="text-[13px] text-muted">Nothing yet.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {list.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 py-2 text-[13.5px]">
            <span className="tabular w-36 shrink-0 text-[12.5px] text-muted">{dateTimeLabel(a.at)}</span>
            <span className="min-w-0 flex-1">
              <b className="font-medium">{name(a.actorId)}</b> {a.text}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DataTab() {
  const { db, ws, can } = useSession();
  const { mode } = useAuth();
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card title="Export" subtitle={mode === 'firebase' ? 'This workspace, as JSON. A backup you can import again.' : 'Everything in this browser, as JSON. Useful as a backup, or to import into the real app.'}>
        <Button
          onClick={() =>
            download(
              `pulse-${mode === 'firebase' ? ws.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'backup'}-${iso(new Date())}.json`,
              JSON.stringify(mode === 'firebase' ? exportWorkspace(db, ws.id) : db, null, 2),
              'application/json',
            )
          }
        >
          Download JSON backup
        </Button>
      </Card>
      {mode === 'firebase' ? (
        <ImportBackup />
      ) : (
        <Card title="Reset sample data" subtitle="Restores the Flush and Bloom sample workspaces. Your changes in this browser are lost.">
          <Button
            variant="danger"
            disabled={!can('settings')}
            onClick={() => {
              if (window.confirm('Reset all data to the samples? This can’t be undone.')) {
                repo.reset();
                window.location.reload();
              }
            }}
          >
            Reset to sample data
          </Button>
        </Card>
      )}
    </div>
  );
}

/** Real app: copy a workspace from a backup file (e.g. the prototype's) into this one. */
function ImportBackup() {
  const { ws, can } = useSession();
  const actions = useActions();
  const [backup, setBackup] = useState<DB | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const run = async () => {
    if (!backup) return;
    const { ws: next, records, count } = copyWorkspace(backup, source, ws);
    if (!window.confirm(`Copy ${count.toLocaleString()} records into “${ws.name}”? Its platforms, pillars and checklist are replaced; its name and members stay. Records with the same id are overwritten.`)) return;
    try {
      setProgress('Saving the workspace settings…');
      await repo.upsert('workspaces', next);
      let done = 0;
      for (const r of records) {
        for (let i = 0; i < r.items.length; i += 40) {
          setProgress(`Saving ${r.collection} (${done.toLocaleString()} of ${count.toLocaleString()})…`);
          const chunk = r.items.slice(i, i + 40);
          await repo.upsertMany(r.collection, chunk as never[]);
          done += chunk.length;
        }
      }
      actions.saveWorkspace(next, `imported ${count} records from a backup`);
      setProgress(`Done: ${count.toLocaleString()} records copied.`);
      setBackup(null);
    } catch {
      setProgress('Stopped: some records weren’t saved (see the message at the top).');
    }
  };

  return (
    <Card title="Import from a backup" subtitle="Copy a workspace from a Pulse backup file, for example the prototype’s sample data, into this workspace.">
      <fieldset disabled={!can('settings')} className="flex flex-col gap-3">
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          className="text-[13px]"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setError('');
            setProgress('');
            setBackup(null);
            if (!f) return;
            try {
              const b = parseBackup(await f.text());
              setBackup(b);
              setSource(b.workspaces[0].id);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        {error && <p className="text-[13px] text-critical-text">{error}</p>}
        {backup && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Workspace in the file">
              <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-auto min-w-[200px]">
                {backup.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" disabled={source === ws.id} onClick={() => void run()}>
              Copy into {ws.name}
            </Button>
          </div>
        )}
        {backup && (
          <p className="text-[13px] text-soft">
            {source === ws.id
              ? 'This file is a backup of this same workspace, so there’s nothing new to copy. Choose the prototype’s backup instead.'
              : `In the file: ${(['posts', 'campaigns', 'partners', 'kpis'] as const)
                  .map((c) => `${(backup[c] as { wsId: string }[]).filter((x) => x.wsId === source).length} ${c === 'kpis' ? 'KPIs' : c}`)
                  .join(', ')}.`}
          </p>
        )}
        {progress && <p className="text-[13px] text-soft" role="status">{progress}</p>}
        <p className="text-[12px] text-muted">People in the file who aren’t members here show as “Former member”. The free plan allows 20,000 saves a day; the Flush sample needs about 320.</p>
      </fieldset>
    </Card>
  );
}
