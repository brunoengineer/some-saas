import type { PostFormat, PostStatus } from '@/data/types';

export const STATUSES: PostStatus[] = ['idea', 'draft', 'review', 'approved', 'scheduled', 'published'];

export const STATUS_LABEL: Record<PostStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
};

export const STATUS_TONE: Record<PostStatus, 'neutral' | 'warning' | 'info' | 'good' | 'accent'> = {
  idea: 'neutral',
  draft: 'neutral',
  review: 'warning',
  approved: 'info',
  scheduled: 'good',
  published: 'accent',
};

export const FORMATS: PostFormat[] = ['text', 'image', 'video', 'poll', 'thread', 'meme', 'stream', 'event'];
