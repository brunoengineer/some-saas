import type { ReactNode } from 'react';
import { BarChart2, Bookmark, Eye, Globe, Heart, MessageCircle, MessageSquare, Music2, Play, Repeat2, Send, Share2, ThumbsUp } from 'lucide-react';
import { useSession } from '@/app/session';
import { PlatformIcon, previewPlatform } from '@/components/PlatformIcon';
import { cx } from '@/components/ui';
import type { Platform, PostMetrics } from '@/data/types';
import { compact, dateTimeLabel, PLATFORM_LABEL, timeOf } from '@/lib/format';
import { PLATFORM_CROP } from '@/lib/image';
import type { PostDraft } from './PostDrawer';

const VIDEO = new Set(['video', 'stream']);
const VISUAL = new Set(['image', 'meme', 'video', 'stream', 'event']);
const DARK: Platform[] = ['tiktok', 'discord', 'kick'];

/**
 * A phone-style preview of the post as it will look on its platform (X when
 * none is chosen yet). Numbers appear once results are entered.
 */
export function PostPreview({ post }: { post: PostDraft }) {
  const { ws } = useSession();
  const platform = previewPlatform(post.platform);
  const p: Ctx = {
    post,
    platform,
    name: ws.name,
    handle: ws.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    initials: ws.initials,
    accent: ws.accent,
    m: post.metrics,
    video: VIDEO.has(post.format) || platform === 'tiktok',
  };
  const dark = DARK.includes(platform);
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <PlatformIcon platform={platform} size={13} /> {post.platform ? `How it looks on ${PLATFORM_LABEL[platform]}` : 'No platform chosen yet: showing X'}
      </p>
      <div className="w-[320px] rounded-[36px] border-[10px] border-[#111] bg-[#111] shadow-xl">
        <div className={cx('overflow-hidden rounded-[26px]', dark ? 'bg-black text-white' : 'bg-white text-[#0f1419]')}>
          <div className={cx('flex items-center justify-between px-5 pt-2 pb-1 text-[11px] font-semibold', dark && 'text-white')}>
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-[#111]" />
            <span>100%</span>
          </div>
          {SCREENS[platform](p)}
        </div>
      </div>
    </div>
  );
}

interface Ctx {
  post: PostDraft;
  platform: Platform;
  name: string;
  handle: string;
  initials: string;
  accent: string;
  m: PostMetrics | null;
  video: boolean;
}

const n = (m: PostMetrics | null, f: (m: PostMetrics) => number) => (m ? compact(Math.round(f(m))) : '');

function Avatar({ c, size = 40, square = false }: { c: Ctx; size?: number; square?: boolean }) {
  return (
    <span className={cx('flex shrink-0 items-center justify-center font-bold text-white', square ? 'rounded-md' : 'rounded-full')} style={{ width: size, height: size, background: c.accent, fontSize: size * 0.36 }}>
      {c.initials}
    </span>
  );
}

/** The post image cropped the way the platform crops it, or a placeholder when a visual post has no image yet. */
function Media({ c, className, ratio, always = false }: { c: Ctx; className?: string; ratio?: number; always?: boolean }) {
  const r = ratio ?? PLATFORM_CROP[c.platform].ratio;
  if (!c.post.image && !always && !VISUAL.has(c.post.format)) return null;
  return (
    <div className={cx('relative overflow-hidden bg-[#e7ecef]', className)} style={{ aspectRatio: r }}>
      {c.post.image ? (
        <img src={c.post.image} alt="Post image" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[#536471]">No image yet</span>
      )}
      {c.video && c.post.image && (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
          <Play size={11} fill="currentColor" /> Video
        </span>
      )}
    </div>
  );
}

function Caption({ text, className }: { text: string; className?: string }) {
  return <p className={cx('whitespace-pre-wrap', className)}>{text || <span className="italic opacity-60">No caption yet</span>}</p>;
}

function Poll({ c, color }: { c: Ctx; color: string }) {
  if (c.post.format !== 'poll') return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {['Option 1', 'Option 2', 'Option 3'].map((o) => (
        <div key={o} className="rounded-full border px-3 py-1 text-center text-[13px] font-semibold" style={{ borderColor: color, color }}>
          {o}
        </div>
      ))}
    </div>
  );
}

const when = (c: Ctx) => (c.post.date ? dateTimeLabel(c.post.date) : 'Not scheduled');

