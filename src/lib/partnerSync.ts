import type { Deliverable, Partner, Post } from '@/data/types';

/**
 * A post with a partner gets a matching deliverable on that partner, linked by
 * postId. While it isn't delivered it follows the post (title, date, platform,
 * campaign, partner); once delivered it's history and is left alone.
 *
 * Returns the deliverable to save (new or changed), or null when nothing changes.
 */
export function partnerDeliverableFor(
  post: Post,
  partners: Partner[],
  deliverables: Deliverable[],
  today: string,
  newId: () => string,
): { deliverable: Deliverable; created: boolean } | null {
  if (!post.partnerId) return null;
  const partner = partners.find((p) => p.id === post.partnerId);
  if (!partner) return null;
  const kind: Deliverable['kind'] = post.format === 'stream' ? 'stream' : post.format === 'video' ? 'video' : post.format === 'event' ? 'event' : 'post';
  const linked = deliverables.filter((d) => d.postId === post.id);
  if (linked.some((d) => d.partnerId === post.partnerId && d.delivered)) return null;
  // Same partner first; otherwise move an open, unpaid one over when the post's partner changed.
  const open = linked.find((d) => !d.delivered && d.partnerId === post.partnerId) ?? linked.find((d) => !d.delivered && !d.paid);
  const due = post.date ? post.date.slice(0, 10) : (open?.due ?? today);
  if (open) {
    const next: Deliverable = { ...open, partnerId: partner.id, title: post.title, due, kind, platform: post.platform, campaignId: post.campaignId };
    return JSON.stringify(next) === JSON.stringify(open) ? null : { deliverable: next, created: false };
  }
  return {
    created: true,
    deliverable: {
      id: newId(),
      wsId: post.wsId,
      partnerId: partner.id,
      campaignId: post.campaignId,
      kind,
      title: post.title,
      due,
      delivered: null,
      results: null,
      cost: partner.deal.model === 'flat' ? partner.deal.rate : 0,
      paid: false,
      platform: post.platform,
      url: '',
      postId: post.id,
    },
  };
}
