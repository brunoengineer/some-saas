import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Button, cx, Field, IconButton, Input, Modal, Select, seriesVar, Textarea } from '@/components/ui';
import type { Campaign, Platform } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { campaignAutoState } from '@/lib/metrics';
import { addDaysIso } from '@/lib/period';
import { STATE_LABEL } from './CampaignsPage';

export function blankCampaign(wsId: string, today: string): Campaign {
  return {
    id: newId('c'),
    wsId,
    name: '',
    theme: '',
    strategy: '',
    start: today,
    end: addDaysIso(today, 27),
    color: 7,
    channels: [],
    budget: 0,
    ownerId: null,
    goals: [],
  };
}

export function CampaignForm({ campaign, isNew, onClose }: { campaign: Campaign | null; isNew: boolean; onClose: () => void }) {
  const { ws, data, today } = useSession();
  const actions = useActions();
  const [c, setC] = useState<Campaign | null>(campaign);
  useEffect(() => setC(campaign), [campaign]);
  if (!c) return null;
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC({ ...c, [k]: v });
  const valid = c.name.trim() && c.start <= c.end;

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? 'New campaign' : `Edit ${campaign?.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              actions.saveCampaign({ ...c, goals: c.goals.filter((g) => g.kpiId) }, isNew);
              onClose();
            }}
          >
            {isNew ? 'Create campaign' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="e.g. Founding Tournament" />
        </Field>
        <Field label="Theme" hint="One line: the idea behind it.">
          <Input value={c.theme} onChange={(e) => set('theme', e.target.value)} />
        </Field>
        <Field label="Strategy" className="sm:col-span-2" hint="How it works, the hook, the rules, who it’s for.">
          <Textarea value={c.strategy} onChange={(e) => set('strategy', e.target.value)} rows={4} />
        </Field>
        <Field label="Start">
          <Input type="date" value={c.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label="End">
          <Input type="date" value={c.end} min={c.start} onChange={(e) => set('end', e.target.value)} />
        </Field>
        <Field
          label="Status"
          className="sm:col-span-2"
          hint={c.status ? 'Set by hand: it stays this way whatever the dates say, until you change it.' : `Follows the dates: ${STATE_LABEL[campaignAutoState(c, today)].toLowerCase()} today.`}
        >
          <Select value={c.status ?? ''} onChange={(e) => set('status', (e.target.value || null) as Campaign['status'])}>
            <option value="">Automatic, from the dates</option>
            <option value="planned">Planned</option>
            <option value="live">Live</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field label="Budget (USD)">
          <Input type="number" min={0} value={c.budget} onChange={(e) => set('budget', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Owner">
          <Select value={c.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || null)}>
            <option value="">No owner</option>
            {ws.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Calendar tag color">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Color ${n}`}
                aria-pressed={c.color === n}
                onClick={() => set('color', n)}
                className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface', c.color === n && 'ring-2 ring-fg')}
                style={{ background: seriesVar(n) }}
              />
            ))}
          </div>
        </Field>
        <Field label="Channels">
          <div className="flex flex-wrap gap-1.5">
            {ws.platforms.map((p: Platform) => {
              const on = c.channels.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('channels', on ? c.channels.filter((x) => x !== p) : [...c.channels, p])}
                  className={cx('rounded-lg border px-2.5 py-1 text-[13px]', on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-soft')}
                >
                  {PLATFORM_LABEL[p]}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-medium text-soft">Goals</span>
          <p className="text-[12px] text-muted">Pick KPIs and a target for the campaign. Progress is measured on posts and partner results tagged to this campaign.</p>
          {c.goals.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                aria-label="KPI"
                value={g.kpiId}
                onChange={(e) => set('goals', c.goals.map((x, j) => (j === i ? { ...x, kpiId: e.target.value } : x)))}
              >
                <option value="">Choose a KPI</option>
                {data.kpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Target"
                type="number"
                className="w-32"
                value={g.target}
                onChange={(e) => set('goals', c.goals.map((x, j) => (j === i ? { ...x, target: Number(e.target.value) || 0 } : x)))}
              />
              <IconButton label="Remove goal" onClick={() => set('goals', c.goals.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          <div>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => set('goals', [...c.goals, { kpiId: '', target: 0 }])}>
              Add goal
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
