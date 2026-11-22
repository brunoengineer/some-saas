import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { PeriodStepper } from '@/components/PeriodStepper';
import { Button, Card, Field, IconButton, Input, Modal, Select } from '@/components/ui';
import type { DailyStat, Platform, StatField } from '@/data/types';
import { num, PLATFORM_LABEL } from '@/lib/format';
import { lastDataDate } from '@/lib/metrics';
import { eachDay, periodFor, periodLabel, shiftPeriod, toDate } from '@/lib/period';

type MapField = 'joins' | 'clicks';
interface FieldDef {
  key: StatField;
  label: string;
  /** Shown in the edit form. */
  help?: string;
  /** May be left empty (unknown) rather than 0. */
  nullable?: boolean;
}

const DISCORD_FIELDS: FieldDef[] = [
  { key: 'members', label: 'Members', help: 'At the end of the day', nullable: true },
  { key: 'joins', label: 'New members', help: 'By invite link or source' },
  { key: 'leaves', label: 'Left' },
  { key: 'messages', label: 'Messages' },
  { key: 'active', label: 'Posted', help: 'People who posted that day', nullable: true },
  { key: 'active7', label: 'Posted (7 days)', help: 'People who posted in the 7 days up to this day: used for weekly active %', nullable: true },
  { key: 'cohortSize', label: 'Joined (tracked)', help: 'Newcomers that day whose stay is measured', nullable: true },
  { key: 'retained7', label: 'Stayed 7 days', help: 'Of those, still in the server a week later: used for 7-day retention', nullable: true },
];
const SOCIAL_FIELDS: FieldDef[] = [
  { key: 'followers', label: 'Followers', help: 'At the end of the day', nullable: true },
  { key: 'profileVisits', label: 'Profile visits' },
  { key: 'clicks', label: 'Link clicks', help: 'By destination' },
  { key: 'members', label: 'Members', nullable: true },
  { key: 'joins', label: 'New members', help: 'By source' },
  { key: 'leaves', label: 'Left' },
  { key: 'messages', label: 'Messages' },
];
const fieldsFor = (p: Platform) => (p === 'discord' ? DISCORD_FIELDS : SOCIAL_FIELDS);
const isMap = (k: StatField): k is MapField => k === 'joins' || k === 'clicks';
const total = (m: Record<string, number>) => Object.values(m).reduce((s, n) => s + n, 0);

const blank = (wsId: string, platform: Platform, date: string): DailyStat => ({
  id: `${wsId}_${platform}_${date}`,
  wsId,
  platform,
  date,
  followers: null,
  members: null,
  clicks: {},
  joins: {},
  leaves: 0,
  profileVisits: 0,
  messages: 0,
});

/**
 * KPIs & Goals → Daily numbers: the channel numbers behind the calculated KPIs,
 * one day per row. Whatever the sync fetched (or a CSV brought in) can be
 * corrected here at any time; corrected fields are kept when the sync runs again.
 */
