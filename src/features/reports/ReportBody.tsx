import { useState, type ReactNode } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { newId } from '@/app/actions';
import { PRINT_WIDTH, usePrinting } from '@/app/printMode';
import { CategoryBars, ChartCard, Columns, TrendChart } from '@/components/charts';
import { KpiTile } from '@/components/KpiTile';
import { Button, Card, cx, Dot, IconButton, Input, PlatformBadge, Select, Textarea } from '@/components/ui';
import type { Report, ReportKpi, ReportNarrative, Workspace } from '@/data/types';
import { compact, dayLabel, money, num, PLATFORM_LABEL } from '@/lib/format';
import { rangeLabel } from '@/lib/period';
import { isShown, REPORT_SECTIONS, REPORT_TYPE_LABEL, reportKpis, type ReportSection } from '@/lib/report';

/** A KPI that can be added while editing; `make` freezes its numbers for the report period. */
export interface AddableKpi {
  id: string;
  label: string;
  make: () => ReportKpi;
}

/**
 * The report document, same layout as the proposal's example report. While
 * editing, every section, KPI tile and figure card can be removed (and put
 * back), and KPIs, figure cards and text sections can be added.
 */
export function ReportBody({
  report,
  ws,
  editing,
  narrative,
  onNarrative,
  addable = [],
}: {
  report: Report;
  ws: Workspace;
  editing: boolean;
  narrative: ReportNarrative;
  onNarrative: (n: ReportNarrative) => void;
  addable?: AddableKpi[];
}) {
  const s = report.snapshot;
  const n = narrative;
  const kpis = reportKpis(report, n);
  const added = new Set((n.addedKpis ?? []).map((k) => k.id));
  const weekly = kpis.filter((k) => k.group === 'weekly');
  const byPlatform = new Map<string, ReportKpi[]>();
  for (const k of weekly) byPlatform.set(k.platform ?? '', [...(byPlatform.get(k.platform ?? '') ?? []), k]);
  const more = kpis.filter((k) => k.group !== 'weekly' && (added.has(k.id) || (k.group !== 'daily' && k.value !== null)));
  const pillars = s.pillars.filter((p) => p.posts > 0);
  const t = s.totals;
  const shown = (key: ReportSection) => isShown(n, key);
  // Paper layout: fixed grids and chart widths, so nothing is resized or cut mid-page.
  const print = usePrinting();
  const chartW = print ? PRINT_WIDTH - 34 : undefined;
  const tilesCls = print ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';

  const hide = (key: string) => onNarrative({ ...n, hidden: [...(n.hidden ?? []), key] });
  const unhide = (key: string) => onNarrative({ ...n, hidden: (n.hidden ?? []).filter((x) => x !== key) });
  const removeKpi = (id: string) =>
    added.has(id) ? onNarrative({ ...n, addedKpis: (n.addedKpis ?? []).filter((k) => k.id !== id) }) : onNarrative({ ...n, hiddenKpis: [...(n.hiddenKpis ?? []), id] });

  const tile = (k: ReportKpi, signed = false) => (
    <div key={k.id} className="relative">
      <KpiTile {...k} detail={k.detail} signed={signed} compareLabel="vs previous period" />
      {editing && (
        <IconButton label={`Remove ${k.name} from the report`} onClick={() => removeKpi(k.id)} className="absolute top-1.5 right-1.5 h-7 w-7 border border-line bg-surface shadow-sm">
          <X size={14} />
        </IconButton>
      )}
    </div>
  );

  const minis: { key: string; label: string; value: string; hint?: string; when: boolean }[] = [
    { key: 'posts', label: 'Posts published', value: num(t.posts), when: true },
    { key: 'impressions', label: 'Impressions', value: compact(t.impressions), when: true },
    { key: 'rate', label: 'Avg engagement rate', value: t.rate === null ? '—' : `${t.rate.toFixed(1)}%`, when: true },
    { key: 'visits', label: 'Profile visits', value: num(t.profileVisits), when: true },
    { key: 'followers', label: 'Followers (end)', value: num(t.followers ?? 0), when: t.followers !== null },
    { key: 'members', label: 'Members (end)', value: num(t.members ?? 0), hint: t.joins ? `${num(t.joins)} joined, ${num(t.leaves)} left` : undefined, when: t.members !== null },
    { key: 'messages', label: 'Messages sent', value: num(t.messages), when: t.messages > 0 },
    { key: 'clicks', label: 'Profile link clicks', value: num(t.profileClicks), when: t.profileClicks > 0 },
  ];
  const cards = n.cards ?? [];
  const sections = n.sections ?? [];
  const setCard = (id: string, patch: Partial<(typeof cards)[number]>) => onNarrative({ ...n, cards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const setSection = (id: string, patch: Partial<(typeof sections)[number]>) => onNarrative({ ...n, sections: sections.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  return (
    <article className={print ? 'print-root flex flex-col gap-4' : 'flex flex-col gap-5'} style={print ? { width: PRINT_WIDTH } : undefined}>
      <header className="break-avoid flex flex-col gap-2 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-accent-strong uppercase">
          {REPORT_TYPE_LABEL[report.type]} report · {rangeLabel(report.start, report.end)}
        </p>
        {editing ? (
          <>
            <Input value={n.headline} onChange={(e) => onNarrative({ ...n, headline: e.target.value })} className="h-11 text-[20px] font-semibold" aria-label="Headline" />
            <Textarea value={n.summary} onChange={(e) => onNarrative({ ...n, summary: e.target.value })} rows={3} aria-label="Summary" />
            <p className="text-[12.5px] text-muted">Remove anything with its ✕ or “Remove” button. Add KPIs, figures and text sections in the panel below.</p>
          </>
        ) : (
          <>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-balance sm:text-[30px]">{n.headline}</h1>
            <p className="max-w-[75ch] text-[15px] text-soft">{n.summary}</p>
          </>
        )}
        <p className="text-[12.5px] text-muted">
          {ws.name} · {report.trigger === 'auto' ? 'Generated automatically' : 'Generated manually'} on {dayLabel(report.createdAt)} · numbers frozen at generation
        </p>
      </header>

      {editing && <AddPanel report={report} n={n} onNarrative={onNarrative} addable={addable} unhide={unhide} kpisShown={kpis} />}

      {shown('numbers') && byPlatform.size > 0 && (
        <Section editing={editing} label={REPORT_SECTIONS.numbers} onRemove={() => hide('numbers')}>
          <div className="flex flex-col gap-5">
            {[...byPlatform.entries()].map(([platform, list]) => (
              <section key={platform} className="break-avoid flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold">
                  {platform ? PLATFORM_LABEL[platform as keyof typeof PLATFORM_LABEL] : 'Overall'} <span className="font-normal text-muted">· the main numbers</span>
                </h2>
                <div className={tilesCls}>{list.map((k) => tile(k, k.name.toLowerCase().startsWith('net')))}</div>
              </section>
            ))}
          </div>
        </Section>
      )}

      {shown('totals') && (
        <Section editing={editing} label={REPORT_SECTIONS.totals} onRemove={() => hide('totals')}>
          <div className={print ? 'break-avoid grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-3 md:grid-cols-4'}>
            {minis
              .filter((m) => m.when && isShown(n, `card:${m.key}`))
              .map((m) => (
                <Mini key={m.key} label={m.label} value={m.value} hint={m.hint} onRemove={editing ? () => hide(`card:${m.key}`) : undefined} />
              ))}
          </div>
        </Section>
      )}

      {cards.length > 0 && (
        <div className={print ? 'break-avoid grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-3 md:grid-cols-4'}>
          {cards.map((c) =>
            editing ? (
              <div key={c.id} className="relative flex flex-col gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface p-3">
                <Input value={c.value} onChange={(e) => setCard(c.id, { value: e.target.value })} placeholder="Value, e.g. 1,240" aria-label="Figure value" className="h-8 pr-8 text-[15px] font-semibold" />
                <Input value={c.label} onChange={(e) => setCard(c.id, { label: e.target.value })} placeholder="Label, e.g. Newsletter sign-ups" aria-label="Figure label" className="h-8 text-[12.5px]" />
                <Input value={c.note} onChange={(e) => setCard(c.id, { note: e.target.value })} placeholder="Note (optional)" aria-label="Figure note" className="h-8 text-[12px]" />
                <IconButton label="Remove this figure" onClick={() => onNarrative({ ...n, cards: cards.filter((x) => x.id !== c.id) })} className="absolute top-1.5 right-1.5 h-7 w-7">
                  <X size={14} />
                </IconButton>
              </div>
            ) : (
              <Mini key={c.id} label={c.label} value={c.value || '—'} hint={c.note || undefined} />
            ),
          )}
        </div>
      )}

      {(() => {
        const charts = [
          shown('followers') && s.followers.length > 0 && (
            <Section key="followers" editing={editing} label={REPORT_SECTIONS.followers} onRemove={() => hide('followers')}>
              <ChartCard className="break-avoid" title="Followers, day by day" subtitle={s.annotations.length ? s.annotations.map((a) => a.label).join(' · ') : undefined} table={{ head: ['Date', 'Followers'], rows: s.followers.map((f) => [f.date, num(f.value)]) }}>
                <TrendChart data={s.followers} annotations={s.annotations} name="Followers" height={230} width={chartW} />
              </ChartCard>
            </Section>
          ),
          shown('pillars') && pillars.length > 0 && (
            <Section key="pillars" editing={editing} label={REPORT_SECTIONS.pillars} onRemove={() => hide('pillars')}>
              <ChartCard className="break-avoid" title="Engagement rate by pillar" subtitle="Share of posts in brackets" table={{ head: ['Pillar', 'Posts', 'Rate'], rows: pillars.map((p) => [p.name, `${p.posts} (${p.share.toFixed(0)}%)`, p.rate === null ? '—' : `${p.rate.toFixed(1)}%`]) }}>
                <CategoryBars valueName="Engagement rate" data={pillars.map((p) => ({ name: `${p.name} (${p.share.toFixed(0)}%)`, value: p.rate, color: p.color }))} format={(v) => `${v.toFixed(1)}%`} width={chartW} />
              </ChartCard>
            </Section>
          ),
          shown('joins') && s.joinsBySource.length > 0 && (
            <Section key="joins" editing={editing} label={REPORT_SECTIONS.joins} onRemove={() => hide('joins')}>
              <ChartCard className="break-avoid" title="Where members came from" subtitle="Joins by tracked invite link" table={{ head: ['Source', 'Joins'], rows: s.joinsBySource.map((j) => [j.source, j.value]) }}>
                <Columns data={s.joinsBySource.map((j) => ({ label: j.source, value: j.value }))} valueName="Joins" height={230} width={chartW} />
              </ChartCard>
            </Section>
          ),
        ].filter(Boolean);
        return charts.length ? <div className={print ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-3 xl:grid-cols-2'}>{charts}</div> : null;
      })()}

      {shown('topPosts') && s.topPosts.length > 0 && (
        <Section editing={editing} label={REPORT_SECTIONS.topPosts} onRemove={() => hide('topPosts')}>
          <Card title={s.topPosts.length === 1 ? 'Top post' : 'Top posts'} subtitle="By engagement rate, at least 2,000 impressions" className="break-avoid">
            <div className="flex flex-col gap-3">
              {s.topPosts.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[12px] text-muted">
                      <PlatformBadge platform={p.platform} /> {p.pillar} · {dayLabel(p.date)}
                    </p>
                    <p className="mt-1 text-[14px] whitespace-pre-wrap">{p.caption || p.title}</p>
                  </div>
                  <dl className="tabular grid shrink-0 grid-cols-4 gap-3 text-center text-[12px] text-muted sm:w-[320px]">
                    <div>
                      <dd className="text-[15px] font-semibold text-fg">{num(p.impressions)}</dd>
                      <dt>impressions</dt>
                    </div>
                    <div>
                      <dd className="text-[15px] font-semibold text-fg">{num(p.engagements)}</dd>
                      <dt>engagements</dt>
                    </div>
                    <div>
                      <dd className="text-[15px] font-semibold text-fg">{p.rate.toFixed(1)}%</dd>
                      <dt>rate</dt>
                    </div>
                    <div>
                      <dd className="text-[15px] font-semibold text-fg">{num(p.profileVisits)}</dd>
                      <dt>profile visits</dt>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {shown('partners') && s.partners.length > 0 && (
        <Section editing={editing} label={REPORT_SECTIONS.partners} onRemove={() => hide('partners')}>
          <Card title="Creators and partners" className="break-avoid">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13.5px]">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    {['Partner', 'Deliverables', 'Views', 'New members', '7-day retention', 'Cost', 'Cost / member'].map((h, i) => (
                      <th key={h} className={`border-b border-line py-2 font-medium ${i ? 'pl-3 text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.partners.map((p) => (
                    <tr key={p.id} className="tabular border-b border-line/70 last:border-0">
                      <td className="py-2">
                        {p.name} <span className="text-muted">{p.handle}</span>
                      </td>
                      <td className="pl-3 text-right">{p.deliverables}</td>
                      <td className="pl-3 text-right">{compact(p.views)}</td>
                      <td className="pl-3 text-right">{num(p.newMembers)}</td>
                      <td className="pl-3 text-right">{p.retention === null ? '—' : `${Math.round(p.retention)}%`}</td>
                      <td className="pl-3 text-right">{money(p.cost)}</td>
                      <td className="pl-3 text-right">{p.costPerMember === null ? '—' : money(p.costPerMember, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      )}

      {shown('more') && more.length > 0 && (
        <Section editing={editing} label={REPORT_SECTIONS.more} onRemove={() => hide('more')}>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">
              Goals and other KPIs <span className="font-normal text-muted">· for the period</span>
            </h2>
            <div className={tilesCls}>{more.map((k) => tile(k))}</div>
          </section>
        </Section>
      )}

      {sections.map((sec) =>
        editing ? (
          <Card key={sec.id} className="border-dashed" id={`report-section-${sec.id}`}>
            <div className="flex flex-col gap-2">
              <span className="flex gap-2">
                <Input value={sec.title} onChange={(e) => setSection(sec.id, { title: e.target.value })} placeholder="Section title, e.g. Community highlights" aria-label="Section title" className="font-semibold" />
                <IconButton label="Remove this section" onClick={() => onNarrative({ ...n, sections: sections.filter((x) => x.id !== sec.id) })}>
                  <Trash2 size={15} />
                </IconButton>
              </span>
              <Textarea value={sec.body} onChange={(e) => setSection(sec.id, { body: e.target.value })} rows={4} placeholder="What you want to say. Line breaks are kept." aria-label="Section text" />
            </div>
          </Card>
        ) : (
          <Card key={sec.id} title={sec.title || 'Notes'} className="break-avoid">
            <p className="text-[14px] whitespace-pre-wrap text-soft">{sec.body}</p>
          </Card>
        ),
      )}

      {shown('actions') && (
        <Section editing={editing} label={REPORT_SECTIONS.actions} onRemove={() => hide('actions')}>
          <Card title="What changes next" subtitle="Each one answers a number above" className="break-avoid">
            <ol className="flex flex-col gap-3">
              {n.actions.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">{i + 1}</span>
                  {editing ? (
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className="flex gap-2">
                        <Input value={a.title} aria-label={`Action ${i + 1} title`} onChange={(e) => onNarrative({ ...n, actions: n.actions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                        <IconButton label="Remove action" onClick={() => onNarrative({ ...n, actions: n.actions.filter((_, j) => j !== i) })}>
                          <Trash2 size={15} />
                        </IconButton>
                      </span>
                      <Textarea value={a.body} rows={2} aria-label={`Action ${i + 1} detail`} onChange={(e) => onNarrative({ ...n, actions: n.actions.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
                    </span>
                  ) : (
                    <span>
                      <b className="block text-[14.5px] font-semibold">{a.title}</b>
                      <span className="text-[13.5px] text-soft">{a.body}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {editing && (
              <Button size="sm" className="mt-3" icon={<Plus size={14} />} onClick={() => onNarrative({ ...n, actions: [...n.actions, { title: '', body: '' }] })}>
                Add action
              </Button>
            )}
            {editing ? (
              <Textarea className="mt-3" value={n.footnote} rows={2} aria-label="Footnote" onChange={(e) => onNarrative({ ...n, footnote: e.target.value })} />
            ) : (
              n.footnote && <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted">{n.footnote}</p>
            )}
          </Card>
        </Section>
      )}

      <p className="flex items-center gap-2 text-[12px] text-muted">
        <Dot color={1} /> Sources: platform analytics exports, tracked profile links, invite links and partner results entered in Pulse.
      </p>
    </article>
  );
}

/** In edit mode: a dashed frame with a Remove button; otherwise just the content. */
function Section({ editing, label, onRemove, children }: { editing: boolean; label: string; onRemove: () => void; children: ReactNode }) {
  if (!editing) return <>{children}</>;
  return (
    <div className="relative rounded-2xl border border-dashed border-line-strong p-2 pt-9">
      <span className="absolute top-2 left-3 text-[12px] font-medium text-muted">{label}</span>
      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={onRemove} className="absolute top-1 right-1" aria-label={`Remove the ${label} section`}>
        Remove
      </Button>
      {children}
    </div>
  );
}

function AddPanel({
  report,
  n,
  onNarrative,
  addable,
  unhide,
  kpisShown,
}: {
  report: Report;
  n: ReportNarrative;
  onNarrative: (n: ReportNarrative) => void;
  addable: AddableKpi[];
  unhide: (key: string) => void;
  kpisShown: ReportKpi[];
}) {
  const [pick, setPick] = useState('');
  const visible = new Set(kpisShown.map((k) => k.id));
  const choices = addable.filter((a) => !visible.has(a.id));
  const hiddenSections = (n.hidden ?? []).filter((h) => h in REPORT_SECTIONS) as ReportSection[];
  const hiddenCards = (n.hidden ?? []).filter((h) => h.startsWith('card:'));
  const hiddenKpis = (n.hiddenKpis ?? []).map((id) => report.snapshot.kpis.find((k) => k.id === id)).filter(Boolean) as ReportKpi[];
  const CARD_LABEL: Record<string, string> = { posts: 'Posts published', impressions: 'Impressions', rate: 'Avg engagement rate', visits: 'Profile visits', followers: 'Followers (end)', members: 'Members (end)', messages: 'Messages sent', clicks: 'Profile link clicks' };

  const addKpi = () => {
    const a = choices.find((c) => c.id === pick);
    if (!a) return;
    if ((n.hiddenKpis ?? []).includes(a.id)) onNarrative({ ...n, hiddenKpis: (n.hiddenKpis ?? []).filter((x) => x !== a.id) });
    else onNarrative({ ...n, addedKpis: [...(n.addedKpis ?? []), a.make()] });
    setPick('');
  };
  const restorable = hiddenSections.length + hiddenCards.length + hiddenKpis.length;

  return (
    <Card title="Add to this report" subtitle="New KPIs use the report’s period and are frozen like the rest of the numbers." className="no-print border-accent/40">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="KPI to add" value={pick} onChange={(e) => setPick(e.target.value)} className="w-auto min-w-[260px]">
            <option value="">Choose a KPI to add…</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Button icon={<Plus size={14} />} disabled={!pick} onClick={addKpi}>
            Add KPI
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <Button icon={<Plus size={14} />} onClick={() => onNarrative({ ...n, cards: [...(n.cards ?? []), { id: newId('card'), label: '', value: '', note: '' }] })}>
            Add a figure
          </Button>
          <Button
            icon={<Plus size={14} />}
            onClick={() => {
              const id = newId('sec');
              onNarrative({ ...n, sections: [...(n.sections ?? []), { id, title: '', body: '' }] });
              // Text sections sit near the end of the report: bring the new one into view.
              setTimeout(() => {
                const el = document.getElementById(`report-section-${id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.querySelector('input')?.focus({ preventScroll: true });
              }, 50);
            }}
          >
            Add a text section
          </Button>
        </div>
        {restorable > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-medium text-muted">Removed, click to put back</span>
            <div className="flex flex-wrap gap-1.5">
              {hiddenSections.map((h) => (
                <Button key={h} size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => unhide(h)} className="border border-line">
                  {REPORT_SECTIONS[h]}
                </Button>
              ))}
              {hiddenCards.map((h) => (
                <Button key={h} size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => unhide(h)} className="border border-line">
                  {CARD_LABEL[h.slice(5)] ?? h.slice(5)}
                </Button>
              ))}
              {hiddenKpis.map((k) => (
                <Button key={k.id} size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => onNarrative({ ...n, hiddenKpis: (n.hiddenKpis ?? []).filter((x) => x !== k.id) })} className="border border-line">
                  KPI: {k.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Mini({ label, value, hint, onRemove }: { label: string; value: string; hint?: string; onRemove?: () => void }) {
  return (
    <div className={cx('relative flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-3.5', onRemove && 'pr-9')}>
      <span className="tabular text-[20px] font-semibold">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
      {onRemove && (
        <IconButton label={`Remove ${label}`} onClick={onRemove} className="absolute top-1.5 right-1.5 h-7 w-7">
          <X size={14} />
        </IconButton>
      )}
    </div>
  );
}