function XScreen(c: Ctx) {
  return (
    <>
      <div className="flex justify-center border-b border-[#eff3f4] py-2">
        <PlatformIcon platform="x" size={18} />
      </div>
      <div className="flex gap-2.5 px-4 py-3">
        <Avatar c={c} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] leading-tight">
            <b>{c.name}</b> <span className="text-[#536471]">@{c.handle}</span>
          </p>
          <Caption text={c.post.caption} className="mt-1 text-[14px] leading-snug" />
          <Media c={c} className="mt-2 rounded-2xl border border-[#cfd9de]" />
          <Poll c={c} color="#1d9bf0" />
          <p className="mt-2 text-[12px] text-[#536471]">{when(c)}</p>
          <div className="mt-2 flex justify-between pr-2 text-[12px] text-[#536471]">
            <span className="flex items-center gap-1"><MessageCircle size={14} /> {n(c.m, (m) => m.engagements * 0.18)}</span>
            <span className="flex items-center gap-1"><Repeat2 size={14} /> {n(c.m, (m) => m.engagements * 0.12)}</span>
            <span className="flex items-center gap-1"><Heart size={14} /> {n(c.m, (m) => m.engagements * 0.55)}</span>
            <span className="flex items-center gap-1"><BarChart2 size={14} /> {n(c.m, (m) => m.impressions)}</span>
          </div>
        </div>
      </div>
      {c.post.thread && (
        <div className="flex gap-2.5 border-t border-[#eff3f4] px-4 py-3">
          <Avatar c={c} size={32} />
          <p className="text-[13px] leading-snug whitespace-pre-wrap">
            <span className="block text-[12px] text-[#536471]">First reply</span>
            {c.post.thread}
          </p>
        </div>
      )}
      <div className="h-5" />
    </>
  );
}

function InstagramScreen(c: Ctx) {
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[2px]">
          <span className="block rounded-full bg-white p-[1.5px]">
            <Avatar c={c} size={28} />
          </span>
        </span>
        <b className="min-w-0 flex-1 truncate text-[13px]">{c.handle}</b>
        <span className="text-[16px] leading-none">···</span>
      </div>
      <Media c={c} always />
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart size={22} />
        <MessageCircle size={22} />
        <Send size={21} />
        <Bookmark size={22} className="ml-auto" />
      </div>
      <div className="px-3 pt-1.5 pb-4 text-[13px]">
        {c.m && <p className="font-semibold">{n(c.m, (m) => m.engagements * 0.8)} likes</p>}
        <p className="mt-0.5 line-clamp-3">
          <b>{c.handle}</b> <span className="whitespace-pre-wrap">{c.post.caption || <i className="opacity-60">No caption yet</i>}</span>
        </p>
        <p className="mt-1 text-[11px] text-[#737373] uppercase">{when(c)}</p>
      </div>
    </>
  );
}

function TikTokScreen(c: Ctx) {
  return (
    <div className="relative bg-[#111]" style={{ aspectRatio: 9 / 16 }}>
      {c.post.image ? (
        <img src={c.post.image} alt="Post image" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[12px] text-white/60">No video or image yet</span>
      )}
      <div className="absolute inset-x-0 top-2 flex justify-center gap-4 text-[13px] font-semibold text-white/70">
        <span>Following</span>
        <span className="border-b-2 border-white text-white">For You</span>
      </div>
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3.5 text-[11px] font-semibold text-white">
        <Avatar c={c} size={38} />
        <span className="flex flex-col items-center"><Heart size={26} fill="currentColor" />{n(c.m, (m) => m.engagements * 0.8)}</span>
        <span className="flex flex-col items-center"><MessageCircle size={26} fill="currentColor" />{n(c.m, (m) => m.engagements * 0.1)}</span>
        <span className="flex flex-col items-center"><Bookmark size={24} fill="currentColor" />{n(c.m, (m) => m.engagements * 0.06)}</span>
        <span className="flex flex-col items-center"><Share2 size={24} />{n(c.m, (m) => m.engagements * 0.04)}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-10 pb-4 pr-14 text-white">
        <b className="text-[14px]">@{c.handle}</b>
        <Caption text={c.post.caption} className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug" />
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px]"><Music2 size={12} /> original sound · {c.name}</p>
      </div>
    </div>
  );
}

function YouTubeScreen(c: Ctx) {
  const title = c.post.title || c.post.caption.split('\n')[0] || 'Untitled video';
  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2 text-[15px] font-bold tracking-tight">
        <PlatformIcon platform="youtube" brand size={22} /> YouTube
      </div>
      <div className="relative">
        <Media c={{ ...c, video: true }} always />
        <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 text-[11px] font-semibold text-white">{c.post.format === 'stream' ? 'LIVE' : '0:45'}</span>
      </div>
      <div className="flex gap-2.5 px-3 py-3">
        <Avatar c={c} size={34} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-[14px] leading-snug font-semibold">{title}</p>
          <p className="mt-0.5 text-[12px] text-[#606060]">
            {c.name}
            {c.m ? ` · ${compact(c.m.impressions)} views` : ''} · {c.post.date ? dateTimeLabel(c.post.date) : 'Not scheduled'}
          </p>
        </div>
      </div>
      <div className="h-3" />
    </>
  );
}

