/** A tiny trend line for a row: values oldest first, gaps for missing periods. */
export function Sparkline({ values, label, width = 96, height = 28 }: { values: (number | null)[]; label: string; width?: number; height?: number }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <span className="text-[12px] text-muted">—</span>;
  const vs = pts.map((p) => p[1]);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const pad = 3;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const [li, lv] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(li)} cy={y(lv)} r={2.75} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
