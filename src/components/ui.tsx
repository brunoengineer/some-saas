import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Minus, X as Close, XCircle } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { Platform, Status } from '@/data/types';
import { PLATFORM_LABEL, PLATFORM_SHORT } from '@/lib/format';

export const cx = clsx;

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-white hover:brightness-110',
        variant === 'secondary' && 'border border-line bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-soft hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'border border-line bg-surface text-critical-text hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-soft hover:bg-surface-2 hover:text-fg', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  pad = true,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cx('min-w-0 rounded-xl border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-fg">{title}</h2>}
            {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(pad && 'p-4')}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'accent' | 'good' | 'warning' | 'critical' | 'info';

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-soft',
        tone === 'accent' && 'bg-accent-soft text-accent-strong',
        tone === 'good' && 'bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-good-text',
        tone === 'warning' && 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning-text',
        tone === 'critical' && 'bg-[color-mix(in_srgb,var(--critical)_13%,transparent)] text-critical-text',
        tone === 'info' && 'bg-[color-mix(in_srgb,var(--series-1)_13%,transparent)] text-[var(--series-1)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS: Record<Status, { label: string; tone: Tone; icon: ReactNode }> = {
  good: { label: 'On track', tone: 'good', icon: <CheckCircle2 size={13} aria-hidden /> },
  warning: { label: 'At risk', tone: 'warning', icon: <AlertTriangle size={13} aria-hidden /> },
  critical: { label: 'Off track', tone: 'critical', icon: <XCircle size={13} aria-hidden /> },
  none: { label: 'No target', tone: 'neutral', icon: <Minus size={13} aria-hidden /> },
};

export function StatusPill({ status, compact = false }: { status: Status; compact?: boolean }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone}>
      {s.icon}
      {compact ? <span className="sr-only">{s.label}</span> : s.label}
    </Badge>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[13px] font-medium text-soft">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  'h-9 min-w-0 rounded-lg border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-muted';
/** Full width unless the caller sets a width (w-24, w-auto…), so the two never fight. */
const inputCls = (className?: string) => cx(inputBase, !/(^|\s)w-/.test(className ?? '') && 'w-full', className);

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls(props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputCls(cx('h-auto min-h-20 py-2 leading-relaxed', props.className))} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={inputCls(cx('cursor-pointer pr-7', className))}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <span className="text-fg">{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
            o.value === value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('w-full rounded-xl border border-line bg-surface shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <Close size={18} />
          </IconButton>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[640px] flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0 text-base font-semibold">{title}</div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <Close size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-soft ring-1 ring-line"
    >
      {initials}
    </span>
  );
}

export function PlatformBadge({ platform, full = false }: { platform: Platform; full?: boolean }) {
  return (
    <span
      title={PLATFORM_LABEL[platform]}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-line bg-surface-2 px-1 text-[10.5px] font-semibold tracking-wide text-soft"
    >
      {full ? PLATFORM_LABEL[platform] : PLATFORM_SHORT[platform]}
    </span>
  );
}

export const seriesVar = (slot: number) => `var(--series-${((slot - 1 + 8) % 8) + 1})`;

export function Dot({ color, size = 8 }: { color: number; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: seriesVar(color) }} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium text-fg">{title}</p>
      {body && <p className="max-w-md text-[13px] text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [active, onOutside]);
  return ref;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | Status; label: string }) {
  const color =
    tone === 'good' ? 'var(--good)' : tone === 'warning' ? 'var(--warning)' : tone === 'critical' ? 'var(--critical)' : tone === 'none' ? 'var(--muted)' : 'var(--accent)';
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="tabular text-[12px] tracking-wider text-soft" aria-label={`${value} of 5`}>
      {'★'.repeat(value)}
      <span className="text-line-strong">{'★'.repeat(5 - value)}</span>
    </span>
  );
}