function LinkedInScreen(c: Ctx) {
  return (
    <div className="bg-[#f4f2ee] pb-3">
      <div className="mt-1 bg-white">
        <div className="flex gap-2 px-3 pt-3">
          <Avatar c={c} size={40} square />
          <div className="min-w-0 text-[12px] leading-tight text-[#666]">
            <b className="block truncate text-[13.5px] text-[#1d1d1d]">{c.name}</b>
            Company page
            <span className="flex items-center gap-1">
              {c.post.date ? timeOf(c.post.date) : 'Not scheduled'} · <Globe size={11} />
            </span>
          </div>
        </div>
        <Caption text={c.post.caption} className="line-clamp-4 px-3 pt-2 text-[13px] leading-snug text-[#1d1d1d]" />
        <Media c={c} className="mt-2" />
        <Poll c={c} color="#0a66c2" />
        {c.m && <p className="px-3 pt-2 text-[11.5px] text-[#666]">👍 {n(c.m, (m) => m.engagements * 0.7)} · {n(c.m, (m) => m.engagements * 0.08)} comments</p>}
        <div className="mt-2 flex justify-around border-t border-[#e8e8e8] py-2 text-[11.5px] font-semibold text-[#666]">
          <span className="flex items-center gap-1"><ThumbsUp size={14} /> Like</span>
          <span className="flex items-center gap-1"><MessageSquare size={14} /> Comment</span>
          <span className="flex items-center gap-1"><Repeat2 size={14} /> Repost</span>
          <span className="flex items-center gap-1"><Send size={14} /> Send</span>
        </div>
      </div>
    </div>
  );
}

function DiscordScreen(c: Ctx) {
  return (
    <div className="bg-[#313338] pb-4 text-[#dbdee1]">
      <div className="flex items-center gap-1.5 border-b border-black/30 px-3 py-2 text-[14px] font-semibold text-white">
        <span className="text-[#80848e]">#</span> {c.post.channel || 'announcements'}
      </div>
      <div className="flex gap-2.5 px-3 pt-3">
        <Avatar c={c} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-tight">
            <b style={{ color: c.accent }}>{c.name}</b> <span className="text-[11px] text-[#949ba4]">{c.post.date ? `${dateTimeLabel(c.post.date)}` : 'Not scheduled'}</span>
          </p>
          <Caption text={c.post.caption} className="mt-0.5 text-[13.5px] leading-snug" />
          <Media c={c} className="mt-2 rounded-lg" />
          <Poll c={c} color="#5865f2" />
          {c.m && (
            <div className="mt-2 flex gap-1.5 text-[12px]">
              <span className="rounded-md border border-[#5865f2]/60 bg-[#5865f2]/20 px-1.5 py-0.5">🔥 {n(c.m, (m) => m.engagements * 0.3)}</span>
              <span className="rounded-md bg-[#2b2d31] px-1.5 py-0.5">🎉 {n(c.m, (m) => m.engagements * 0.15)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TelegramScreen(c: Ctx) {
  return (
    <div className="bg-[#b4cda6] pb-4">
      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <Avatar c={c} size={32} />
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-[13.5px]">{c.name}</b>
          <span className="text-[11.5px] text-[#8a8a8a]">channel</span>
        </div>
      </div>
      <div className="mx-3 mt-3 overflow-hidden rounded-xl rounded-bl-sm bg-white shadow-sm">
        <Media c={c} />
        <div className="px-2.5 pt-1.5 pb-1">
          <Caption text={c.post.caption} className="text-[13px] leading-snug" />
          <Poll c={c} color="#2aabee" />
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#8a8a8a]">
            {c.m && (
              <>
                <Eye size={12} /> {compact(c.m.impressions)} ·
              </>
            )}{' '}
            {c.post.date ? timeOf(c.post.date) : 'Not scheduled'}
          </p>
        </div>
      </div>
    </div>
  );
}

function KickScreen(c: Ctx) {
  return (
    <div className="bg-[#0b0e0f] pb-4">
      <div className="flex items-center px-3 py-2">
        <PlatformIcon platform="kick" brand size={20} />
      </div>
      <div className="relative">
        <Media c={{ ...c, video: true }} always />
        {c.post.format === 'stream' && <span className="absolute top-2 left-2 rounded bg-[#53fc19] px-1.5 text-[11px] font-bold text-black">LIVE</span>}
      </div>
      <div className="flex gap-2.5 px-3 pt-3">
        <Avatar c={c} size={34} />
        <div className="min-w-0 text-white">
          <p className="line-clamp-2 text-[13.5px] leading-snug font-semibold">{c.post.title || c.post.caption || 'Untitled stream'}</p>
          <p className="text-[12px] text-[#53fc19]">{c.name}</p>
          <p className="text-[11.5px] text-white/60">{c.m ? `${compact(c.m.impressions)} viewers · ` : ''}{when(c)}</p>
        </div>
      </div>
    </div>
  );
}

const SCREENS: Record<Platform, (c: Ctx) => ReactNode> = {
  x: XScreen,
  instagram: InstagramScreen,
  tiktok: TikTokScreen,
  youtube: YouTubeScreen,
  linkedin: LinkedInScreen,
  discord: DiscordScreen,
  telegram: TelegramScreen,
  kick: KickScreen,
};
