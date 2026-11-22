import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cx } from './ui';

export interface Col<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string | null;
  align?: 'right';
  className?: string;
}

export function DataTable<T>({
  rows,
  cols,
  rowKey,
  initialSort,
  onRow,
  empty = 'Nothing to show',
  dense,
  limit,
}: {
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRow?: (r: T) => void;
  empty?: ReactNode;
  dense?: boolean;
  /** Show only the first N rows until the user asks for all. */
  limit?: number;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const r = x < y ? -1 : 1;
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, cols, sort]);

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] text-[13.5px]">
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cx('border-b border-line py-2 pr-3 text-[12px] font-medium whitespace-nowrap text-muted last:pr-0', c.align === 'right' ? 'text-right' : 'text-left', c.className)}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      className={cx('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg')}
                      onClick={() => setSort({ key: c.key, dir: active && sort!.dir === 'desc' ? 'asc' : 'desc' })}
                    >
                      {c.label}
                      {active && (sort!.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="py-6 text-center text-[13px] text-muted">
                {empty}
              </td>
            </tr>
          )}
          {(limit && !all ? sorted.slice(0, limit) : sorted).map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRow ? () => onRow(r) : undefined}
              className={cx('border-b border-line/70 last:border-0', onRow && 'cursor-pointer hover:bg-surface-2')}
            >
              {cols.map((c) => (
                <td key={c.key} className={cx(dense ? 'py-1.5' : 'py-2.5', 'pr-3 align-middle last:pr-0', c.align === 'right' && 'tabular text-right', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit !== undefined && sorted.length > limit && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 text-[13px] font-medium text-accent-strong hover:underline">
          {all ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
