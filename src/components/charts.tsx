import { cloneElement, useState, type ReactElement, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { usePrinting } from '@/app/printMode';
import { useSession } from '@/app/session';
import type { Annotation } from '@/data/types';
import { compact, num, shortDate } from '@/lib/format';
import { Card, Segmented } from './ui';

const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];

export function useChartColors() {
  const { dark: screenDark } = useSession();
  // Paper is white: print with the light palette whatever the screen theme.
  const dark = screenDark && !usePrinting();
  return {
    series: (slot: number) => (dark ? DARK : LIGHT)[((slot - 1 + 8) % 8)],
    muted: dark ? '#8f8e88' : '#76756f',
    text: dark ? '#c3c2b7' : '#4a4945',
    line: dark ? '#2e2e2b' : '#e4e3df',
    surface: dark ? '#1a1a19' : '#ffffff',
  };
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-medium text-fg">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-soft">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="tabular ml-auto pl-3 font-medium text-fg">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Responsive on screen. With a fixed `width` (print), the chart renders at
 * that size immediately, so the browser never prints a screen-sized SVG.
 */
function Frame({ width, height, children }: { width?: number; height: number; children: ReactElement }) {
  if (width) return cloneElement(children, { width, height } as Record<string, number>);
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

/** A chart card with a Chart / Table switch, so every chart has a readable table view. */
export function ChartCard({
  title,
  subtitle,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      action={
        <span className="no-print">
          <Segmented
            size="sm"
            label={`${title} view`}
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
          />
        </span>
      }
    >
      {view === 'chart' ? (
        children
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {table.head.map((h, i) => (
                  <th key={h} className={`border-b border-line py-1.5 font-medium ${i ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  {r.map((c, j) => (
                    <td key={j} className={`tabular py-1.5 ${j ? 'text-right' : ''}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function TrendChart({
  data,
  annotations = [],
  name,
  height = 220,
  width,
}: {
  data: { date: string; value: number }[];
  annotations?: Annotation[];
  name: string;
  height?: number;
  width?: number;
}) {
  const c = useChartColors();
  if (!data.length) return <NoData height={height} />;
  const shown = annotations.filter((a) => a.date >= data[0].date && a.date <= data[data.length - 1].date);
  return (
    <Frame width={width} height={height}>
      <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={28} />
        <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: c.muted, strokeDasharray: '3 3' }}
          content={({ active, payload, label }: TooltipProps<number, string>) =>
            active && payload?.length ? (
              <TooltipBox title={shortDate(String(label))} rows={[{ label: name, value: num(Number(payload[0].value)), color: c.series(1) }]} />
            ) : null
          }
        />
        {shown.map((a) => (
          <ReferenceLine
            key={a.date}
            x={a.date}
            stroke={c.muted}
            strokeDasharray="3 3"
            label={{ value: a.label, position: 'insideTopLeft', fill: c.muted, fontSize: 11, offset: 4, dy: -16 }}
          />
        ))}
        <Line isAnimationActive={false} type="monotone" dataKey="value" name={name} stroke={c.series(1)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} />
      </LineChart>
    </Frame>
  );
}

/** Horizontal bars, one per category, each in its own identity color. */
export function CategoryBars({
  data,
  format,
  height,
  valueName,
  width,
}: {
  data: { name: string; value: number | null; color: number; note?: string }[];
  format: (v: number) => string;
  height?: number;
  valueName: string;
  width?: number;
}) {
  const c = useChartColors();
  const rows = data.filter((d) => d.value !== null) as { name: string; value: number; color: number; note?: string }[];
  if (!rows.length) return <NoData height={height ?? 200} />;
  return (
    <Frame width={width} height={height ?? Math.max(120, rows.length * 38 + 10)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: c.line, opacity: 0.4 }}
          content={({ active, payload }: TooltipProps<number, string>) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as (typeof rows)[number];
            return <TooltipBox title={r.name} rows={[{ label: valueName, value: format(r.value), color: c.series(r.color) }, ...(r.note ? [{ label: r.note, value: '' }] : [])]} />;
          }}
        />
        <Bar isAnimationActive={false} dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {rows.map((r) => (
            <Cell key={r.name} fill={c.series(r.color)} stroke={c.surface} strokeWidth={1} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v: number) => format(v)} fill={c.text} stroke="none" fontSize={12} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/** Vertical columns for a single measure split by category (one color). */
export function Columns({
  data,
  valueName,
  height = 220,
  width,
  format = num,
}: {
  data: { label: string; value: number }[];
  valueName: string;
  height?: number;
  width?: number;
  format?: (v: number) => string;
}) {
  const c = useChartColors();
  if (!data.length) return <NoData height={height} />;
  return (
    <Frame width={width} height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.line }} interval={0} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => format(v)} />
        <Tooltip
          cursor={{ fill: c.line, opacity: 0.4 }}
          content={({ active, payload, label }: TooltipProps<number, string>) =>
            active && payload?.length ? <TooltipBox title={String(label)} rows={[{ label: valueName, value: format(Number(payload[0].value)), color: c.series(1) }]} /> : null
          }
        />
        <Bar isAnimationActive={false} dataKey="value" fill={c.series(1)} radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="value" position="top" fill={c.text} stroke="none" fontSize={12} formatter={(v: number) => format(v)} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/** Actual share vs target share per pillar: a bar with a target tick. */
export function MixBars({ data }: { data: { name: string; color: number; share: number; target: number; posts: number }[] }) {
  const max = Math.max(50, ...data.map((d) => Math.max(d.share, d.target)));
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => {
        const off = d.share - d.target;
        return (
          <li key={d.name} className="grid grid-cols-[minmax(0,130px)_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate text-soft">{d.name}</span>
            <span className="relative h-3 rounded-full bg-surface-2" title={`${d.share.toFixed(0)}% of posts, target ${d.target}%`}>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(d.share / max) * 100}%`, background: `var(--series-${d.color})` }} />
              <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg" style={{ left: `${(d.target / max) * 100}%` }} />
            </span>
            <span className="tabular w-28 text-right text-soft">
              <b className="font-semibold text-fg">{d.share.toFixed(0)}%</b> · target {d.target}%
              <span className="sr-only">{off >= 0 ? ` (${off.toFixed(0)} over)` : ` (${(-off).toFixed(0)} under)`}</span>
            </span>
          </li>
        );
      })}
      <li className="flex items-center gap-2 text-[12px] text-muted">
        <span aria-hidden className="inline-block h-3 w-0.5 rounded bg-fg" /> Target share
      </li>
    </ul>
  );
}

export function NoData({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-lg bg-surface-2 text-[13px] text-muted">
      No data in this period
    </div>
  );
}
