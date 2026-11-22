import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { useAuth } from '@/app/auth';
import { useSession } from '@/app/session';
import { cx } from '@/components/ui';
import { requestSync, runnerOnline, useNow, useSyncState } from './useSync';

/**
 * Bottom of the menu: "Update data" asks the sync script (npm run sync:watch, on a
 * computer or server) to fetch the latest Discord numbers. Real app only.
 */
export function SyncButton() {
  const { mode, user } = useAuth();
  const { ws, realRole } = useSession();
  const navigate = useNavigate();
  const state = useSyncState(ws.id);
  const now = useNow();
  if (mode !== 'firebase' || !user) return null;

  const connected = !!ws.integrations?.discord?.guildId;
  const isAdmin = realRole === 'admin';
  if (!connected && !isAdmin) return null;

  const online = runnerOnline(state, now);
  const status = state?.status;
  const busy = status === 'running' || (status === 'requested' && online);
  const canPress = realRole !== 'viewer';

  let line: string;
  let tone = 'text-muted';
  if (!connected) line = 'Connect Discord in Settings';
  else if (status === 'running') line = 'Updating…';
  else if (status === 'requested') {
    line = online ? 'Starting…' : 'Waiting for the sync script';
    if (!online) tone = 'text-warning-text';
  } else if (status === 'error') {
    line = 'Last update failed';
    tone = 'text-critical-text';
  } else if (state?.finishedAt) line = `Updated ${formatDistanceStrict(new Date(state.finishedAt), now, { addSuffix: true })}`;
  else line = 'Not updated yet';

  const help = !connected
    ? 'Open Settings → Integrations to connect a Discord server.'
    : status === 'requested' && !online
      ? 'The update is queued. It runs when the sync script is started on a computer or server (npm run sync:watch). See docs/discord.md.'
      : status === 'error'
        ? state?.message
        : (state?.message ?? 'Fetch the latest numbers from Discord.');

  return (
    <button
      type="button"
      disabled={connected ? !canPress || busy : false}
      title={help}
      onClick={() => (connected ? void requestSync(ws.id, user.email) : navigate('/settings?tab=integrations'))}
      className="mb-0.5 flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-soft transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-soft"
    >
      <RefreshCw size={18} aria-hidden className={cx('mt-px shrink-0 text-muted', busy && 'animate-spin')} />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">Update data</span>
        <span className={cx('block truncate text-[12px] leading-snug', tone)} aria-live="polite">
          {line}
        </span>
      </span>
    </button>
  );
}
