// Sample post images for the prototype: simple branded graphics (pillar colour,
// post title), so the calendar and previews have something to show. Real posts
// get uploaded images instead.
import type { Post, PostFormat, Workspace } from '../types';

/** Light-mode series colours (index.css), as hex because SVG data URLs can't read CSS variables. */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const VISUAL: PostFormat[] = ['image', 'meme', 'video', 'stream', 'event'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text: string, max: number, maxLines: number) {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && `${cur} ${w}`.length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    out.length = maxLines;
    out[maxLines - 1] = `${out[maxLines - 1].replace(/\s*\S*$/, '')}…`;
  }
  return out;
}

type Shape = 'landscape' | 'feed' | 'story';
const SIZES: Record<Shape, { w: number; h: number; font: number; chars: number }> = {
  landscape: { w: 1200, h: 675, font: 60, chars: 22 },
  feed: { w: 1080, h: 1350, font: 76, chars: 15 },
  story: { w: 720, h: 1280, font: 64, chars: 14 },
};

export function sampleImage(title: string, color: number, brand: string, shape: Shape): string {
  const c = SERIES[(color - 1 + 8) % 8];
  const { w, h, font: size, chars } = SIZES[shape];
  const ls = wrap(title, chars, 4);
  const y0 = h / 2 - ((ls.length - 1) * size * 1.15) / 2;
  const text = ls.map((l, i) => `<text x="${w / 2}" y="${y0 + i * size * 1.15}" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w * 0.85}" cy="${h * 0.12}" r="${h * 0.35}" fill="#fff" fill-opacity=".07"/>` +
    `<g font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${size}" fill="#fff">${text}</g>` +
    `<text x="48" y="${h - 48}" font-family="Inter,Arial,sans-serif" font-weight="600" font-size="30" fill="#fff" fill-opacity=".85">${esc(brand)}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Visual formats (and every Instagram/TikTok post) get a sample image; text posts, polls and threads stay text-only. */
export function withSampleImages(posts: Post[], workspaces: Workspace[]): Post[] {
  return posts.map((p) => {
    if (!VISUAL.includes(p.format) && p.platform !== 'instagram' && p.platform !== 'tiktok') return { ...p, image: null };
    const ws = workspaces.find((w) => w.id === p.wsId);
    const pillar = ws?.pillars.find((x) => x.id === p.pillarId);
    const shape: Shape = p.platform === 'tiktok' ? 'story' : p.platform === 'instagram' ? 'feed' : 'landscape';
    return { ...p, image: sampleImage(p.title, pillar?.color ?? 8, ws?.name ?? '', shape) };
  });
}
