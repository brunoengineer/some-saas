import { useState } from 'react';
import { newId } from '@/app/actions';
import { Button, cx, Field, Input } from '@/components/ui';
import { repo } from '@/data';
import type { Member, Platform } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { ACCENTS, ALL_PLATFORMS, buildWorkspace } from '@/lib/newWorkspace';

/** Name, accent and platforms for a new workspace. Used by "New workspace" and by first-time setup. */
export function NewWorkspaceForm({ admin, onCreated, onCancel, submitLabel = 'Create workspace' }: { admin: Member; onCreated: (wsId: string) => void; onCancel?: () => void; submitLabel?: string }) {
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [platforms, setPlatforms] = useState<Platform[]>(['x']);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const id = newId('ws');
    const { ws, kpis } = buildWorkspace({ id, name, accent, platforms, admin, now: new Date().toISOString().slice(0, 16) });
    setBusy(true);
    try {
      // The workspace first: the security rules check it before allowing its KPIs.
      await repo.upsert('workspaces', ws);
      await repo.upsertMany('kpis', kpis);
      onCreated(id);
    } catch {
      // The error banner already explains what happened.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && platforms.length) void create();
      }}
    >
      <p className="text-[13px] text-muted">One workspace per brand or client. Posts, KPIs, partners and members are kept separate. It starts with four standard KPIs you can change.</p>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flush.io" autoFocus />
      </Field>
      <Field label="Accent color">
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              aria-label={`Accent ${a}`}
              aria-pressed={a === accent}
              onClick={() => setAccent(a)}
              className={cx('h-8 w-8 rounded-lg ring-offset-2 ring-offset-surface', a === accent && 'ring-2 ring-fg')}
              style={{ background: a }}
            />
          ))}
        </div>
      </Field>
      <Field label="Platforms">
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => {
            const on = platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                className={cx('rounded-lg border px-2.5 py-1 text-[13px]', on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-soft')}
              >
                {PLATFORM_LABEL[p]}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={!name.trim() || !platforms.length || busy}>
          {busy ? 'Creating…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
