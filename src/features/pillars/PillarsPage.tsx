import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { usePeriodFilters } from '@/app/useFilters';
import { CategoryBars, ChartCard, MixBars } from '@/components/charts';
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, seriesVar, Select } from '@/components/ui';
import type { Pillar } from '@/data/types';
import { compact, formatDelta, num } from '@/lib/format';
import { pillarStats, type PillarStat } from '@/lib/metrics';
import { comparedLabel, periodLabel, previousPeriod } from '@/lib/period';
import { PeriodBar } from '../dashboard/PeriodBar';

/** How far a pillar's share can drift from its target before it's flagged, in percentage points. */
const TOLERANCE = 5;

export function PillarsPage() {
  const { data, ws, can } = useSession();
  const { period, filters, compare } = usePeriodFilters();
  const [editing, setEditing] = useState(false);
  const prev = useMemo(() => (compare ? previousPeriod(period, ws.weekStartsOn) : null), [compare, period, ws.weekStartsOn]);
  const stats = useMemo(() => pillarStats(data, period, prev, filters.platform), [data, period, prev, filters.platform]);
  const targetTotal = ws.pillars.reduce((s, p) => s + p.targetShare, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pillars"
        subtitle="The themes your content is built on: the planned mix, what you actually posted, and how each one performs."
        actions={
          can('settings') && (
            <Button variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
              Edit pillars
            </Button>
          )
        }
      />

      {ws.pillars.length === 0 ? (
        <EmptyState
          title="No pillars yet"
          body="Pillars are the 3–6 themes every post belongs to, each with a target share of your posts."
          action={can('settings') ? <Button onClick={() => setEditing(true)}>Add pillars</Button> : undefined}
        />
      ) : (
        <>
          <PeriodBar />
          {targetTotal !== 100 && (
            <p className="rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-3 py-2 text-[13px] text-warning-text">
              The target mix adds up to {targetTotal}%, not 100%. {can('settings') ? 'Use “Edit pillars” to fix it.' : 'Ask an admin to fix it.'}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Card title="Mix vs plan" subtitle={`${num(stats.total)} published posts · ${periodLabel(period)}`}>
              {stats.total ? <MixBars data={stats.pillars} /> : <p className="py-8 text-center text-[13px] text-muted">No published posts in this period.</p>}
              {stats.unassigned > 0 && <p className="mt-3 text-[12.5px] text-muted">{stats.unassigned} post(s) have no pillar and aren’t counted.</p>}
            </Card>
            <ChartCard
              title="Engagement rate by pillar"
              subtitle="Engagements ÷ impressions, published posts"
              table={{ head: ['Pillar', 'Posts', 'Rate'], rows: stats.pillars.map((p) => [p.name, p.posts, p.rate === null ? '—' : `${p.rate.toFixed(1)}%`]) }}
            >
              <CategoryBars valueName="Engagement rate" data={stats.pillars.map((p) => ({ name: p.name, value: p.rate, color: p.color, note: `${p.posts} posts` }))} format={(v) => `${v.toFixed(1)}%`} height={220} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stats.pillars.map((p) => (
              <PillarCard key={p.id} p={p} hasPosts={stats.total > 0} compareLabel={prev ? comparedLabel[period.type] : null} calendarLink={`/calendar?view=list&pillar=${p.id}&d=${period.start}`} />
            ))}
          </div>
        </>
      )}

      {editing && <PillarEditor onClose={() => setEditing(false)} />}
    </div>
  );
}

function MixBadge({ p, hasPosts }: { p: PillarStat; hasPosts: boolean }) {
  if (!hasPosts) return <Badge>No posts yet</Badge>;
  if (Math.abs(p.gap) <= TOLERANCE)
    return (
      <Badge tone="good">
        <CheckCircle2 size={12} aria-hidden /> On plan
      </Badge>
    );
  const over = p.gap > 0;
  return (
    <Badge tone="warning">
      {over ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />} {over ? 'Over' : 'Under'} by {Math.abs(p.gap).toFixed(0)} pts
    </Badge>
  );
}

function PillarCard({ p, hasPosts, compareLabel, calendarLink }: { p: PillarStat; hasPosts: boolean; compareLabel: string | null; calendarLink: string }) {
  const delta = formatDelta('percent', p.rate, p.prevRate);
  const top = p.top;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-line border-t-4 bg-surface p-4" style={{ borderTopColor: seriesVar(p.color) }}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{p.name}</h2>
          {p.description && <p className="text-[13px] text-muted">{p.description}</p>}
        </div>
        <MixBadge p={p} hasPosts={hasPosts} />
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <div>
          <dt className="text-muted">Share of posts</dt>
          <dd className="tabular text-[18px] font-semibold">
            {p.share.toFixed(0)}% <span className="text-[12.5px] font-normal text-muted">target {p.target}%</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Engagement rate</dt>
          <dd className="tabular text-[18px] font-semibold">
            {p.rate === null ? '—' : `${p.rate.toFixed(1)}%`}
            {delta && (
              <span className="ml-1 text-[12.5px] font-normal text-muted" title={compareLabel ?? undefined}>
                {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '='} {delta.text}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Published</dt>
          <dd className="tabular font-medium">
            {num(p.posts)} post{p.posts === 1 ? '' : 's'}
            {p.planned > 0 && <span className="font-normal text-muted"> · {p.planned} planned</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Impressions · clicks</dt>
          <dd className="tabular font-medium">
            {compact(p.impressions)} · {num(p.clicks)}
          </dd>
        </div>
      </dl>

      {top && (
        <Link to={`/calendar?post=${top.id}&d=${top.date!.slice(0, 10)}`} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] hover:bg-line/50">
          <span className="block text-[12px] text-muted">Best post · {((top.metrics!.engagements / Math.max(1, top.metrics!.impressions)) * 100).toFixed(1)}%</span>
          <span className="block truncate font-medium">{top.title}</span>
        </Link>
      )}

      <Link to={calendarLink} className="mt-auto inline-flex w-fit items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline">
        See these posts in the calendar <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

function PillarEditor({ onClose }: { onClose: () => void }) {
  const { ws, db } = useSession();
  const actions = useActions();
  const [rows, setRows] = useState<Pillar[]>(ws.pillars.map((p) => ({ ...p, description: p.description ?? '' })));
  const total = rows.reduce((s, p) => s + p.targetShare, 0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(ws.pillars.map((p) => ({ ...p, description: p.description ?? '' })));
  const valid = rows.every((p) => p.name.trim());
  const set = (i: number, patch: Partial<Pillar>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const usedBy = (id: string) => db.posts.filter((p) => p.wsId === ws.id && p.pillarId === id).length;

  const remove = (i: number) => {
    const n = usedBy(rows[i].id);
    if (n && !window.confirm(`${n} post(s) use “${rows[i].name}”. They will have no pillar until you choose a new one. Remove it?`)) return;
    setRows(rows.filter((_, j) => j !== i));
  };
  const save = () => {
    actions.saveWorkspace({ ...ws, pillars: rows.map((p) => ({ ...p, name: p.name.trim(), description: p.description?.trim() ?? '' })) }, 'the content pillars');
    onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Edit pillars"
      footer={
        <>
          <span className={total === 100 ? 'mr-auto self-center text-[13px] text-muted' : 'mr-auto self-center text-[13px] font-medium text-warning-text'}>
            Target mix: {total}%{total !== 100 ? ' (should add up to 100%)' : ''}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!dirty || !valid} onClick={save}>
            Save pillars
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.map((p, i) => (
          <div key={p.id} className="grid grid-cols-[124px_minmax(0,1fr)_92px_36px] items-end gap-2 rounded-lg border border-line p-3">
            <Field label="Color">
              <Select value={p.color} onChange={(e) => set(i, { color: Number(e.target.value) })} style={{ borderLeft: `6px solid ${seriesVar(p.color)}` }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Color {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name">
              <Input value={p.name} onChange={(e) => set(i, { name: e.target.value })} />
            </Field>
            <Field label="Target %">
              <Input type="number" min={0} max={100} value={p.targetShare} onChange={(e) => set(i, { targetShare: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </Field>
            <IconButton label={`Remove ${p.name || 'pillar'}`} onClick={() => remove(i)}>
              <Trash2 size={15} />
            </IconButton>
            <Field label="What goes here" className="col-span-4">
              <Input value={p.description ?? ''} onChange={(e) => set(i, { description: e.target.value })} placeholder="e.g. Memes, polls and jokes. The everyday reason to follow." />
            </Field>
          </div>
        ))}
        <div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setRows([...rows, { id: newId('pl'), name: 'New pillar', color: (rows.length % 8) + 1, targetShare: 0, description: '' }])}>
            Add pillar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
