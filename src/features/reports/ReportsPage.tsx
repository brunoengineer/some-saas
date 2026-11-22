import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { nowStamp, useActions } from '@/app/actions';
import { useMemberName, useSession } from '@/app/session';
import { DataTable } from '@/components/DataTable';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Segmented, Select } from '@/components/ui';
import type { Report, ReportType } from '@/data/types';
import { dateTimeLabel } from '@/lib/format';
import { lastDataDate } from '@/lib/metrics';
import { periodFor, periodLabel, rangeLabel, type Period } from '@/lib/period';
import { createReport, REPORT_TYPE_LABEL } from '@/lib/report';

export function ReportsPage() {
  const { data, can } = useSession();
  const navigate = useNavigate();
  const name = useMemberName();
  const [type, setType] = useState<'all' | ReportType>('all');
  const [generating, setGenerating] = useState(false);
  const rows = data.reports.filter((r) => type === 'all' || r.type === type);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        subtitle="Generate a weekly, monthly, campaign or custom report when you need one. Numbers are frozen when it’s generated."
        actions={
          can('report.generate') && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setGenerating(true)}>
              Generate report
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3">
        <Card>
          <div className="mb-3">
            <Segmented
              label="Report type"
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: 'All' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'campaign', label: 'Campaign' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
          <DataTable<Report>
            rows={rows}
            rowKey={(r) => r.id}
            onRow={(r) => navigate(`/reports/${r.id}`)}
            initialSort={{ key: 'created', dir: 'desc' }}
            empty="No reports yet"
            cols={[
              {
                key: 'title',
                label: 'Report',
                render: (r) => (
                  <span className="block min-w-0">
                    <b className="block truncate font-medium">{r.title}</b>
                    <span className="block max-w-[420px] truncate text-[12.5px] text-muted">{r.narrative.headline}</span>
                  </span>
                ),
                sort: (r) => r.title,
              },
              { key: 'type', label: 'Type', render: (r) => <Badge>{REPORT_TYPE_LABEL[r.type]}</Badge>, sort: (r) => r.type },
              { key: 'period', label: 'Period', render: (r) => <span className="whitespace-nowrap text-soft">{rangeLabel(r.start, r.end)}</span>, sort: (r) => r.start },
              { key: 'trigger', label: 'Created', render: (r) => <span className="whitespace-nowrap text-muted">{name(r.createdBy)}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'final' ? 'good' : 'warning'}>{r.status === 'final' ? 'Final' : 'Draft'}</Badge>, sort: (r) => r.status },
              { key: 'created', label: 'Date', render: (r) => <span className="whitespace-nowrap text-muted">{dateTimeLabel(r.createdAt)}</span>, sort: (r) => r.createdAt },
            ]}
          />
        </Card>
      </div>
      {generating && <GenerateModal onClose={() => setGenerating(false)} />}
    </div>
  );
}

function GenerateModal({ onClose }: { onClose: () => void }) {
  const { data, ws, today, member } = useSession();
  const actions = useActions();
  const navigate = useNavigate();
  const last = lastDataDate(data);
  const anchor = last && last < today ? last : today;
  const [type, setType] = useState<ReportType>('weekly');
  const [date, setDate] = useState(anchor);
  const [from, setFrom] = useState(periodFor('month', anchor).start);
  const [to, setTo] = useState(anchor);
  const [campaignId, setCampaignId] = useState(data.campaigns[0]?.id ?? '');

  const campaign = data.campaigns.find((c) => c.id === campaignId);
  let period: Period | null = null;
  if (type === 'weekly') period = periodFor('week', date, ws.weekStartsOn);
  if (type === 'monthly') period = periodFor('month', date);
  if (type === 'custom' && from <= to) period = { type: 'custom', start: from, end: to };
  if (type === 'campaign' && campaign) period = { type: 'custom', start: campaign.start, end: campaign.end < anchor ? campaign.end : anchor };

  const go = () => {
    if (!period) return;
    const r = createReport(data, { type, period, campaignId: type === 'campaign' ? campaignId : null, trigger: 'manual', createdBy: member.id, now: nowStamp() });
    actions.saveReport(r, 'generated');
    onClose();
    navigate(`/reports/${r.id}`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Generate a report"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!period || (type === 'campaign' && campaign!.start > anchor)} onClick={go}>
            Generate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Type"
          value={type}
          onChange={setType}
          options={(['weekly', 'monthly', 'campaign', 'custom'] as ReportType[]).map((t) => ({ value: t, label: REPORT_TYPE_LABEL[t] }))}
        />
        {(type === 'weekly' || type === 'monthly') && (
          <Field label={type === 'weekly' ? 'Any day in the week' : 'Any day in the month'}>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
        )}
        {type === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        {type === 'campaign' && (
          <Field label="Campaign" hint="Covers the campaign from its start to today (or its end).">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-soft">
          {period ? (
            <>
              Period: <b>{periodLabel(period)}</b>. The numbers are frozen when the report is created, so later edits don’t change it.
            </>
          ) : (
            'Pick a valid period.'
          )}
        </p>
      </div>
    </Modal>
  );
}
