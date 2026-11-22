// Every write goes through here: it checks permissions (the prototype's
// stand-in for Firestore rules) and records the audit log.
import { format } from 'date-fns';
import { repo } from '@/data';
import type { Campaign, Comment, DailyStat, Deliverable, Kpi, KpiEntry, Partner, Post, PostStatus, Report, Workspace } from '@/data/types';
import { partnerDeliverableFor } from '@/lib/partnerSync';
import { canEditPost, type Action } from '@/lib/permissions';
import { useSession } from './session';

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowStamp = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

export class PermissionError extends Error {}

/** Saves run in the background; a refused save shows the error banner (see `reportWriteError`). */
const fire = (p: Promise<void>) => {
  p.catch(() => undefined);
};

export function useActions() {
  const { ws, member, role, can, today } = useSession();

  const guard = (ok: boolean, what: string) => {
    if (!ok) {
      window.alert(`Your role (${role}) can’t ${what}.`);
      throw new PermissionError(what);
    }
  };
  const need = (a: Action, what: string) => guard(can(a), what);

  const log = (text: string, link: string | null = null) =>
    fire(repo.upsert('activity', { id: newId('a'), wsId: ws.id, at: nowStamp(), actorId: member.id, text, link }));
  const syncPartnerDeliverable = (post: Post) => {
    // Only roles that may edit deliverables (admins); a manager's draft leaves it to an admin.
    if (!can('edit')) return;
    const db = repo.get();
    const r = partnerDeliverableFor(post, db.partners, db.deliverables, today, () => newId('d'));
    if (!r) return;
    fire(repo.upsert('deliverables', r.deliverable));
    if (r.created) {
      const name = db.partners.find((x) => x.id === r.deliverable.partnerId)?.name ?? 'a partner';
      log(`added deliverable “${post.title}” for ${name} from a calendar post`, `/partners/${r.deliverable.partnerId}`);
    }
  };

  return {
    savePost(post: Post, isNew: boolean) {
      const before = repo.get().posts.find((p) => p.id === post.id) ?? null;
      guard(canEditPost(role, ws.settings, before) && canEditPost(role, ws.settings, post), 'edit this post');
      fire(repo.upsert('posts', post));
      log(`${isNew ? 'created' : 'updated'} “${post.title}”`, `/calendar?post=${post.id}`);
      syncPartnerDeliverable(post);
    },
    deletePost(post: Post) {
      guard(canEditPost(role, ws.settings, post), 'delete this post');
      fire(repo.remove('posts', post.id));
      log(`deleted “${post.title}”`);
    },
    movePost(post: Post, date: string | null, status?: PostStatus) {
      need('edit', 'reschedule posts');
      const next = { ...post, date, status: status ?? post.status };
      fire(repo.upsert('posts', next));
      log(date ? `moved “${post.title}” to ${date.slice(0, 10)}` : `moved “${post.title}” to ideas`, `/calendar?post=${post.id}`);
    },
    setPostStatus(post: Post, status: PostStatus) {
      const reviewing = (status === 'approved' || status === 'draft') && post.status === 'review';
      guard(can('edit') || (reviewing && can('approve')), 'change this status');
      fire(repo.upsert('posts', { ...post, status }));
      log(`set “${post.title}” to ${status}`, `/calendar?post=${post.id}`);
    },
    review(post: Post, decision: 'approved' | 'changes', body: string) {
      need('approve', 'approve posts');
      fire(repo.upsert('posts', { ...post, status: decision === 'approved' ? 'approved' : 'draft' }));
      fire(
        repo.upsert('comments', {
          id: newId('cm'),
          wsId: ws.id,
          targetType: 'post',
          targetId: post.id,
          authorId: member.id,
          body: body || (decision === 'approved' ? 'Approved.' : 'Changes requested.'),
          kind: decision === 'approved' ? 'approved' : 'changes',
          createdAt: nowStamp(),
        }),
      );
      log(`${decision === 'approved' ? 'approved' : 'requested changes on'} “${post.title}”`, `/calendar?post=${post.id}`);
    },
    addComment(targetType: Comment['targetType'], targetId: string, body: string, label: string, link: string) {
      need('comment', 'comment');
      fire(repo.upsert('comments', { id: newId('cm'), wsId: ws.id, targetType, targetId, authorId: member.id, body, kind: 'comment', createdAt: nowStamp() }));
      log(`commented on ${label}`, link);
    },
    editComment(c: Comment, body: string) {
      // Only the author edits their words; admins can delete but not reword.
      guard(c.authorId === member.id && can('comment'), 'edit someone else’s comment');
      fire(repo.upsert('comments', { ...c, body, editedAt: nowStamp() }));
    },
    deleteComment(c: Comment) {
      guard(role === 'admin' || c.authorId === member.id, 'delete this comment');
      fire(repo.remove('comments', c.id));
      if (c.authorId !== member.id) log(`deleted a comment by another member`);
    },
    saveCampaign(c: Campaign, isNew: boolean) {
      need('edit', 'edit campaigns');
      fire(repo.upsert('campaigns', c));
      log(`${isNew ? 'created' : 'updated'} campaign ${c.name}`, `/campaigns/${c.id}`);
    },
    deleteCampaign(c: Campaign) {
      need('edit', 'delete campaigns');
      fire(repo.remove('campaigns', c.id));
      fire(repo.upsertMany('posts', repo.get().posts.filter((p) => p.campaignId === c.id).map((p) => ({ ...p, campaignId: null }))));
      log(`deleted campaign ${c.name}`);
    },
    savePartner(p: Partner, isNew: boolean) {
      need('edit', 'edit partners');
      fire(repo.upsert('partners', p));
      log(`${isNew ? 'added' : 'updated'} partner ${p.name}`, `/partners/${p.id}`);
    },
    deletePartner(p: Partner) {
      need('edit', 'delete partners');
      fire(repo.remove('partners', p.id));
      for (const d of repo.get().deliverables.filter((x) => x.partnerId === p.id)) fire(repo.remove('deliverables', d.id));
      log(`removed partner ${p.name}`);
    },
    saveDeliverable(d: Deliverable, partnerName: string) {
      need('edit', 'edit deliverables');
      fire(repo.upsert('deliverables', d));
      log(`updated “${d.title}” for ${partnerName}`, `/partners/${d.partnerId}`);
    },
    deleteDeliverable(d: Deliverable) {
      need('edit', 'delete deliverables');
      fire(repo.remove('deliverables', d.id));
      log(`deleted deliverable “${d.title}”`, `/partners/${d.partnerId}`);
    },
    saveKpi(k: Kpi, isNew: boolean) {
      need('edit', 'edit KPIs');
      fire(repo.upsert('kpis', k));
      log(`${isNew ? 'added' : 'updated'} KPI ${k.name}`, '/kpis?tab=definitions');
    },
    reorderKpis(list: Kpi[], moved: string) {
      need('edit', 'reorder KPIs');
      fire(repo.upsertMany('kpis', list));
      log(`reordered KPIs (${moved})`, '/kpis?tab=definitions');
    },
    deleteKpi(k: Kpi) {
      need('edit', 'delete KPIs');
      fire(repo.remove('kpis', k.id));
      log(`deleted KPI ${k.name}`);
    },
    setEntry(e: KpiEntry | null, remove: { id: string } | null, kpiName: string) {
      need('kpi.enter', 'enter results');
      if (remove) fire(repo.remove('kpiEntries', remove.id));
      if (e) fire(repo.upsert('kpiEntries', e));
      log(`entered ${kpiName} for ${(e ?? remove)?.id.split('_').pop()}`, '/kpis');
    },
    /** Save a batch of results at once (the Enter results form, the history panel). */
    saveEntries(upserts: KpiEntry[], removals: KpiEntry[], label: string) {
      need('kpi.enter', 'enter results');
      if (upserts.length) fire(repo.upsertMany('kpiEntries', upserts));
      for (const r of removals) fire(repo.remove('kpiEntries', r.id));
      log(`entered ${upserts.length + removals.length} result(s) for ${label}`, '/kpis?tab=enter');
    },
    importRows(rows: { stats?: DailyStat[]; entries?: KpiEntry[]; posts?: Post[] }, label: string) {
      need('kpi.enter', 'import data');
      if (rows.stats) fire(repo.upsertMany('stats', rows.stats));
      if (rows.entries) fire(repo.upsertMany('kpiEntries', rows.entries));
      if (rows.posts) fire(repo.upsertMany('posts', rows.posts));
      const n = (rows.stats?.length ?? 0) + (rows.entries?.length ?? 0) + (rows.posts?.length ?? 0);
      log(`imported ${n} rows (${label})`, '/settings?tab=import');
    },
    saveReport(r: Report, verb: string) {
      need('report.edit', 'edit reports');
      fire(repo.upsert('reports', r));
      log(`${verb} report “${r.title}”`, `/reports/${r.id}`);
    },
    deleteReport(r: Report) {
      need('report.edit', 'delete reports');
      fire(repo.remove('reports', r.id));
      log(`deleted report “${r.title}”`);
    },
    saveWorkspace(w: Workspace, what: string) {
      need('settings', 'change settings');
      fire(repo.upsert('workspaces', w));
      log(`changed ${what}`, '/settings');
    },
  };
}
