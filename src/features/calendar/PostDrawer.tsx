import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { newId, useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { Comments } from '@/components/Comments';
import { PlatformIcon, previewPlatform } from '@/components/PlatformIcon';
import { Badge, Button, cx, Drawer, Field, Input, Segmented, Select, Textarea } from '@/components/ui';
import type { Platform, Post, PostMetrics } from '@/data/types';
import { compressImage, PLATFORM_CROP } from '@/lib/image';
import { num, PLATFORM_LABEL, PLATFORM_LIMIT, safeUrl } from '@/lib/format';
import { canEditPost } from '@/lib/permissions';
import { FORMATS, STATUS_LABEL, STATUS_TONE, STATUSES } from './postMeta';
import { PostPreview } from './PostPreview';

type Tab = 'details' | 'preview' | 'checklist' | 'results' | 'comments';

const LIVE_PLACEHOLDER: Record<Platform, string> = {
  x: 'https://x.com/…/status/…',
  instagram: 'https://www.instagram.com/p/…',
  tiktok: 'https://www.tiktok.com/@…/video/…',
  youtube: 'https://www.youtube.com/watch?v=…',
  linkedin: 'https://www.linkedin.com/feed/update/…',
  discord: 'https://discord.com/channels/…',
  telegram: 'https://t.me/…/…',
  kick: 'https://kick.com/…',
};

/** A post being edited: the platform can still be unchosen ('') on a new post. */
export type PostDraft = Omit<Post, 'platform'> & { platform: Platform | '' };

export function blankPost(wsId: string, date: string | null, defaults: Partial<PostDraft> = {}): PostDraft {
  return {
    id: newId('post'),
    wsId,
    title: '',
    caption: '',
    thread: '',
    platform: '',
    pillarId: '',
    format: 'text',
    status: date ? 'draft' : 'idea',
    date,
    campaignId: null,
    partnerId: null,
    assigneeId: null,
    link: '',
    checklist: {},
    metrics: null,
    image: null,
    ...defaults,
  };
}

export function PostDrawer({ post: postIn, isNew, onClose }: { post: PostDraft | null; isNew: boolean; onClose: () => void }) {
  // Saved posts always have a platform; only a new draft can be without one.
  const post = postIn as Post | null;
  const { ws, data, role, can } = useSession();
  const actions = useActions();
  const [draft, setDraft] = useState<PostDraft | null>(postIn);
  const [tab, setTab] = useState<Tab>('details');
  const [note, setNote] = useState('');

  useEffect(() => {
    setDraft(postIn);
    setTab('details');
    setNote('');
  }, [postIn]);

  const editable = !!post && canEditPost(role, ws.settings, isNew ? null : post);
  const discordChannels = useMemo(
    () => [...new Set(['announcements', 'general', 'events', ...data.posts.map((p) => p.channel ?? '').filter(Boolean)])].sort(),
    [data.posts],
  );
  const comments = useMemo(() => (post ? data.comments.filter((c) => c.targetType === 'post' && c.targetId === post.id).length : 0), [data.comments, post]);
  if (!post || !draft) return null;

  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setDraft({ ...draft, [k]: v });
  const limit = draft.platform ? PLATFORM_LIMIT[draft.platform] : undefined;
  const checklistDone = ws.checklist.filter((c) => draft.checklist[c]).length;
  const needsChecklist = ['approved', 'scheduled', 'published'].includes(draft.status) && checklistDone < ws.checklist.length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(postIn);
  const canSave = editable && draft.title.trim() && draft.pillarId && draft.platform;

  const save = () => {
    if (!draft.platform) return;
    actions.savePost({ ...draft, platform: draft.platform }, isNew);
    onClose();
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: 'details', label: 'Details' },
    { value: 'preview', label: 'Preview' },
    { value: 'checklist', label: `Checklist ${checklistDone}/${ws.checklist.length}` },
    { value: 'results', label: 'Results' },
    ...(isNew ? [] : [{ value: 'comments' as Tab, label: `Comments${comments ? ` (${comments})` : ''}` }]),
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {isNew ? 'New post' : draft.title || 'Untitled'}
          {!isNew && <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>}
          {!editable && <Badge>Read-only</Badge>}
        </span>
      }
      footer={
        <>
          {!isNew && editable && (
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={() => {
                if (window.confirm(`Delete “${post.title}”?`)) {
                  actions.deletePost(post);
                  onClose();
                }
              }}
            >
              Delete
            </Button>
          )}
          {!isNew && can('edit') && (
            <Button
              icon={<Copy size={15} />}
              onClick={() => {
                actions.savePost({ ...post, id: newId('post'), status: 'idea', date: null, metrics: null, title: `${post.title} (evergreen)` }, true);
                onClose();
              }}
            >
              Reuse as idea
            </Button>
          )}
          <span className="flex-1 text-[12.5px] text-muted">{editable && !canSave && (isNew || dirty) ? 'Title, platform and pillar are required.' : ''}</span>
          <Button onClick={onClose}>{editable && dirty ? 'Cancel' : 'Close'}</Button>
          {editable && (
            <Button variant="primary" disabled={!canSave || (!dirty && !isNew)} onClick={save}>
              {isNew ? 'Create post' : 'Save changes'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {post.status === 'review' && !isNew && can('approve') && (
          <div className="flex flex-col gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_9%,transparent)] p-3">
            <p className="text-[13.5px] font-medium">This post is waiting for review.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the author" rows={2} aria-label="Review note" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<CheckCircle2 size={15} />}
                onClick={() => {
                  actions.review(post, 'approved', note);
                  onClose();
                }}
              >
                Approve
              </Button>
              <Button
                icon={<RotateCcw size={15} />}
                onClick={() => {
                  actions.review(post, 'changes', note);
                  onClose();
                }}
              >
                Request changes
              </Button>
            </div>
          </div>
        )}
        {needsChecklist && (
          <p className="flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-3 py-2 text-[13px] text-warning-text">
            <AlertTriangle size={15} aria-hidden /> {ws.checklist.length - checklistDone} compliance item(s) not ticked.
          </p>
        )}

        <Segmented label="Post sections" value={tab} onChange={setTab} options={tabs} size="sm" />

        {tab === 'details' && (
          <fieldset disabled={!editable} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PostImage draft={draft} editable={editable} onChange={(image) => set('image', image)} onPreview={() => setTab('preview')} />
            <Field label="Title (internal)" className="sm:col-span-2">
              <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Poll: what makes you trust a casino?" autoFocus={isNew} />
            </Field>
            <Field
              label="Caption"
              className="sm:col-span-2"
              hint={
                limit ? (
                  <span className={cx(draft.caption.length > limit && 'font-medium text-critical-text')}>
                    {num(draft.caption.length)} / {num(limit)} characters on {PLATFORM_LABEL[draft.platform as Platform]}
                  </span>
                ) : undefined
              }
            >
              <Textarea value={draft.caption} onChange={(e) => set('caption', e.target.value)} rows={4} />
            </Field>
            <Field label="First reply / thread" className="sm:col-span-2" hint="Links and T&Cs go here so the main post isn’t down-ranked.">
              <Textarea value={draft.thread} onChange={(e) => set('thread', e.target.value)} rows={2} />
            </Field>
            <Field label="Platform">
              <Select value={draft.platform} onChange={(e) => set('platform', e.target.value as PostDraft['platform'])}>
                {!draft.platform && <option value="">Choose a platform</option>}
                {ws.platforms.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.platform === 'discord' && (
              <Field label="Discord channel" hint="Where it gets posted on the server.">
                <span className="relative block">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">#</span>
                  <Input
                    list="discord-channels"
                    value={draft.channel ?? ''}
                    onChange={(e) => set('channel', e.target.value.replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase())}
                    placeholder="announcements"
                    className="pl-6"
                  />
                  <datalist id="discord-channels">
                    {discordChannels.map((ch) => (
                      <option key={ch} value={ch} />
                    ))}
                  </datalist>
                </span>
              </Field>
            )}
            <Field label="Format">
              <Select value={draft.format} onChange={(e) => set('format', e.target.value as Post['format'])}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pillar">
              <Select value={draft.pillarId} onChange={(e) => set('pillarId', e.target.value)}>
                <option value="">Choose a pillar</option>
                {ws.pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={(e) => set('status', e.target.value as Post['status'])}>
                {STATUSES.filter((s) => role === 'admin' || s === 'idea' || s === 'draft' || s === 'review').map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date and time">
              <Input type="datetime-local" value={draft.date ?? ''} onChange={(e) => set('date', e.target.value || null)} />
            </Field>
            <Field label="Assignee">
              <Select value={draft.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value || null)}>
                <option value="">Unassigned</option>
                {ws.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Campaign">
              <Select value={draft.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || null)}>
                <option value="">No campaign</option>
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Partner (collab)"
              hint={
                draft.partnerId && editable
                  ? `Saving adds “${draft.title || 'this post'}” to ${data.partners.find((p) => p.id === draft.partnerId)?.name ?? 'the partner'}’s deliverables, or keeps it in sync.`
                  : undefined
              }
            >
              <Select value={draft.partnerId ?? ''} onChange={(e) => set('partnerId', e.target.value || null)}>
                <option value="">None</option>
                {data.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Link to the live post" className="sm:col-span-2" hint="Once it’s published. The calendar card shows a link icon that opens it.">
              <span className="flex gap-2">
                <Input type="url" value={draft.postUrl ?? ''} onChange={(e) => set('postUrl', e.target.value.trim())} placeholder={LIVE_PLACEHOLDER[draft.platform || 'x']} />
                {safeUrl(draft.postUrl) && (
                  <a href={safeUrl(draft.postUrl)!} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-soft hover:bg-surface-2" aria-label="Open the live post (opens a new tab)">
                    <ExternalLink size={14} /> Open
                  </a>
                )}
              </span>
            </Field>
            <UtmBuilder link={draft.link} onChange={(l) => set('link', l)} campaign={data.campaigns.find((c) => c.id === draft.campaignId)?.name} platform={draft.platform || 'social'} />
          </fieldset>
        )}

        {tab === 'preview' && <PostPreview post={draft} />}

        {tab === 'checklist' && (
          <fieldset disabled={!editable} className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">Tick every item before a post is approved or scheduled. Admins edit the list in Settings.</p>
            {ws.checklist.map((c) => (
              <label key={c} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13.5px]">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!draft.checklist[c]} onChange={(e) => set('checklist', { ...draft.checklist, [c]: e.target.checked })} />
                {c}
              </label>
            ))}
          </fieldset>
        )}

        {tab === 'results' && <Results draft={draft} editable={editable} onChange={(m) => set('metrics', m)} />}

        {tab === 'comments' && <Comments targetType="post" targetId={post.id} label={`“${post.title}”`} link={`/calendar?post=${post.id}`} />}
      </div>
    </Drawer>
  );
}

function Results({ draft, editable, onChange }: { draft: PostDraft; editable: boolean; onChange: (m: PostMetrics | null) => void }) {
  const m = draft.metrics ?? { impressions: 0, engagements: 0, clicks: 0, profileVisits: 0 };
  const field = (k: keyof PostMetrics, label: string) => (
    <Field label={label}>
      <Input type="number" min={0} value={draft.metrics ? m[k] : ''} placeholder="0" onChange={(e) => onChange({ ...m, [k]: Math.max(0, Number(e.target.value) || 0) })} />
    </Field>
  );
  return (
    <fieldset disabled={!editable} className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">Enter the numbers from the platform’s analytics after publishing, or import a CSV in Settings → Import.</p>
      <div className="grid grid-cols-2 gap-3">
        {field('impressions', 'Impressions')}
        {field('engagements', 'Engagements')}
        {field('clicks', 'Link clicks')}
        {field('profileVisits', 'Profile visits')}
      </div>
      {draft.metrics && draft.metrics.impressions > 0 && (
        <p className="text-[13.5px]">
          Engagement rate: <b className="tabular">{((draft.metrics.engagements / draft.metrics.impressions) * 100).toFixed(1)}%</b>
        </p>
      )}
      {draft.metrics && draft.status !== 'published' && <p className="text-[12.5px] text-muted">Results only count once the status is Published.</p>}
    </fieldset>
  );
}

function UtmBuilder({ link, onChange, campaign, platform }: { link: string; onChange: (l: string) => void; campaign?: string; platform: string }) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState('');
  const build = () => {
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const u = new URL(base || link.split('?')[0]);
      u.searchParams.set('utm_source', platform);
      u.searchParams.set('utm_medium', 'social');
      if (campaign) u.searchParams.set('utm_campaign', slug(campaign));
      onChange(u.toString());
      setOpen(false);
    } catch {
      window.alert('Enter a full URL, e.g. https://example.com/page');
    }
  };
  return (
    <Field label="Tracked link" className="sm:col-span-2" hint="UTM tags let you see in analytics which post brought the visit.">
      <div className="flex gap-2">
        <Input value={link} onChange={(e) => onChange(e.target.value)} placeholder="https://" />
        <Button size="md" onClick={() => setOpen((o) => !o)}>
          UTM
        </Button>
      </div>
      {open && (
        <span className="mt-1 flex gap-2">
          <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Page URL, e.g. https://flush.io/draw" aria-label="Page URL" />
          <Button variant="primary" onClick={build}>
            Build
          </Button>
        </span>
      )}
    </Field>
  );
}

/**
 * The post's image at the top of the details, cropped the way its platform
 * crops it (X when no platform is chosen). Drop or pick a file to add one.
 */
function PostImage({ draft, editable, onChange, onPreview }: { draft: PostDraft; editable: boolean; onChange: (image: string | null) => void; onPreview: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const platform = previewPlatform(draft.platform);
  const crop = PLATFORM_CROP[platform];
  const portrait = crop.ratio < 1;

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await compressImage(file));
    } catch (e) {
      setError((e as Error).message || 'Couldn’t read that image.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const dragOver = (e: DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    setOver(true);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (editable) void take(e.dataTransfer.files[0]);
  };

  if (!draft.image && !editable) return null;
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-[13px] font-medium text-soft">Image</span>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
      {draft.image ? (
        <div onDragOver={dragOver} onDragLeave={() => setOver(false)} onDrop={drop} className={cx('flex justify-center rounded-xl border bg-surface-2 p-2', over ? 'border-accent' : 'border-line')}>
          <button
            type="button"
            onClick={onPreview}
            title="Open the full preview"
            className="relative overflow-hidden rounded-lg"
            style={portrait ? { height: 320, aspectRatio: crop.ratio } : { width: '100%', aspectRatio: crop.ratio }}
          >
            <img src={draft.image} alt={`Image for ${draft.title || 'this post'}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={dragOver}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={cx('flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-[13px] text-muted hover:border-accent hover:text-fg', over ? 'border-accent text-fg' : 'border-line-strong')}
        >
          <ImagePlus size={20} aria-hidden />
          {busy ? 'Preparing image…' : 'Drop an image here, or click to choose one'}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <PlatformIcon platform={platform} size={13} />
          {draft.platform ? `Cropped as ${PLATFORM_LABEL[platform]} shows it (${crop.label})` : `No platform chosen: showing X (${crop.label})`}
        </span>
        {draft.image && editable && (
          <span className="ml-auto flex gap-1.5">
            <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Preparing…' : 'Replace'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              Remove
            </Button>
          </span>
        )}
      </div>
      {error && <p className="text-[12.5px] text-critical-text">{error}</p>}
    </div>
  );
}