export function DailyNumbers() {
  const { data, ws, today, can } = useSession();
  const editable = can('kpi.enter');
  const last = lastDataDate(data);
  const [anchor, setAnchor] = useState(last && last < today ? last : today);
  const [platform, setPlatform] = useState<Platform>(ws.platforms.includes('discord') ? 'discord' : (ws.platforms[0] ?? 'x'));
  const [editing, setEditing] = useState<DailyStat | null>(null);
  const period = periodFor('week', anchor, ws.weekStartsOn);
  const days = eachDay(period);
  const fields = fieldsFor(platform);
  const statFor = (date: string) => data.stats.find((s) => s.platform === platform && s.date === date) ?? null;

  const cell = (s: DailyStat | null, f: FieldDef) => {
    if (!s) return <span className="text-muted">—</span>;
    const v = s[f.key] as number | Record<string, number> | null | undefined;
    const edited = s.manualFields?.includes(f.key);
    const text = v == null ? '—' : typeof v === 'object' ? (Object.keys(v).length ? num(total(v)) : '—') : num(v);
    return (
      <span className="inline-flex items-center justify-end gap-1" title={edited ? `Edited by hand${s.editedBy ? ` (${s.editedBy})` : ''}` : undefined}>
        {edited && <Pencil size={11} className="text-accent" aria-label="Edited by hand" />}
        <span className={v == null ? 'text-muted' : ''}>{text}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="w-auto min-w-[150px]" aria-label="Platform">
          {ws.platforms.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </Select>
        <PeriodStepper
          label={periodLabel(period)}
          onPrev={() => setAnchor(shiftPeriod(period, -1, ws.weekStartsOn).start)}
          onNext={() => setAnchor(shiftPeriod(period, 1, ws.weekStartsOn).start)}
          nextDisabled={period.end >= today}
        />
      </div>

      <Card
        title={`${PLATFORM_LABEL[platform]}, day by day`}
        subtitle="The numbers behind the calculated KPIs, from the sync, a CSV or typed in. Correct any day at any time: fields you change are marked and kept when the data is updated again."
        pad={false}
      >
        {/* Wide screens: one table, a column per number. */}
        <table className="hidden w-full text-[13.5px] md:table">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="border-b border-line py-2 pr-3 pl-4 text-left font-medium">Day</th>
              {fields.map((f) => (
                <th key={f.key} className="border-b border-line px-3 py-2 text-right font-medium">
                  {f.label}
                </th>
              ))}
              <th className="border-b border-line pr-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const s = statFor(d);
              return (
                <tr key={d} className="border-b border-line/70 last:border-0">
                  <td className="py-2 pr-3 pl-4 whitespace-nowrap">{format(toDate(d), 'EEE d MMM')}</td>
                  {fields.map((f) => (
                    <td key={f.key} className="tabular px-3 py-2 text-right">
                      {cell(s, f)}
                    </td>
                  ))}
                  <td className="py-1 pr-3 text-right">
                    {editable && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s ?? blank(ws.id, platform, d))}>
                        {s ? 'Edit' : 'Add'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Phones: one line per day, the main numbers only. */}
        <ul className="flex flex-col divide-y divide-line md:hidden">
          {days.map((d) => {
            const s = statFor(d);
            return (
              <li key={d} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                    {format(toDate(d), 'EEE d MMM')}
                    {s?.manualFields?.length ? <Pencil size={11} className="text-accent" aria-label="Edited by hand" /> : null}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {s
                      ? fields
                          .slice(0, 3)
                          .map((f) => {
                            const v = s[f.key] as number | Record<string, number> | null | undefined;
                            return `${f.label} ${v == null ? '—' : typeof v === 'object' ? num(total(v)) : num(v)}`;
                          })
                          .join(' · ')
                      : 'No numbers'}
                  </span>
                </span>
                {editable && (
                  <Button size="sm" onClick={() => setEditing(s ?? blank(ws.id, platform, d))}>
                    {s ? 'Edit' : 'Add'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {!editable && <p className="text-[12.5px] text-muted">Only admins can correct these numbers.</p>}
      {editing && <EditDay stat={editing} fields={fieldsFor(editing.platform)} onClose={() => setEditing(null)} />}
    </div>
  );
}

type Draft = Record<string, string | { label: string; n: string }[]>;

function toDraft(s: DailyStat, fields: FieldDef[]): Draft {
  const d: Draft = {};
  for (const f of fields) {
    const v = s[f.key] as number | Record<string, number> | null | undefined;
    d[f.key] = isMap(f.key) ? Object.entries((v as Record<string, number>) ?? {}).map(([label, n]) => ({ label, n: String(n) })) : v == null ? '' : String(v);
  }
  return d;
}

function EditDay({ stat, fields, onClose }: { stat: DailyStat; fields: FieldDef[]; onClose: () => void }) {
  const { user, member } = useSession();
  const actions = useActions();
  const [draft, setDraft] = useState<Draft>(() => toDraft(stat, fields));
  const original = toDraft(stat, fields);
  const label = `${PLATFORM_LABEL[stat.platform]}, ${format(toDate(stat.date), 'EEE d MMM')}`;

  const bad = (v: string) => v.trim() !== '' && (Number.isNaN(Number(v)) || Number(v) < 0);
  const invalid = fields.some((f) => {
    const v = draft[f.key];
    return Array.isArray(v) ? v.some((r) => bad(r.n) || (r.n.trim() !== '' && !r.label.trim())) : bad(v);
  });
  const changedKeys = fields.filter((f) => JSON.stringify(draft[f.key]) !== JSON.stringify(original[f.key])).map((f) => f.key);

  const save = () => {
    const next: DailyStat = { ...stat };
    const rec = next as unknown as Record<string, unknown>;
    for (const f of fields) {
      const v = draft[f.key];
      if (Array.isArray(v)) {
        const m: Record<string, number> = {};
        for (const r of v) if (r.label.trim() && r.n.trim() !== '') m[r.label.trim()] = (m[r.label.trim()] ?? 0) + Number(r.n);
        rec[f.key] = m;
      } else rec[f.key] = v.trim() === '' ? (f.nullable ? null : 0) : Number(v);
    }
    next.manualFields = [...new Set([...(stat.manualFields ?? []), ...changedKeys])];
    next.editedBy = user?.email ?? member.name;
    next.editedAt = new Date().toISOString();
    actions.saveStat(next, label);
    onClose();
  };
  const release = () => {
    actions.saveStat({ ...stat, manualFields: [] }, `${label} (back to synced)`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${label}`}
      footer={
        <>
          {stat.manualFields?.length ? (
            <Button variant="ghost" className="mr-auto" onClick={release} title="The next update replaces the edited fields with the fetched numbers.">
              Let updates replace my edits
            </Button>
          ) : (
            <span className="mr-auto" />
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!changedKeys.length || invalid} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Fields you change are marked as edited by hand and kept when the data is updated again.
          {stat.manualFields?.length ? ` Already edited: ${stat.manualFields.map((k) => fields.find((f) => f.key === k)?.label ?? k).join(', ')}.` : ''}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields
            .filter((f) => !isMap(f.key))
            .map((f) => (
              <Field key={f.key} label={f.label} hint={f.help}>
                <Input
                  inputMode="numeric"
                  value={draft[f.key] as string}
                  placeholder={f.nullable ? 'Unknown' : '0'}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className={bad(draft[f.key] as string) ? 'tabular border-critical' : 'tabular'}
                />
              </Field>
            ))}
        </div>
        {fields
          .filter((f) => isMap(f.key))
          .map((f) => {
            const rows = draft[f.key] as { label: string; n: string }[];
            const setRows = (r: { label: string; n: string }[]) => setDraft({ ...draft, [f.key]: r });
            return (
              <div key={f.key} className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-soft">
                  {f.label} <span className="font-normal text-muted">· {f.help?.toLowerCase()}</span>
                </p>
                {rows.length === 0 && <p className="text-[12.5px] text-muted">None.</p>}
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input aria-label={`${f.label} source ${i + 1}`} placeholder={f.key === 'clicks' ? 'e.g. Discord' : 'e.g. X bio'} value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1" />
                    <Input aria-label={`${f.label} count ${i + 1}`} inputMode="numeric" value={r.n} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))} className={bad(r.n) ? 'tabular w-24 border-critical text-right' : 'tabular w-24 text-right'} />
                    <IconButton label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                ))}
                <div>
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => setRows([...rows, { label: '', n: '' }])}>
                    Add a source
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </Modal>
  );
}
