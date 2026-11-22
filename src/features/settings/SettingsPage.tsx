import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { nowStamp, useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import { Avatar, Badge, Button, Card, cx, Field, IconButton, Input, PageHeader, Segmented, Select, Toggle } from '@/components/ui';
import { repo } from '@/data/mockRepo';
import type { Platform, Role, Workspace } from '@/data/types';
import { download } from '@/lib/csv';
import { dateTimeLabel, PLATFORM_LABEL } from '@/lib/format';
import { PERMISSION_ROWS, ROLE_HELP, ROLE_LABEL } from '@/lib/permissions';
import { createReport } from '@/lib/report';
import { lastSlot, nextSlot, slotLabel } from '@/lib/scheduler';
import { iso, periodFor } from '@/lib/period';
import { ImportPanel } from './ImportPanel';

type Tab = 'workspace' | 'members' | 'reports' | 'import' | 'audit' | 'data';
const ALL: Platform[] = ['x', 'instagram', 'tiktok', 'discord', 'telegram', 'youtube', 'linkedin', 'kick'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'workspace';
  const { can } = useSession();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" subtitle={can('settings') ? 'Workspace, people, automatic reports and data.' : 'Only admins can change settings. You can look around.'} />
      <Segmented
        label="Settings section"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        options={[
          { value: 'workspace', label: 'Workspace' },
          { value: 'members', label: 'Members & roles' },
          { value: 'reports', label: 'Report schedules' },
          { value: 'import', label: 'Import' },
          { value: 'audit', label: 'Audit log' },
          { value: 'data', label: 'Data' },
        ]}
      />
      {tab === 'workspace' && <WorkspaceSettings />}
      {tab === 'members' && <Members />}
      {tab === 'reports' && <Schedules />}
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
  const { ws, can, member } = useSession();
  const actions = useActions();
  const [email, setEmail] = useState('');
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
                disabled={disabled || (m.role === 'admin' && admins === 1)}
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
        {ws.invites.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Pending invites</p>
            {ws.invites.map((i) => (
              <div key={i.email} className="flex items-center gap-2 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                <Badge>{ROLE_LABEL[i.role]}</Badge>
                {!disabled && (
                  <IconButton label={`Cancel invite for ${i.email}`} onClick={() => actions.saveWorkspace({ ...ws, invites: ws.invites.filter((x) => x.email !== i.email) }, `cancelled invite for ${i.email}`)}>
                    <Trash2 size={15} />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        )}
        {!disabled && (
          <form
            className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const em = email.trim().toLowerCase();
              if (!/^\S+@\S+\.\S+$/.test(em) || ws.invites.some((i) => i.email === em) || ws.members.some((m) => m.email === em)) return;
              actions.saveWorkspace({ ...ws, invites: [...ws.invites, { email: em, role, invitedAt: nowStamp() }] }, `invited ${em}`);
              setEmail('');
            }}
          >
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-label="Invite email" className="w-auto min-w-[200px] flex-1" />
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Invite role" className="w-32">
              {(['admin', 'manager', 'viewer'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary">
              Invite
            </Button>
            <p className="w-full text-[12px] text-muted">They join this workspace the first time they sign in with Google using this email.</p>
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

function Schedules() {
  const { ws, data, can } = useSession();
  const actions = useActions();
  const [recipient, setRecipient] = useState('');
  const disabled = !can('settings');
  const now = new Date();

  const update = (kind: 'weekly' | 'monthly', patch: Partial<Workspace['schedules']['weekly']>, what: string) => {
    let s = { ...ws.schedules[kind], ...patch };
    // Turning on or moving the slot never backfills: start from the next slot.
    if (patch.enabled || patch.day !== undefined || patch.time !== undefined) {
      const last = lastSlot(kind, s, now);
      s = { ...s, lastRun: `${iso(last)}T${s.time}` };
    }
    actions.saveWorkspace({ ...ws, schedules: { ...ws.schedules, [kind]: s } }, what);
  };

  const runNow = (kind: 'weekly' | 'monthly') => {
    const before = iso(new Date(lastSlot(kind, ws.schedules[kind], now).getTime() - 864e5));
    const period = periodFor(kind === 'weekly' ? 'week' : 'month', before, ws.weekStartsOn);
    const r = createReport(data, { type: kind, period, campaignId: null, trigger: 'auto', createdBy: 'scheduler', now: nowStamp() });
    actions.saveReport(r, `ran the ${kind} schedule by hand:`);
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {(['weekly', 'monthly'] as const).map((kind) => {
        const s = ws.schedules[kind];
        return (
          <Card key={kind} title={kind === 'weekly' ? 'Weekly report' : 'Monthly report'} subtitle={kind === 'weekly' ? 'Covers the previous full week' : 'Covers the previous calendar month'}>
            <fieldset disabled={disabled} className="flex flex-col gap-3">
              <Toggle checked={s.enabled} onChange={(v) => update(kind, { enabled: v }, `${kind} auto report ${v ? 'on' : 'off'}`)} label={s.enabled ? 'On' : 'Off'} />
              <div className="grid grid-cols-2 gap-3">
                {kind === 'weekly' ? (
                  <Field label="Day">
                    <Select value={s.day} onChange={(e) => update(kind, { day: Number(e.target.value) }, 'weekly report day')}>
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Day of month">
                    <Select value={s.day} onChange={(e) => update(kind, { day: Number(e.target.value) }, 'monthly report day')}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label={`Time (${ws.timezone})`}>
                  <Input type="time" value={s.time} onChange={(e) => e.target.value && update(kind, { time: e.target.value }, `${kind} report time`)} />
                </Field>
              </div>
              <p className="text-[13px] text-soft">
                {s.enabled ? <>Next run: <b>{slotLabel(nextSlot(kind, s, now))}</b></> : 'Switched off.'}
                {s.lastRun && <span className="block text-[12.5px] text-muted">Last run: {dateTimeLabel(s.lastRun)}</span>}
              </p>
              <div>
                <Button size="sm" onClick={() => runNow(kind)}>
                  Run now for the last {kind === 'weekly' ? 'week' : 'month'}
                </Button>
              </div>
            </fieldset>
          </Card>
        );
      })}
      <Card title="Recipients" subtitle="Get an email with the link when an auto report is ready (Phase 2)." className="xl:col-span-2">
        <fieldset disabled={disabled} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {ws.schedules.recipients.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-lg border border-line py-0.5 pr-1 pl-2.5 text-[13px]">
                {r}
                <IconButton label={`Remove ${r}`} className="h-6 w-6" onClick={() => actions.saveWorkspace({ ...ws, schedules: { ...ws.schedules, recipients: ws.schedules.recipients.filter((x) => x !== r) } }, 'report recipients')}>
                  <Trash2 size={13} />
                </IconButton>
              </span>
            ))}
            {ws.schedules.recipients.length === 0 && <span className="text-[13px] text-muted">No recipients yet.</span>}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const em = recipient.trim().toLowerCase();
              if (!/^\S+@\S+\.\S+$/.test(em) || ws.schedules.recipients.includes(em)) return;
              actions.saveWorkspace({ ...ws, schedules: { ...ws.schedules, recipients: [...ws.schedules.recipients, em] } }, 'report recipients');
              setRecipient('');
            }}
          >
            <Input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="name@company.com" aria-label="Recipient email" className="max-w-sm" />
            <Button type="submit">Add</Button>
          </form>
        </fieldset>
      </Card>
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
  const { db, can } = useSession();
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card title="Export" subtitle="Everything in this browser, as JSON. Useful as a backup or to seed Firestore later.">
        <Button onClick={() => download(`pulse-backup-${iso(new Date())}.json`, JSON.stringify(db, null, 2), 'application/json')}>Download JSON backup</Button>
      </Card>
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
    </div>
  );
}
