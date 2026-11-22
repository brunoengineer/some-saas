// PowerPoint export with native (editable) charts and tables. pptxgenjs is
// loaded only when someone exports, to keep the app bundle small.
import type { Report, ReportKpi, Workspace } from '@/data/types';
import { compact, formatDelta, formatValue, money, num, targetLabel } from './format';
import { rangeLabel } from './period';
import { isShown, reportKpis } from './report';

const SERIES = ['2A78D6', 'EB6834', '1BAF7A', 'EDA100', 'E87BA4', '008300', '6250D6', 'E34948'];
const INK = '18181B';
const SOFT = '4A4945';
const MUTED = '76756F';
const LINE = 'E4E3DF';
const STATUS = { good: ['0CA30C', 'On track'], warning: ['B47A00', 'At risk'], critical: ['D03B3B', 'Off track'], none: [MUTED, 'No target'] } as const;
const FONT = 'Calibri';

export async function exportReportPptx(report: Report, ws: Workspace) {
  const pptx = await buildDeck(report, ws);
  const file = `${ws.name} ${report.title}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  await pptx.writeFile({ fileName: `${file}.pptx` });
}

/** Build the deck without saving it (also used by the tests). */
export async function buildDeck(report: Report, ws: Workspace) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = `${ws.name} · ${report.title}`;
  pptx.company = ws.name;
  const accent = ws.accent.replace('#', '').toUpperCase();
  const s = report.snapshot;
  const n = report.narrative;
  const period = rangeLabel(report.start, report.end);

  pptx.defineSlideMaster({
    title: 'BASE',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } } },
      { text: { text: `${ws.name} · ${report.title}`, options: { x: 0.5, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: MUTED, fontFace: FONT } } },
    ],
    slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, fontFace: FONT },
  });

  const heading = (slide: ReturnType<typeof pptx.addSlide>, title: string, sub?: string) => {
    slide.addText(title, { x: 0.5, y: 0.35, w: 12.3, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT });
    if (sub) slide.addText(sub, { x: 0.5, y: 0.95, w: 12.3, h: 0.4, fontSize: 13, color: MUTED, fontFace: FONT });
  };

  // 1. Title
  const t = pptx.addSlide({ masterName: 'BASE' });
  t.addShape('rect', { x: 0.5, y: 1.3, w: 0.9, h: 0.9, fill: { color: accent }, rectRadius: 0.12 });
  t.addText(ws.initials, { x: 0.5, y: 1.3, w: 0.9, h: 0.9, fontSize: 30, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT });
  t.addText(`${report.type.toUpperCase()} REPORT · ${period}`, { x: 0.5, y: 2.5, w: 12, h: 0.4, fontSize: 13, bold: true, color: accent, charSpacing: 2, fontFace: FONT });
  t.addText(n.headline, { x: 0.5, y: 2.95, w: 12.2, h: 1.6, fontSize: 36, bold: true, color: INK, fontFace: FONT, valign: 'top' });
  t.addText(n.summary, { x: 0.5, y: 4.6, w: 11.5, h: 1.6, fontSize: 17, color: SOFT, fontFace: FONT, valign: 'top' });

  // 2. KPI tiles (what the report shows after editing: removed ones out, added ones in)
  const shown = reportKpis(report);
  const added = new Set((n.addedKpis ?? []).map((k) => k.id));
  const kpis = isShown(n, 'numbers') ? shown.filter((k) => k.group === 'weekly') : [];
  const extra = isShown(n, 'more') ? shown.filter((k) => k.group !== 'weekly' && (added.has(k.id) || k.value !== null)) : [];
  if (kpis.length) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, 'The numbers', 'Change vs the previous period, and the target that applies');
    tiles(sl, kpis.slice(0, 9), 1.5);
  }
  if (extra.length) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, 'More numbers', 'Daily checks, headline goals and other KPIs');
    tiles(sl, extra.slice(0, 9), 1.5);
  }

  function tiles(sl: ReturnType<typeof pptx.addSlide>, list: ReportKpi[], top: number) {
    const cols = 3;
    const w = 3.95;
    const h = list.length > 6 ? 1.68 : 2.5;
    list.forEach((k, i) => {
      const x = 0.5 + (i % cols) * (w + 0.22);
      const y = top + Math.floor(i / cols) * (h + 0.2);
      const d = formatDelta(k.unit, k.value, k.prev);
      const [sc, sl2] = STATUS[k.status];
      sl.addShape('rect', { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
      sl.addText(k.question.toUpperCase(), { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 9, color: MUTED, bold: true, fontFace: FONT });
      sl.addText(k.name, { x: x + 0.2, y: y + 0.38, w: w - 0.4, h: 0.3, fontSize: 12, color: SOFT, fontFace: FONT });
      sl.addText(formatValue(k.unit, k.value), { x: x + 0.2, y: y + 0.68, w: w - 0.4, h: 0.6, fontSize: list.length > 6 ? 24 : 32, bold: true, color: INK, fontFace: FONT });
      if (h > 2) {
        sl.addText(d ? `${d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '='} ${d.text} vs previous` : 'No earlier data', { x: x + 0.2, y: y + 1.35, w: w - 0.4, h: 0.3, fontSize: 11, color: SOFT, fontFace: FONT });
        if (k.detail) sl.addText(k.detail, { x: x + 0.2, y: y + 1.62, w: w - 0.4, h: 0.3, fontSize: 10, color: MUTED, fontFace: FONT });
      }
      sl.addText(`Target: ${targetLabel(k.unit, k.target)}`, { x: x + 0.2, y: y + h - 0.42, w: w - 1.5, h: 0.3, fontSize: 10, color: MUTED, fontFace: FONT });
      sl.addText(`● ${sl2}`, { x: x + w - 1.35, y: y + h - 0.42, w: 1.2, h: 0.3, fontSize: 10, bold: true, color: sc, align: 'right', fontFace: FONT });
    });
  }

  // 3. Charts
  const pillars = isShown(n, 'pillars') ? s.pillars.filter((p) => p.rate !== null) : [];
  const followers = isShown(n, 'followers') ? s.followers : [];
  if (followers.length || pillars.length) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, 'Growth and content');
    const axis = { catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, valGridLine: { color: LINE, size: 1 }, catAxisLineShow: false, valAxisLineShow: false, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT };
    if (followers.length) {
      sl.addText('Followers, day by day', { x: 0.5, y: 1.05, w: 6, h: 0.35, fontSize: 14, bold: true, color: INK, fontFace: FONT });
      sl.addChart(pptx.ChartType.line, [{ name: 'Followers', labels: s.followers.map((f) => f.date.slice(5)), values: s.followers.map((f) => f.value) }], {
        x: 0.4, y: 1.45, w: 6.2, h: 5.3, chartColors: [SERIES[0]], lineSize: 2, lineDataSymbol: 'none', showLegend: false, ...axis,
      });
    }
    if (pillars.length) {
      sl.addText('Engagement rate by pillar', { x: 6.9, y: 1.05, w: 6, h: 0.35, fontSize: 14, bold: true, color: INK, fontFace: FONT });
      // Horizontal bar charts draw bottom-up, so reverse to keep the pillar order.
      const rev = [...pillars].reverse();
      sl.addChart(pptx.ChartType.bar, [{ name: 'Engagement rate %', labels: rev.map((p) => p.name), values: rev.map((p) => Number(p.rate!.toFixed(1))) }], {
        x: 6.8, y: 1.45, w: 6.1, h: 5.3, barDir: 'bar', chartColors: rev.map((p) => SERIES[p.color - 1]), showValue: true, dataLabelFormatCode: '0.0"%"', dataLabelColor: SOFT, dataLabelFontSize: 10, showLegend: false, valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelColor: SOFT, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT,
      });
    }
  }

  // 4. Top posts and partners
  const topPosts = isShown(n, 'topPosts') ? s.topPosts : [];
  const partners = isShown(n, 'partners') ? s.partners : [];
  if (topPosts.length || partners.length) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, 'What worked');
    const head = (cells: string[]) => cells.map((c) => ({ text: c, options: { bold: true, color: MUTED, fontSize: 10, fill: { color: 'F6F6F4' } } }));
    let y = 1.2;
    if (topPosts.length) {
      sl.addText('Top posts', { x: 0.5, y, w: 6, h: 0.35, fontSize: 14, bold: true, color: INK, fontFace: FONT });
      const rows = [head(['Post', 'Pillar', 'Impressions', 'Engagements', 'Rate']), ...topPosts.map((p) => [p.title, p.pillar, num(p.impressions), num(p.engagements), `${p.rate.toFixed(1)}%`].map((c) => ({ text: c, options: { fontSize: 11, color: INK } })))];
      sl.addTable(rows, { x: 0.5, y: y + 0.4, w: 12.3, colW: [5.6, 2.3, 1.5, 1.5, 1.4], border: { type: 'solid', color: LINE, pt: 0.75 }, fontFace: FONT, margin: 0.06 });
      y += 0.6 + (topPosts.length + 1) * 0.42;
    }
    if (partners.length) {
      sl.addText('Creators and partners', { x: 0.5, y: y + 0.2, w: 6, h: 0.35, fontSize: 14, bold: true, color: INK, fontFace: FONT });
      const rows = [
        head(['Partner', 'Views', 'New members', '7-day retention', 'Cost', 'Cost / member']),
        ...partners.slice(0, 6).map((p) =>
          [p.name, compact(p.views), num(p.newMembers), p.retention === null ? '—' : `${Math.round(p.retention)}%`, money(p.cost), p.costPerMember === null ? '—' : money(p.costPerMember, 2)].map((c) => ({ text: c, options: { fontSize: 11, color: INK } })),
        ),
      ];
      sl.addTable(rows, { x: 0.5, y: y + 0.6, w: 12.3, colW: [4.3, 1.6, 1.6, 1.7, 1.4, 1.7], border: { type: 'solid', color: LINE, pt: 0.75 }, fontFace: FONT, margin: 0.06 });
    }
  }

  // 5. Figures and text sections added while editing
  const cards = (n.cards ?? []).filter((c) => c.label || c.value);
  if (cards.length) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, 'Key figures');
    cards.slice(0, 8).forEach((c, i) => {
      const x = 0.5 + (i % 4) * 3.12;
      const y = 1.5 + Math.floor(i / 4) * 2.6;
      sl.addShape('rect', { x, y, w: 2.9, h: 2.3, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 }, rectRadius: 0.1 });
      sl.addText(c.value || '—', { x: x + 0.2, y: y + 0.3, w: 2.5, h: 0.8, fontSize: 30, bold: true, color: INK, fontFace: FONT });
      sl.addText(c.label, { x: x + 0.2, y: y + 1.1, w: 2.5, h: 0.4, fontSize: 13, color: SOFT, fontFace: FONT });
      if (c.note) sl.addText(c.note, { x: x + 0.2, y: y + 1.5, w: 2.5, h: 0.6, fontSize: 11, color: MUTED, fontFace: FONT, valign: 'top' });
    });
  }
  for (const sec of (n.sections ?? []).filter((x) => x.title || x.body)) {
    const sl = pptx.addSlide({ masterName: 'BASE' });
    heading(sl, sec.title || 'Notes');
    sl.addText(sec.body, { x: 0.5, y: 1.3, w: 12.3, h: 5.4, fontSize: 16, color: SOFT, fontFace: FONT, valign: 'top' });
  }

  // 6. Next steps
  if (!isShown(n, 'actions')) return pptx;
  const sl = pptx.addSlide({ masterName: 'BASE' });
  heading(sl, 'What changes next', 'Each one answers a number above');
  n.actions.slice(0, 4).forEach((a, i) => {
    const y = 1.6 + i * 1.3;
    sl.addShape('ellipse', { x: 0.5, y, w: 0.6, h: 0.6, fill: { color: accent } });
    sl.addText(String(i + 1), { x: 0.5, y, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT });
    sl.addText(a.title, { x: 1.35, y: y - 0.05, w: 11.4, h: 0.4, fontSize: 18, bold: true, color: INK, fontFace: FONT });
    sl.addText(a.body, { x: 1.35, y: y + 0.38, w: 11.4, h: 0.7, fontSize: 14, color: SOFT, fontFace: FONT, valign: 'top' });
  });
  if (n.footnote) sl.addText(n.footnote, { x: 0.5, y: 6.45, w: 12.3, h: 0.4, fontSize: 11, color: MUTED, italic: true, fontFace: FONT });

  return pptx;
}
