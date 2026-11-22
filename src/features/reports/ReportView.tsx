import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Link2, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useActions } from '@/app/actions';
import { useSession } from '@/app/session';
import { DiscussionButton } from '@/components/Comments';
import { Badge, Button, EmptyState } from '@/components/ui';
import type { ReportNarrative } from '@/data/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { isTracked } from '@/lib/metrics';
import { buildSnapshot, REPORT_TYPE_LABEL, reportKpi } from '@/lib/report';
import { exportReportPptx } from '@/lib/pptx';
import { ReportBody, type AddableKpi } from './ReportBody';

export function ReportView() {
  const { id } = useParams();
  const { data, ws, can } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const report = data.reports.find((r) => r.id === id) ?? null;
  const [editing, setEditing] = useState(false);
  const [narrative, setNarrative] = useState<ReportNarrative | null>(report?.narrative ?? null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNarrative(report?.narrative ?? null);
    setEditing(false);
  }, [report?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!report || !narrative) return <EmptyState title="Report not found" action={<Link to="/reports" className="text-accent-strong">Back to reports</Link>} />;

  const addable: AddableKpi[] = data.kpis
    .filter(isTracked)
    .sort((a, b) => a.order - b.order)
    .map((k) => ({
      id: k.id,
      label: `${k.name}${k.platform ? ` (${PLATFORM_LABEL[k.platform]})` : ''}`,
      make: () => reportKpi(k, data, report.type, { type: 'custom', start: report.start, end: report.end }, report.campaignId),
    }));

  const exportPptx = async () => {
    setBusy(true);
    try {
      await exportReportPptx({ ...report, narrative }, ws);
    } catch (e) {
      window.alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/share/${report.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link to="/reports" className="mr-auto inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} /> Reports
        </Link>
        <Badge>{REPORT_TYPE_LABEL[report.type]}</Badge>
        <Badge tone={report.status === 'final' ? 'good' : 'warning'}>{report.status === 'final' ? 'Final' : 'Draft'}</Badge>
        {editing ? (
          <>
            <Button
              onClick={() => {
                setNarrative(report.narrative);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                actions.saveReport({ ...report, narrative }, 'edited');
                setEditing(false);
              }}
            >
              Save changes
            </Button>
          </>
        ) : (
          <>
            {can('report.edit') && (
              <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit report
              </Button>
            )}
            {can('report.edit') && report.status === 'draft' && (
              <Button
                icon={<RefreshCw size={15} />}
                title="Recalculate the numbers from the latest data (drafts only)"
                onClick={() => actions.saveReport({ ...report, snapshot: buildSnapshot(data, report.type, { type: 'custom', start: report.start, end: report.end }, report.campaignId) }, 'refreshed the numbers of')}
              >
                Refresh numbers
              </Button>
            )}
            {can('report.edit') && report.status === 'draft' && (
              <Button icon={<CheckCircle2 size={15} />} onClick={() => actions.saveReport({ ...report, status: 'final' }, 'finalised')}>
                Mark final
              </Button>
            )}
            <DiscussionButton targetType="report" targetId={report.id} label={`report “${report.title}”`} link={`/reports/${report.id}`} title={report.title} />
            {/* Fixed widths: the labels change ("Link copied", "Exporting…") and must not push the other buttons. */}
            <Button icon={<Link2 size={15} />} onClick={share} className="w-[128px]">
              {copied ? 'Link copied' : 'Share link'}
            </Button>
            <Button icon={<Printer size={15} />} onClick={() => window.print()}>
              PDF
            </Button>
            <Button variant="primary" icon={<Download size={15} />} disabled={busy} onClick={exportPptx} className="w-[132px]">
              {busy ? 'Exporting…' : 'Export PPTX'}
            </Button>
          </>
        )}
      </div>

      <ReportBody report={report} ws={ws} editing={editing} narrative={narrative} onNarrative={setNarrative} addable={addable} />

      <div className="no-print">
        {can('report.edit') && (
          <div>
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={() => {
                if (window.confirm(`Delete the report “${report.title}”?`)) {
                  actions.deleteReport(report);
                  navigate('/reports');
                }
              }}
            >
              Delete report
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Read-only report page without the app shell (the share link). */
export function SharedReport() {
  const { id } = useParams();
  const { db } = useSession();
  const report = db.reports.find((r) => r.id === id);
  const ws = report ? db.workspaces.find((w) => w.id === report.wsId) : null;
  useEffect(() => {
    if (ws) document.documentElement.style.setProperty('--accent', ws.accent);
  }, [ws]);
  if (!report || !ws)
    return (
      <div className="mx-auto max-w-xl p-8">
        <EmptyState title="This report isn’t available" body="In the prototype, share links only work in the browser that holds the data. In the real app they open for anyone with access." />
      </div>
    );
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <p className="no-print mb-4 text-[12.5px] text-muted">
        Shared report · read-only · <b className="text-soft">{ws.name}</b>
      </p>
      <ReportBody report={report} ws={ws} editing={false} narrative={report.narrative} onNarrative={() => undefined} />
    </div>
  );
}
