import type { Platform } from '@/data/types';

/**
 * Shrink an uploaded image so it fits in browser storage: longest side at most
 * 1280px, saved as JPEG, kept under ~350 KB. The prototype keeps everything in
 * localStorage (about 5 MB in total); Phase 1 uploads the original to Firebase
 * Storage instead.
 */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.');
  const bitmap = await createImageBitmap(file);
  const attempts: [number, number][] = [
    [1280, 0.82],
    [1080, 0.72],
    [900, 0.62],
  ];
  let out = '';
  for (const [max, quality] of attempts) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL('image/jpeg', quality);
    if (out.length < 350_000) break;
  }
  bitmap.close();
  return out;
}

/** A small JPEG copy (longest side 400px) for calendar cards, about 15-30 KB. */
export async function makeThumb(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/** How each platform crops a single image in the feed: width ÷ height, and the label. */
export const PLATFORM_CROP: Record<Platform, { ratio: number; label: string }> = {
  x: { ratio: 16 / 9, label: '16:9' },
  discord: { ratio: 16 / 9, label: '16:9' },
  telegram: { ratio: 16 / 9, label: '16:9' },
  kick: { ratio: 16 / 9, label: '16:9' },
  youtube: { ratio: 16 / 9, label: '16:9' },
  linkedin: { ratio: 1.91, label: '1.91:1' },
  instagram: { ratio: 4 / 5, label: '4:5' },
  tiktok: { ratio: 9 / 16, label: '9:16' },
};
