import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { useActions } from '@/app/actions';
import { useAuth } from '@/app/auth';
import { useSession } from '@/app/session';
import { Badge, Button, Card, Field, IconButton, Input } from '@/components/ui';
import { inviteCode } from '@/lib/discordSync';
import { dateTimeLabel } from '@/lib/format';
import { requestSync, runnerOnline, useNow, useSyncState } from '@/features/sync/useSync';

/** Settings → Integrations: connect Discord, see how the last sync went. */
export function IntegrationsTab() {
  const { mode } = useAuth();
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DiscordCard />
      <div className="flex flex-col gap-3">
        <Card title="How updating works">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] text-soft">
            <li>
              A small sync script fetches the numbers. Run <code className="rounded bg-surface-2 px-1">npm run sync:watch</code> on a computer or the company server and leave it open. It waits, and fetches only when someone presses <b>Update data</b> at the bottom of the menu. Nothing runs on a schedule.
            </li>
            <li>
              Or run <code className="rounded bg-surface-2 px-1">npm run sync</code> to fetch once from the terminal, without the button.
            </li>
            <li>The full set-up, step by step, is in the project at <code className="rounded bg-surface-2 px-1">docs/discord.md</code>.</li>
            {mode !== 'firebase' && <li>The prototype can’t sync: it has no shared database for the script to write to.</li>}
          </ul>
        </Card>
        <Card title="X" action={<Badge>Not connected</Badge>}>
          <p className="text-[13.5px] text-soft">
            X’s API is paid per use now. Until it’s connected, bring X numbers in with Settings → Import (channel stats and post results from a CSV), or type post results in the post drawer.
          </p>
        </Card>
      </div>
    </div>
  );
}

function DiscordCard() {
  const { ws, can, data, user } = useSession();
  const actions = useActions();
  const state = useSyncState(ws.id);
  const now = useNow();
  const saved = ws.integrations?.discord;
  const [guildId, setGuildId] = useState(saved?.guildId ?? '');
  const [labels, setLabels] = useState<{ code: string; label: string }[]>(Object.entries(saved?.labels ?? {}).map(([code, label]) => ({ code, label })));
  const disabled = !can('settings');

  const cleanLabels = Object.fromEntries(labels.map((l) => [inviteCode(l.code) ?? l.code.trim(), l.label.trim()]).filter(([c, l]) => c && l));
  const validId = /^\d{15,22}$/.test(guildId.trim());
  const dirty = guildId.trim() !== (saved?.guildId ?? '') || JSON.stringify(cleanLabels) !== JSON.stringify(saved?.labels ?? {});
  const partnerCodes = data.partners
    .map((p) => ({ name: p.name, code: p.trackingCode ? inviteCode(p.trackingCode) : null }))
    .filter((p): p is { name: string; code: string } => !!p.code);

  const save = () => {
    const platforms = ws.platforms.includes('discord') ? ws.platforms : [...ws.platforms, 'discord' as const];
    actions.saveWorkspace({ ...ws, platforms, integrations: { ...ws.integrations, discord: { guildId: guildId.trim(), labels: cleanLabels } } }, 'the Discord connection');
  };
  const disconnect = () => {
    if (!window.confirm('Disconnect Discord? Numbers already fetched stay; nothing new is fetched.')) return;
    const { discord: _d, ...rest } = ws.integrations ?? {};
    actions.saveWorkspace({ ...ws, integrations: rest }, 'the Discord connection (disconnected)');
    setGuildId('');
    setLabels([]);
  };

  const online = runnerOnline(state, now);
  const statusBadge = !saved ? (
    <Badge>Not connected</Badge>
  ) : state?.status === 'error' ? (
    <Badge tone="critical">Last update failed</Badge>
  ) : state?.finishedAt ? (
    <Badge tone="good">Connected</Badge>
  ) : (
    <Badge tone="warning">Waiting for the first update</Badge>
  );

  return (
    <Card title="Discord" subtitle="Members, joins, messages, activity and retention." action={statusBadge}>
      <div className="flex flex-col gap-4">
        {saved && (
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
            <p className="text-soft">
              {state?.finishedAt ? (
                <>
                  Last update {formatDistanceStrict(new Date(state.finishedAt), now, { addSuffix: true })} ({dateTimeLabel(state.finishedAt)}).
                </>
              ) : (
                'No update yet.'
              )}{' '}
              {online ? (
                <>
                  Sync script running on <b className="font-medium text-fg">{state?.runner}</b>.
                </>
              ) : (
                'Sync script not running right now.'
              )}
            </p>
            {state?.message && <p className={state.status === 'error' ? 'mt-1 text-critical-text' : 'mt-1 text-muted'}>{state.message}</p>}
            {can('comment') && user && (
              <Button size="sm" className="mt-2" disabled={state?.status === 'running' || (state?.status === 'requested' && online)} onClick={() => void requestSync(ws.id, user.email)}>
                Update now
              </Button>
            )}
          </div>
        )}

        <fieldset disabled={disabled} className="flex flex-col gap-4">
          <Field label="Server ID" hint="In Discord: User Settings → Advanced → turn on Developer Mode. Then right-click the server icon → Copy Server ID.">
            <Input value={guildId} inputMode="numeric" placeholder="e.g. 1234567890123456789" onChange={(e) => setGuildId(e.target.value.replace(/[^\d]/g, ''))} className="max-w-xs font-mono" />
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium text-soft">Invite links and their source names</p>
            <p className="text-[12px] text-muted">
              New members are credited to the invite link they used. Partners’ tracking links are matched by themselves
              {partnerCodes.length ? `: ${partnerCodes.map((p) => `${p.code} → ${p.name}`).join(', ')}` : ''}. Name your other links here (e.g. the one in the X bio). Links without a name show as “Invite code”.
            </p>
            {labels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={`Invite link ${i + 1}`} placeholder="discord.gg/flush-x" value={l.code} onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} className="min-w-0 flex-1 font-mono" />
                <Input aria-label={`Source name ${i + 1}`} placeholder="X bio" value={l.label} onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1" />
                <IconButton label="Remove link" onClick={() => setLabels(labels.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
            <div>
              <Button size="sm" onClick={() => setLabels([...labels, { code: '', label: '' }])}>
                Add an invite link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Button variant="primary" disabled={!validId || !dirty} onClick={save}>
              {saved ? 'Save changes' : 'Connect Discord'}
            </Button>
            {saved && (
              <Button variant="danger" onClick={disconnect}>
                Disconnect
              </Button>
            )}
            {guildId && !validId && <span className="text-[12px] text-critical-text">A server ID is a long number (17 to 20 digits).</span>}
          </div>
        </fieldset>
      </div>
    </Card>
  );
}
