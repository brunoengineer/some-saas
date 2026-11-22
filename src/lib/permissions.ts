import type { Post, Role, Workspace } from '@/data/types';

// The same matrix is enforced by Firestore security rules in Phase 1. In the
// prototype it hides controls and guards every write in `app/actions.ts`.

export type Action =
  | 'comment'
  | 'approve'
  | 'edit'
  | 'draft'
  | 'kpi.enter'
  | 'report.generate'
  | 'report.edit'
  | 'report.export'
  | 'settings';

export function can(role: Role, action: Action, settings: Workspace['settings']): boolean {
  if (role === 'admin') return true;
  if (action === 'report.export') return true;
  if (role === 'manager') {
    if (action === 'comment') return true;
    if (action === 'approve') return settings.managersCanApprove;
    if (action === 'draft') return settings.managersCanDraft;
  }
  return false;
}

/** Managers with "can draft" may edit ideas and drafts, not approved or published posts. */
export function canEditPost(role: Role, settings: Workspace['settings'], post: Pick<Post, 'status'> | null) {
  if (role === 'admin') return true;
  if (role === 'manager' && settings.managersCanDraft) return !post || post.status === 'idea' || post.status === 'draft';
  return false;
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', manager: 'Manager', viewer: 'Viewer' };

export const ROLE_HELP: Record<Role, string> = {
  admin: 'Edits everything: content, campaigns, partners, KPIs, reports and settings.',
  manager: 'Sees everything, comments and approves posts. Can draft if allowed.',
  viewer: 'Sees everything and exports reports. Read-only.',
};

export const PERMISSION_ROWS: { label: string; admin: string; manager: string; viewer: string }[] = [
  { label: 'See everything in the workspace', admin: '✓', manager: '✓', viewer: '✓' },
  { label: 'Comment and @mention', admin: '✓', manager: '✓', viewer: '–' },
  { label: 'Approve / request changes on posts', admin: '✓', manager: 'If allowed', viewer: '–' },
  { label: 'Create and edit ideas and drafts', admin: '✓', manager: 'If allowed', viewer: '–' },
  { label: 'Edit campaigns, partners, KPIs and results', admin: '✓', manager: '–', viewer: '–' },
  { label: 'Generate and edit reports', admin: '✓', manager: '–', viewer: '–' },
  { label: 'Export reports (PPTX, PDF)', admin: '✓', manager: '✓', viewer: '✓' },
  { label: 'Members, roles, schedules and settings', admin: '✓', manager: '–', viewer: '–' },
];
