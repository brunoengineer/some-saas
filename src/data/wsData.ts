import type { DB, WsData } from './types';

/** All records of one workspace. */
export function wsData(db: DB, wsId: string): WsData {
  const ws = db.workspaces.find((w) => w.id === wsId) ?? db.workspaces[0];
  const by = <T extends { wsId: string }>(xs: T[]) => xs.filter((x) => x.wsId === ws.id);
  return {
    ws,
    posts: by(db.posts),
    campaigns: by(db.campaigns),
    partners: by(db.partners),
    deliverables: by(db.deliverables),
    kpis: by(db.kpis),
    kpiEntries: by(db.kpiEntries),
    stats: by(db.stats),
    comments: by(db.comments),
    reports: by(db.reports),
    activity: by(db.activity),
  };
}
