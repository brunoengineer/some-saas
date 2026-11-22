import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Flag, Handshake, Search } from 'lucide-react';
import { useSession } from '@/app/session';
import { dateTimeLabel, longDate } from '@/lib/format';
import { cx } from '@/components/ui';

interface Hit {
  kind: 'Post' | 'Campaign' | 'Partner' | 'Report';
  label: string;
  meta: string;
  to: string;
}

const ICON = { Post: CalendarDays, Campaign: Flag, Partner: Handshake, Report: FileText };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    const match = (...xs: string[]) => !s || xs.some((x) => x.toLowerCase().includes(s));
    const out: Hit[] = [
      ...data.campaigns.filter((c) => match(c.name, c.theme)).map((c) => ({ kind: 'Campaign' as const, label: c.name, meta: `${longDate(c.start)} – ${longDate(c.end)}`, to: `/campaigns/${c.id}` })),
      ...data.partners.filter((p) => match(p.name, p.handle, p.niche)).map((p) => ({ kind: 'Partner' as const, label: p.name, meta: p.handle, to: `/partners/${p.id}` })),
      ...data.reports.filter((r) => match(r.title, r.narrative.headline)).map((r) => ({ kind: 'Report' as const, label: r.title, meta: r.narrative.headline, to: `/reports/${r.id}` })),
      ...data.posts
        .filter((p) => s && match(p.title, p.caption))
        .slice(0, 30)
        .map((p) => ({ kind: 'Post' as const, label: p.title, meta: p.date ? dateTimeLabel(p.date) : 'Idea', to: `/calendar?post=${p.id}${p.date ? `&d=${p.date.slice(0, 10)}` : ''}` })),
    ];
    return out.slice(0, 40);
  }, [q, data]);

  if (!open) return null;
  const go = (h: Hit) => {
    navigate(h.to);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={18} className="text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(hits.length - 1, a + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === 'Enter' && hits[active]) go(hits[active]);
            }}
            placeholder="Search posts, campaigns, partners, reports"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No matches</li>}
          {hits.map((h, i) => {
            const Icon = ICON[h.kind];
            return (
              <li key={`${h.kind}-${h.to}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active && 'bg-surface-2')}
                >
                  <Icon size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-fg">{h.label}</span>
                    <span className="block truncate text-[12px] text-muted">{h.meta}</span>
                  </span>
                  <span className="text-[11.5px] text-muted">{h.kind}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
