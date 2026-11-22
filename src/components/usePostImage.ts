import { useEffect, useState } from 'react';
import { repo } from '@/data';
import { IMAGE_REF } from '@/data/firestoreRepo';
import type { Post } from '@/data/types';

/** Whether this is a reference to a photo stored apart from the post (real app). */
export const isStoredImage = (src: string | null | undefined) => !!src && src.startsWith(IMAGE_REF);

/** The small picture for cards: the thumbnail, or the image itself when it's inline. */
export const cardImage = (p: Pick<Post, 'image' | 'thumb'>) => p.thumb ?? (p.image && !isStoredImage(p.image) ? p.image : null);

/** A post's full image, fetched when it's stored apart from the post. */
export function usePostImage(post: Pick<Post, 'id' | 'wsId' | 'image' | 'thumb'> | null): string | null {
  const [src, setSrc] = useState<string | null>(() => (post?.image && !isStoredImage(post.image) ? post.image : null));
  const key = post ? `${post.wsId}/${post.id}/${post.image ?? ''}` : '';
  useEffect(() => {
    let live = true;
    if (!post?.image) setSrc(null);
    else if (!isStoredImage(post.image)) setSrc(post.image);
    else {
      setSrc(post.thumb ?? null); // show the thumbnail while the full photo loads
      repo.loadImage(post).then((s) => live && s && setSrc(s));
    }
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return src;
}
