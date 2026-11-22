import { siDiscord, siInstagram, siKick, siTelegram, siTiktok, siX, siYoutube } from 'simple-icons';
import type { Platform } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';

// Brand glyphs from simple-icons (CC0). LinkedIn isn't in that set, so its path is here.
const LINKEDIN =
  'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z';

export const PLATFORM_GLYPH: Record<Platform, { path: string; hex: string }> = {
  x: { path: siX.path, hex: '#000000' },
  discord: { path: siDiscord.path, hex: `#${siDiscord.hex}` },
  telegram: { path: siTelegram.path, hex: `#${siTelegram.hex}` },
  instagram: { path: siInstagram.path, hex: `#${siInstagram.hex}` },
  tiktok: { path: siTiktok.path, hex: '#000000' },
  youtube: { path: siYoutube.path, hex: `#${siYoutube.hex}` },
  linkedin: { path: LINKEDIN, hex: '#0A66C2' },
  kick: { path: siKick.path, hex: '#53FC19' },
};

/** The platform that a preview uses: the post's own, or X when none is chosen. */
export const previewPlatform = (p: Platform | '' | null | undefined): Platform => (p && p in PLATFORM_GLYPH ? p : 'x');

/** A platform's logo in the current text colour (or its brand colour). Unknown or missing platforms show the X logo. */
export function PlatformIcon({ platform, size = 14, brand = false, className }: { platform: Platform | '' | null | undefined; size?: number; brand?: boolean; className?: string }) {
  const key = previewPlatform(platform);
  const g = PLATFORM_GLYPH[key];
  return (
    <svg role="img" aria-label={PLATFORM_LABEL[key]} viewBox="0 0 24 24" width={size} height={size} className={className} style={{ flexShrink: 0 }}>
      <title>{PLATFORM_LABEL[key]}</title>
      <path d={g.path} fill={brand ? g.hex : 'currentColor'} />
    </svg>
  );
}
