import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import Chart from 'react-apexcharts';
import ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { jsPDF } from 'jspdf';
import { AlertTriangle, Download, FileDown, RefreshCw } from 'lucide-react';
import SelectDropdown from '../features/ui/SelectDropdown';
import logo from '../assets/images/logo.png';
import {
  AXIS_LABEL_STYLE,
  DEFAULT_TABLE_FONT_SIZE,
  GRID_STYLE,
  PERIOD_OPTIONS,
  PRIMARY_COLOR,
  REPORT_TYPE_OPTIONS,
  TABLE_FONT_VAR,
  computeMonthRange,
  computeWeekRange,
  fetchReportData,
  formatDisplayDate,
  formatDisplayMonth,
  formatGeneratedDate,
  getCollectors,
  getCurrentMonthValue,
  getPlantAreaConsole,
  getReportConfig,
  getToday,
} from '../features/lib/reportConfigs';
import type {
  AllTagItem,
  AlarmFloodData,
  AlarmPriorityItem,
  AlarmRateItem,
  ChatteringAlarmItem,
  Collector,
  Column,
  KpiReportData,
  Option,
  PeriodType,
  PlantAreaConsole,
  ReportType,
  StandingAlarmItem,
  Top10BadActorItem,
} from '../features/lib/reportConfigs';

interface ReportMeta {
  title: string;
  periodLabel: string;
  start: string;
  end: string;
  fileBaseName: string;
}

interface UseReportPdfExportArgs {
  reportRef: RefObject<HTMLDivElement | null>;
  meta: ReportMeta | null;
  onError?: (message: string) => void;
}

type PdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

type RGB = [number, number, number];

const PDF_COLORS = {
  head: [2, 132, 199] as RGB, // sky-600
  headLine: [3, 105, 161] as RGB, // sky-700
  rowAlt: [240, 249, 255] as RGB, // sky-50
  border: [203, 213, 225] as RGB, // slate-300
  text: [51, 65, 85] as RGB, // slate-700
  title: [30, 41, 59] as RGB, // slate-800
  muted: [100, 116, 139] as RGB, // slate-500
  light: [148, 163, 184] as RGB, // slate-400
  line: [226, 232, 240] as RGB, // slate-200
};

const EVALUATION_COLORS: Record<string, { fill: RGB; text: RGB }> = {
  Critical: { fill: [254, 226, 226], text: [185, 28, 28] },
  Acceptable: { fill: [209, 250, 229], text: [4, 120, 87] },
  Manageable: { fill: [254, 243, 199], text: [180, 83, 9] },
};

function loadImage(
  src: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas not supported'));

        return;
      }

      ctx.drawImage(img, 0, 0);

      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

function useReportPdfExport({
  reportRef,
  meta,
  onError,
}: UseReportPdfExportArgs) {
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    if (!reportRef.current || !meta) {
      return;
    }

    const reportEl = reportRef.current;

    setExporting(true);

    try {
      const [
        { default: JsPDF },
        { default: html2canvas },
        { default: autoTable },
      ] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
        import('jspdf-autotable'),
      ]);

      const logoImg = await loadImage(logo).catch(() => null);

      const pdf = new JsPDF('p', 'mm', 'a4') as PdfWithAutoTable;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginX = 10;
      const marginTop = 14;
      const marginBottom = 14;
      const contentWidth = pageWidth - marginX * 2;

      let y = marginTop;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - marginBottom) {
          pdf.addPage();
          y = marginTop;
        }
      };

      /* ---------------- HEADER (first page) ---------------- */
      if (logoImg) {
        const logoH = 12;
        const logoW = (logoH * logoImg.width) / logoImg.height;

        pdf.addImage(logoImg.dataUrl, 'PNG', marginX, 8, logoW, logoH);
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(...PDF_COLORS.title);
      pdf.text(meta.title, pageWidth / 2, 14, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...PDF_COLORS.muted);
      pdf.text(meta.periodLabel, pageWidth / 2, 20, { align: 'center' });

      pdf.setDrawColor(...PDF_COLORS.line);
      pdf.setLineWidth(0.4);
      pdf.line(marginX, 24, pageWidth - marginX, 24);

      y = 30;

      /* ---------------- BODY BLOCKS ---------------- */
      const blocks = Array.from(
        reportEl.querySelectorAll<HTMLElement>('[data-pdf]')
      );

      for (const block of blocks) {
        const kind = block.dataset.pdf;

        /* ---- SECTION TITLE ---- */
        if (kind === 'title') {
          ensureSpace(14);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(...PDF_COLORS.title);
          pdf.text(block.textContent?.trim() ?? '', marginX, y + 4);

          y += 9;
        }

        /* ---- CHART -> image ---- */
        if (kind === 'chart') {
          let dataUrl: string | null = null;
          let imgW = 0;
          let imgH = 0;

          // 1) Preferred: ApexCharts' own renderer (keeps data labels, sharp)
          const chartId = block.dataset.chartId;

          if (chartId) {
            try {
              const res = (await ApexCharts.exec(chartId, 'dataURI', {
                scale: 2,
              })) as { imgURI?: string };

              if (res?.imgURI) {
                const loaded = await loadImage(res.imgURI);

                dataUrl = loaded.dataUrl;
                imgW = loaded.width;
                imgH = loaded.height;
              }
            } catch (e) {
              console.warn(
                'ApexCharts dataURI failed, falling back to html2canvas',
                e
              );
            }
          }

          // 2) Fallback
          if (!dataUrl) {
            const canvas = await html2canvas(block, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
            });

            dataUrl = canvas.toDataURL('image/png');
            imgW = canvas.width;
            imgH = canvas.height;
          }

          const maxH = pageHeight - marginTop - marginBottom;

          let w = contentWidth;
          let h = ((imgH * w) / imgW) * 1.3; // <-- 1.3x bigger, tune karo

          if (h > maxH) {
            h = maxH;
            w = (imgW * h) / imgH;
          }

          ensureSpace(h);

          pdf.addImage(
            dataUrl,
            'PNG',
            marginX + (contentWidth - w) / 2,
            y,
            w,
            h
          );

          y += h + 6;
        }

        /* ---- STAT CARDS (Alarm Flood summary) ---- */
        if (kind === 'stats') {
          const cards = Array.from(block.children) as HTMLElement[];
          const gap = 4;
          const cardH = 23;
          const cardW =
            (contentWidth - gap * (cards.length - 1)) / cards.length;

          ensureSpace(cardH + 6);

          cards.forEach((card, i) => {
            const [label = '', value = '', limit = ''] = Array.from(
              card.children
            ).map((c) => c.textContent?.trim() ?? '');

            const x = marginX + i * (cardW + gap);
            const cx = x + cardW / 2;

            pdf.setDrawColor(...PDF_COLORS.line);
            pdf.setFillColor(255, 255, 255);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(...PDF_COLORS.muted);
            pdf.text(label, cx, y + 6.5, { align: 'center' });

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(15);
            pdf.setTextColor(...PDF_COLORS.title);
            pdf.text(value, cx, y + 14.5, { align: 'center' });

            if (limit) {
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(7);
              pdf.setTextColor(...PDF_COLORS.light);
              pdf.text(limit, cx, y + 19.5, { align: 'center' });
            }
          });

          y += cardH + 6;
        }

        /* ---- TABLE -> autoTable (real text) ---- */
        if (kind === 'table') {
          autoTable(pdf, {
            html: block as HTMLTableElement,
            startY: y,
            theme: 'grid',
            margin: {
              left: marginX,
              right: marginX,
              top: marginTop,
              bottom: marginBottom,
            },
            styles: {
              font: 'helvetica',
              fontSize: 8,
              cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
              valign: 'middle',
              lineColor: PDF_COLORS.border,
              lineWidth: 0.2,
              textColor: PDF_COLORS.text,
              overflow: 'linebreak',
            },
            headStyles: {
              fillColor: PDF_COLORS.head,
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 8.5,
              lineColor: PDF_COLORS.headLine,
            },
            bodyStyles: { fillColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: PDF_COLORS.rowAlt },
            didParseCell: (data) => {
              const raw = data.cell.raw as HTMLElement | undefined;
              const cls = raw?.classList;

              // Same alignment as on the web (text-left / text-center / text-right)
              if (cls?.contains('text-right')) {
                data.cell.styles.halign = 'right';
              } else if (cls?.contains('text-center')) {
                data.cell.styles.halign = 'center';
              } else {
                data.cell.styles.halign = 'left';
              }

              // KPI evaluation pill -> coloured cell
              const pill = raw?.querySelector?.('span');

              if (data.section === 'body' && pill) {
                const c = EVALUATION_COLORS[pill.textContent?.trim() ?? ''];

                data.cell.styles.halign = 'center';
                data.cell.styles.fontStyle = 'bold';

                if (c) {
                  data.cell.styles.fillColor = c.fill;
                  data.cell.styles.textColor = c.text;
                }
              }
            },
          });

          y = (pdf.lastAutoTable?.finalY ?? y) + 6;
        }
      }

      /* ---------------- FOOTER (every page) ---------------- */
      const totalPages = pdf.getNumberOfPages();
      const generatedAt = formatGeneratedDate(); // dd/mm/yyyy (no time)

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        pdf.setDrawColor(...PDF_COLORS.line);
        pdf.setLineWidth(0.3);
        pdf.line(
          marginX,
          pageHeight - 10,
          pageWidth - marginX,
          pageHeight - 10
        );

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...PDF_COLORS.muted);

        pdf.text(
          `${meta.title}  |  Generated: ${generatedAt}`,
          marginX,
          pageHeight - 6
        );

        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 6,
          { align: 'right' }
        );
      }

      pdf.setProperties({ title: `${meta.title} (${meta.periodLabel})` });
      pdf.save(`${meta.fileBaseName}_${meta.start}_to_${meta.end}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);

      onError?.(
        'Failed to export PDF. Make sure jspdf, jspdf-autotable and html2canvas are installed.'
      );
    } finally {
      setExporting(false);
    }
  }

  return { exporting, handleExportPdf };
}

function EmptyState({
  message = 'No data',
  height = 160,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-slate-400"
      style={{ minHeight: height }}
    >
      <AlertTriangle size={20} className="text-slate-300" />

      <p className="px-4 text-center text-xs font-medium">{message}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      data-pdf="title"
      className="border-l-4 border-sky-600 pl-2 text-sm font-semibold text-slate-700"
    >
      {children}
    </h3>
  );
}

/** Wrap every <Chart/> in this so the PDF export can find + capture it.
 *  chartId must match options.chart.id of the chart inside. */
function ChartBlock({
  chartId,
  children,
}: {
  chartId: string;
  children: ReactNode;
}) {
  return (
    <div data-pdf="chart" data-chart-id={chartId} className="bg-white">
      {children}
    </div>
  );
}

function DataTable<T extends object>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  if (rows.length === 0) {
    return <EmptyState message="No rows for this period" height={140} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-300">
      <table
        data-pdf="table"
        className="w-full border-collapse"
        style={{
          fontSize: `var(${TABLE_FONT_VAR}, ${DEFAULT_TABLE_FONT_SIZE})`,
        }}
      >
        <thead>
          <tr className="bg-sky-600 text-white">
            {columns.map((c) => {
              const isTagName = String(c.key) === 'tagName';

              return (
                <th
                  key={String(c.key)}
                  className={`whitespace-nowrap border border-sky-700 px-3 py-2 align-middle font-semibold ${
                    isTagName ? 'text-left' : 'text-center'
                  }`}
                >
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-sky-50/40' : 'bg-white'}>
              {columns.map((c) => {
                const isTagName = String(c.key) === 'tagName';

                return (
                  <td
                    key={String(c.key)}
                    className={`whitespace-nowrap border border-slate-200 px-3 py-2 align-middle text-slate-700 ${
                      isTagName ? 'text-left' : 'text-center'
                    }`}
                  >
                    {String(row[c.key] ?? '-')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportHeader({
  title,
  periodLabel,
}: {
  title: string;
  periodLabel: string;
}) {
  return (
    <div className="report-header mb-2 border-b border-slate-200 px-4 pt-1 pb-2">
      <div className="grid grid-cols-[140px_1fr_140px] items-center">
        <div className="flex items-center justify-start">
          <img
            src={logo}
            alt="Synfotech"
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{title}</div>

          <div className="mt-1 text-sm text-slate-500">{periodLabel}</div>
        </div>

        <div />
      </div>
    </div>
  );
}

/**
 * Horizontal bars: the value label is always drawn just OUTSIDE the end of
 * the bar (dark text on white), so it is readable for long and short bars.
 * We leave ~12% extra room on the x-axis (rounded to a "nice" step) so the
 * longest label never clips and axis ticks stay clean.
 */
function getAxisMax(values: number[]): number {
  const raw = Math.max(...values, 1) * 1.12;
  const step = Math.pow(10, Math.floor(Math.log10(raw))) / 2;

  return Math.ceil(raw / step) * step;
}

/* ================================================================== */
/* 3. REPORT BODIES — one component per report type */
/* ================================================================== */

function Top10BadActorsBody({ data }: { data: Top10BadActorItem[] }) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'top10-chart',
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: [PRIMARY_COLOR],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        offsetX: 6,
        style: { colors: ['#1E293B'], fontSize: '12px', fontWeight: 600 },
      },
      grid: GRID_STYLE,
      xaxis: {
        min: 0,
        max: getAxisMax(data.map((d) => d.count)),
        categories: data.map((d) => d.tagName),
        labels: { style: { ...AXIS_LABEL_STYLE, fontSize: '11px' } },
      },
      yaxis: { labels: { style: { colors: '#475569', fontSize: '12px' } } },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} alarms` },
      },
    }),
    [data]
  );

  const columns: Column<Top10BadActorItem>[] = [
    { key: 'rankNo', label: 'Rank' },
    { key: 'tagName', label: 'Tag Name' },
    { key: 'priority', label: 'Priority' },
    { key: 'count', label: 'Alarm Count' },
    { key: 'percent', label: 'Percent %' },
  ];

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        <ChartBlock chartId="top10-chart">
          <Chart
            options={options}
            series={[{ name: 'Alarm Count', data: data.map((d) => d.count) }]}
            type="bar"
            height={Math.max(440, data.length * 40)}
          />
        </ChartBlock>
      ) : (
        <EmptyState message="No bad actors for this period" height={200} />
      )}

      <DataTable columns={columns} rows={data} />
    </div>
  );
}

function ChatteringAlarmBody({ data }: { data: ChatteringAlarmItem[] }) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'chattering-chart',
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: ['#7C3AED'],
      plotOptions: {
        bar: {
          columnWidth: '50%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -24, // label sits clearly above the bar
        style: { colors: ['#334155'], fontSize: '10px', fontWeight: 600 },
      },
      grid: { ...GRID_STYLE, padding: { top: 32 } }, // room for the raised label
      xaxis: {
        categories: data.map((d) => d.sourceName),
        labels: { style: AXIS_LABEL_STYLE, rotate: -45 },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} chatter cycles` },
      },
    }),
    [data]
  );

  const columns: Column<ChatteringAlarmItem>[] = [
    { key: 'sourceName', label: 'Tag Name' },
    { key: 'chatteringCount', label: 'Chattering Count', align: 'right' },
  ];

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        <ChartBlock chartId="chattering-chart">
          <Chart
            options={options}
            series={[
              {
                name: 'Chattering Count',
                data: data.map((d) => d.chatteringCount),
              },
            ]}
            type="bar"
            height={340}
          />
        </ChartBlock>
      ) : (
        <EmptyState
          message="No chattering alarms for this period"
          height={200}
        />
      )}

      <DataTable columns={columns} rows={data} />
    </div>
  );
}

function StandingBody({ data }: { data: StandingAlarmItem[] }) {
  const columns: Column<StandingAlarmItem>[] = [
    { key: 'eventstamp', label: 'Eventstamp' },
    { key: 'tagName', label: 'Tag Name' },
    { key: 'comment', label: 'Comment' },
    { key: 'alarmType', label: 'Alarm Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'duration', label: 'Duration', align: 'right' },
  ];

  return <DataTable columns={columns} rows={data} />;
}

function AlarmFloodBody({ data }: { data: AlarmFloodData }) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'flood-chart',
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: ['#10B981', '#F97316'],
      stroke: { width: 2, curve: 'smooth' },
      markers: { size: 3 },
      grid: GRID_STYLE,
      xaxis: {
        categories: data.blocks.map((b) => b.blockTime),
        labels: { style: AXIS_LABEL_STYLE, rotate: -45 },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      legend: { show: true, position: 'bottom', fontSize: '11px' },
      tooltip: { theme: 'light', shared: true, intersect: false },
    }),
    [data]
  );

  const columns: Column<AlarmFloodData['blocks'][number]>[] = [
    { key: 'blockTime', label: 'Block Time' },
    { key: 'gdsOp', label: 'GDS OP', align: 'right' },
    { key: 'sruOp', label: 'SRU OP', align: 'right' },
  ];

  return (
    <div className="space-y-4">
      {/* data-pdf="stats": each direct child = one card (label / value / limit) */}
      <div data-pdf="stats" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <div className="text-[11px] text-slate-500">
            Percentage Time in Duration
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {data.percentTimeInDuration} %
          </div>
          <div className="text-[9px] text-slate-400">Limit &lt; 1%</div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <div className="text-[11px] text-slate-500">
            Peak Alarm Rate in Duration
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {data.peakAlarmRate}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3 text-center">
          <div className="text-[11px] text-slate-500">
            Average Alarm Rate During Burst
          </div>
          <div className="mt-1 text-xl font-bold text-slate-800">
            {data.averageAlarmRate}
          </div>
          <div className="text-[9px] text-slate-400">Limit &lt; 10</div>
        </div>
      </div>

      {data.blocks.length > 0 ? (
        <ChartBlock chartId="flood-chart">
          <Chart
            options={options}
            series={[
              { name: 'GDS OP', data: data.blocks.map((b) => b.gdsOp) },
              { name: 'SRU OP', data: data.blocks.map((b) => b.sruOp) },
            ]}
            type="line"
            height={340}
          />
        </ChartBlock>
      ) : (
        <EmptyState message="No flood blocks for this period" height={200} />
      )}

      <DataTable columns={columns} rows={data.blocks} />
    </div>
  );
}

function AlarmRateBody({ data }: { data: AlarmRateItem[] }) {
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'rate-chart',
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: ['#0EA5E9'],
      stroke: { width: 3, curve: 'smooth' },
      markers: { size: 4 },
      grid: GRID_STYLE,
      xaxis: {
        categories: data.map((d) => d.hour),
        labels: { style: AXIS_LABEL_STYLE },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} alarms` },
      },
    }),
    [data]
  );

  const columns: Column<AlarmRateItem>[] = [
    { key: 'hour', label: 'Hour' },
    { key: 'alarmCount', label: 'Alarm Count', align: 'right' },
    { key: 'alarmRate', label: 'Alarm Rate', align: 'right' },
    { key: 'alarmRatePer10Min', label: 'Alarm Rate / 10 Min', align: 'right' },
  ];

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        <ChartBlock chartId="rate-chart">
          <Chart
            options={options}
            series={[
              { name: 'Alarm Count', data: data.map((d) => d.alarmCount) },
            ]}
            type="line"
            height={340}
          />
        </ChartBlock>
      ) : (
        <EmptyState message="No alarm rate data for this period" height={200} />
      )}

      <DataTable columns={columns} rows={data} />
    </div>
  );
}

function AlarmPriorityDistributionBody({
  data,
}: {
  data: AlarmPriorityItem[];
}) {
  // No alarms at all in the period -> show empty state instead of a flat chart
  const hasAlarms = data.some((d) => d.total > 0);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'priority-chart',
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      // Critical, High, Medium, Low
      colors: ['#B91C1C', '#F97316', '#F59E0B', '#10B981'],
      plotOptions: { bar: { columnWidth: '50%', borderRadius: 2 } },
      dataLabels: { enabled: false },
      grid: GRID_STYLE,
      xaxis: {
        categories: data.map((d) => d.slot),
        labels: { style: AXIS_LABEL_STYLE, rotate: -45 },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      legend: { show: true, position: 'bottom', fontSize: '11px' },
      tooltip: { theme: 'light', shared: true, intersect: false },
    }),
    [data]
  );

  const columns: Column<AlarmPriorityItem>[] = [
    { key: 'slot', label: 'Date/Hour' },
    { key: 'critical', label: 'Critical', align: 'right' },
    { key: 'high', label: 'High', align: 'right' },
    { key: 'medium', label: 'Medium', align: 'right' },
    { key: 'low', label: 'Low', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'criticalPct', label: 'Critical %', align: 'right' },
    { key: 'highPct', label: 'High %', align: 'right' },
    { key: 'mediumPct', label: 'Medium %', align: 'right' },
    { key: 'lowPct', label: 'Low %', align: 'right' },
  ];

  return (
    <div className="space-y-4">
      {hasAlarms ? (
        <ChartBlock chartId="priority-chart">
          <Chart
            options={options}
            series={[
              { name: 'Critical Priority', data: data.map((d) => d.critical) },
              { name: 'High Priority', data: data.map((d) => d.high) },
              { name: 'Medium Priority', data: data.map((d) => d.medium) },
              { name: 'Low Priority', data: data.map((d) => d.low) },
            ]}
            type="bar"
            height={340}
          />
        </ChartBlock>
      ) : (
        <EmptyState message="No priority data for this period" height={200} />
      )}

      <DataTable columns={columns} rows={data} />
    </div>
  );
}

function KpiSummaryBody({ data }: { data: KpiReportData }) {
  const pillClasses = (evaluation: string) => {
    if (evaluation === 'Critical') return 'bg-red-100 text-red-700';
    if (evaluation === 'Acceptable') return 'bg-emerald-100 text-emerald-700';
    if (evaluation === 'Manageable') return 'bg-amber-100 text-amber-700';

    return 'bg-slate-100 text-slate-600';
  };

  const topOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'kpi-top10-chart',
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: [PRIMARY_COLOR],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        offsetX: 6,
        style: { colors: ['#1E293B'], fontSize: '12px', fontWeight: 600 },
      },
      grid: GRID_STYLE,
      xaxis: {
        min: 0,
        max: getAxisMax(data.topActors.map((d) => d.alarmCount)),
        categories: data.topActors.map((d) => d.tagName),
        labels: { style: { ...AXIS_LABEL_STYLE, fontSize: '11px' } },
      },
      yaxis: { labels: { style: { colors: '#475569', fontSize: '12px' } } },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} alarms` },
      },
    }),
    [data.topActors]
  );

  const chatterOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'kpi-chatter-chart',
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: ['#7C3AED'],
      plotOptions: {
        bar: {
          columnWidth: '50%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -24,
        style: { colors: ['#334155'], fontSize: '10px', fontWeight: 600 },
      },
      grid: { ...GRID_STYLE, padding: { top: 32 } },
      xaxis: {
        categories: data.chattering.map((d) => d.tagName),
        labels: { style: AXIS_LABEL_STYLE, rotate: -45 },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} chatter cycles` },
      },
    }),
    [data.chattering]
  );

  const rateOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        id: 'kpi-rate-chart',
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
      },
      colors: ['#0EA5E9'],
      stroke: { width: 3, curve: 'smooth' },
      markers: { size: 4 },
      grid: GRID_STYLE,
      xaxis: {
        categories: data.alarmRate.map((d) => d.hour),
        labels: { style: AXIS_LABEL_STYLE, rotate: -45 },
      },
      yaxis: {
        min: 0,
        labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v} alarms` },
      },
    }),
    [data.alarmRate]
  );

  const topColumns: Column<KpiReportData['topActors'][number]>[] = [
    { key: 'rankNo', label: 'Rank' },
    { key: 'tagName', label: 'Tag Name' },
    { key: 'alarmCount', label: 'Alarm Count' },
  ];

  const chatterColumns: Column<KpiReportData['chattering'][number]>[] = [
    { key: 'tagName', label: 'Tag Name' },
    { key: 'chatteringCount', label: 'Chattering Count' },
  ];

  const standingColumns: Column<KpiReportData['standing'][number]>[] = [
    { key: 'tagName', label: 'Tag Name' },
    { key: 'startTime', label: 'Alarm Start Time' },
    { key: 'clearTime', label: 'Alarm Clear Time' },
    { key: 'duration', label: 'Duration (HH:MM:SS)' },
    { key: 'tier', label: 'Tier' },
  ];

  const rateColumns: Column<KpiReportData['alarmRate'][number]>[] = [
    { key: 'hour', label: 'Hour' },
    { key: 'alarmCount', label: 'Alarm Count' },
  ];

  return (
    <div className="space-y-6">
      {/* ---------------- 1. KPI SUMMARY ---------------- */}
      <div className="space-y-2">
        <SectionTitle>KPI Summary</SectionTitle>

        {data.kpi.length === 0 ? (
          <EmptyState message="No KPI data for this period" height={140} />
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-300">
            <table
              data-pdf="table"
              className="w-full border-collapse text-left"
              style={{
                fontSize: `var(${TABLE_FONT_VAR}, ${DEFAULT_TABLE_FONT_SIZE})`,
              }}
            >
              <thead>
                <tr className="bg-sky-600 text-white">
                  <th className="border border-sky-700 px-3 py-2 align-middle font-semibold">
                    KPI
                  </th>
                  <th className="border border-sky-700 px-3 py-2 align-middle font-semibold">
                    Target
                  </th>
                  <th className="border border-sky-700 px-3 py-2 text-right align-middle font-semibold">
                    As Found
                  </th>
                  <th className="border border-sky-700 px-3 py-2 align-middle font-semibold">
                    Evaluation
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {data.kpi.map((k, i) => (
                  <tr key={i} className={i % 2 ? 'bg-sky-50/40' : 'bg-white'}>
                    <td className="border border-slate-200 px-3 py-2 align-middle text-slate-700">
                      {k.kpi}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle text-slate-500">
                      {k.target}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 text-right align-middle font-semibold text-slate-700">
                      {k.asFound}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 align-middle">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[9px] font-semibold ${pillClasses(k.evaluation)}`}
                      >
                        {k.evaluation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- 2. TOP 10 BAD ACTORS ---------------- */}
      <div className="space-y-2">
        <SectionTitle>Top 10 Bad Actors</SectionTitle>

        {data.topActors.length > 0 ? (
          <ChartBlock chartId="kpi-top10-chart">
            <Chart
              options={topOptions}
              series={[
                {
                  name: 'Alarm Count',
                  data: data.topActors.map((d) => d.alarmCount),
                },
              ]}
              type="bar"
              height={Math.max(340, data.topActors.length * 40)}
            />
          </ChartBlock>
        ) : (
          <EmptyState message="No bad actors for this period" height={140} />
        )}

        <DataTable columns={topColumns} rows={data.topActors} />
      </div>

      {/* ---------------- 3. CHATTERING ALARMS ---------------- */}
      <div className="space-y-2">
        <SectionTitle>Chattering Alarms</SectionTitle>

        {data.chattering.length > 0 ? (
          <ChartBlock chartId="kpi-chatter-chart">
            <Chart
              options={chatterOptions}
              series={[
                {
                  name: 'Chattering Count',
                  data: data.chattering.map((d) => d.chatteringCount),
                },
              ]}
              type="bar"
              height={340}
            />
          </ChartBlock>
        ) : (
          <EmptyState
            message="No chattering alarms for this period"
            height={140}
          />
        )}

        <DataTable columns={chatterColumns} rows={data.chattering} />
      </div>

      {/* ---------------- 4. STANDING / STALE ALARMS ---------------- */}
      <div className="space-y-2">
        <SectionTitle>Standing / Stale Alarms</SectionTitle>

        <DataTable columns={standingColumns} rows={data.standing} />
      </div>

      {/* ---------------- 5. ALARM RATE ---------------- */}
      <div className="space-y-2">
        <SectionTitle>Alarm Rate</SectionTitle>

        {data.alarmRate.length > 0 ? (
          <ChartBlock chartId="kpi-rate-chart">
            <Chart
              options={rateOptions}
              series={[
                {
                  name: 'Alarm Count',
                  data: data.alarmRate.map((d) => d.alarmCount),
                },
              ]}
              type="line"
              height={340}
            />
          </ChartBlock>
        ) : (
          <EmptyState
            message="No alarm rate data for this period"
            height={140}
          />
        )}

        <DataTable columns={rateColumns} rows={data.alarmRate} />
      </div>
    </div>
  );
}

function AllTagReportBody({ data }: { data: AllTagItem[] }) {
  const columns: Column<AllTagItem>[] = [
    { key: 'plantName', label: 'Plant Name' },
    { key: 'areaName', label: 'Area Name' },
    { key: 'consoleName', label: 'Console Name' },
    { key: 'sourceName', label: 'Source Name' },
    { key: 'priority', label: 'Priority' },
    { key: 'message', label: 'Message' },
    { key: 'active', label: 'Active' },
    { key: 'acked', label: 'Ack' },
  ];

  return <DataTable columns={columns} rows={data} />;
}

/* ================================================================== */
/* 4. REPORT BODY RESOLVER — add a new report type by adding ONE case */
/* here (plus its registry entry + fetch branch in reportConfigs.ts) */
/* ================================================================== */

function renderReportBody(
  resolvedType: ReportType | null,
  reportData: unknown
): JSX.Element | null {
  if (!resolvedType || reportData === null) {
    return null;
  }

  switch (resolvedType) {
    case 'top10BadActors':
      return <Top10BadActorsBody data={reportData as Top10BadActorItem[]} />;

    case 'chatteringAlarm':
      return <ChatteringAlarmBody data={reportData as ChatteringAlarmItem[]} />;

    case 'standing':
      return <StandingBody data={reportData as StandingAlarmItem[]} />;

    case 'alarmFlood':
      return <AlarmFloodBody data={reportData as AlarmFloodData} />;

    case 'alarmRate':
      return <AlarmRateBody data={reportData as AlarmRateItem[]} />;

    case 'alarmPriorityDistribution':
      return (
        <AlarmPriorityDistributionBody
          data={reportData as AlarmPriorityItem[]}
        />
      );

    case 'kpiSummary':
      return <KpiSummaryBody data={reportData as KpiReportData} />;

    case 'allTagReport':
      return <AllTagReportBody data={reportData as AllTagItem[]} />;

    default:
      return null;
  }
}

/* ================================================================== */
/* 5. MAIN PAGE */
/* ================================================================== */

/** Sentinel for the "All Plants / All Areas / All Consoles" dropdown option. */
const ALL_VALUE = '__all__';

/* ------------------------------------------------------------------ */
/* AUTO EXPORT (opened by .NET Playwright via URL query string)        */
/* Active ONLY when ?autoExport=true. Otherwise returns null and the   */
/* page behaves exactly like the manual flow.                          */
/* ------------------------------------------------------------------ */

interface AutoExportParams {
  reportType: ReportType;
  collectorId: string;
  collectorName: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  plantName: string;
  areaName: string;
  consoleName: string;
}

function readAutoExportParams(): AutoExportParams | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const query = new URLSearchParams(window.location.search);

  if (query.get('autoExport') !== 'true') {
    return null;
  }

  const isIsoDate = (v: string | null): v is string =>
    v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const reportTypeRaw = query.get('reportType');
  const periodTypeRaw = query.get('periodType');
  const collectorId = query.get('collectorId');
  const startDate = query.get('startDate');
  const endDate = query.get('endDate') ?? startDate;

  const reportType = REPORT_TYPE_OPTIONS.find((o) => o.value === reportTypeRaw)
    ?.value as ReportType | undefined;

  const periodType = PERIOD_OPTIONS.find((o) => o.value === periodTypeRaw)
    ?.value as PeriodType | undefined;

  // Missing / invalid required values -> ignore auto mode, stay manual
  if (
    !reportType ||
    !periodType ||
    !collectorId ||
    !isIsoDate(startDate) ||
    !isIsoDate(endDate)
  ) {
    console.warn('autoExport=true but URL parameters are invalid');
    return null;
  }

  return {
    reportType,
    collectorId,
    collectorName: query.get('collectorName') ?? '',
    periodType,
    startDate,
    endDate,
    plantName: query.get('plantName') || ALL_VALUE,
    areaName: query.get('areaName') || ALL_VALUE,
    consoleName: query.get('consoleName') || ALL_VALUE,
  };
}

export default function ReportsPage(): JSX.Element {
  // Read once on first render. null => normal manual mode.
  const [autoParams] = useState<AutoExportParams | null>(() =>
    readAutoExportParams()
  );

  const [reportType, setReportType] = useState<ReportType>(
    autoParams?.reportType ?? 'top10BadActors'
  );
  const [periodType, setPeriodType] = useState<PeriodType>(
    autoParams?.periodType ?? 'daily'
  );
  const [dailyDate, setDailyDate] = useState(
    autoParams?.startDate ?? getToday()
  );
  const [weekAnchorDate, setWeekAnchorDate] = useState(
    autoParams?.startDate ?? getToday()
  );
  const [monthValue, setMonthValue] = useState(
    autoParams ? autoParams.startDate.slice(0, 7) : getCurrentMonthValue()
  );
  const [customStart, setCustomStart] = useState(
    autoParams?.startDate ?? getToday()
  );
  const [customEnd, setCustomEnd] = useState(autoParams?.endDate ?? getToday());

  // Connector (collector) — applies to EVERY report
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [collectorSel, setCollectorSel] = useState<string>(
    autoParams?.collectorId ?? ''
  ); // collectorId as string

  // Plant / Area / Console filter (only used by reports with
  // supportsLocationFilter = true in reportConfigs.ts)
  const [plantTree, setPlantTree] = useState<PlantAreaConsole[]>([]);
  const [plantSel, setPlantSel] = useState<string>(
    autoParams?.plantName ?? ALL_VALUE
  );
  const [areaSel, setAreaSel] = useState<string>(
    autoParams?.areaName ?? ALL_VALUE
  );
  const [consoleSel, setConsoleSel] = useState<string>(
    autoParams?.consoleName ?? ALL_VALUE
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<unknown>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [resolvedType, setResolvedType] = useState<ReportType | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const currentConfig = getReportConfig(reportType);

  /* ---- load Connector list once (first one is auto-selected) ---- */
  useEffect(() => {
    let cancelled = false;
    getCollectors()
      .then((list) => {
        if (cancelled) {
          return;
        }
        setCollectors(list);
        setCollectorSel((prev) =>
          prev || list.length === 0 ? prev : String(list[0].collectorId)
        );
      })
      .catch((err) => {
        console.error('Failed to load connector list:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- load Plant/Area/Console list once ---- */
  useEffect(() => {
    let cancelled = false;
    getPlantAreaConsole()
      .then((list) => {
        if (!cancelled) {
          setPlantTree(list);
        }
      })
      .catch((err) => {
        console.error('Failed to load plant/area/console list:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- connector dropdown options ---- */
  const collectorOptions: Option[] = useMemo(
    () =>
      collectors.map((c) => ({
        value: String(c.collectorId),
        label: c.collectorName,
      })),
    [collectors]
  );

  /* ---- dropdown options (Plant -> Area -> Console cascade) ---- */
  const plantOptions: Option[] = useMemo(
    () => [
      { value: ALL_VALUE, label: 'All Plants' },
      ...plantTree.map((p) => ({ value: p.plantName, label: p.plantName })),
    ],
    [plantTree]
  );

  const areaList = useMemo(
    () => plantTree.find((p) => p.plantName === plantSel)?.areas ?? [],
    [plantTree, plantSel]
  );

  const areaOptions: Option[] = useMemo(
    () => [
      { value: ALL_VALUE, label: 'All Areas' },
      ...areaList.map((a) => ({ value: a.areaName, label: a.areaName })),
    ],
    [areaList]
  );

  const consoleList = useMemo(
    () => areaList.find((a) => a.areaName === areaSel)?.consoles ?? [],
    [areaList, areaSel]
  );

  const consoleOptions: Option[] = useMemo(
    () => [
      { value: ALL_VALUE, label: 'All Consoles' },
      ...consoleList.map((c) => ({ value: c, label: c })),
    ],
    [consoleList]
  );

  function handlePlantChange(value: string) {
    setPlantSel(value);
    setAreaSel(ALL_VALUE);
    setConsoleSel(ALL_VALUE);
  }

  function handleAreaChange(value: string) {
    setAreaSel(value);
    setConsoleSel(ALL_VALUE);
  }

  function handleReportTypeChange(value: ReportType) {
    setReportType(value);
    const config = getReportConfig(value);
    if (!config.periods.includes(periodType)) {
      setPeriodType(config.periods[0]);
    }
  }

  function resolveDateRange(): { start: string; end: string; label: string } {
    if (periodType === 'daily') {
      return {
        start: dailyDate,
        end: dailyDate,
        label: formatDisplayDate(dailyDate),
      };
    }
    if (periodType === 'weekly') {
      const { start, end } = computeWeekRange(weekAnchorDate);
      return {
        start,
        end,
        label: `${formatDisplayDate(start)} to ${formatDisplayDate(end)} (Week)`,
      };
    }
    if (periodType === 'monthly') {
      const { start, end } = computeMonthRange(monthValue);
      return { start, end, label: `${formatDisplayMonth(monthValue)} (Month)` };
    }
    return {
      start: customStart,
      end: customEnd,
      label: `${formatDisplayDate(customStart)} to ${formatDisplayDate(customEnd)}`,
    };
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const { start, end, label } = resolveDateRange();
      if (new Date(start).getTime() > new Date(end).getTime()) {
        throw new Error('Start date cannot be after end date');
      }

      // Connector is required for every report
      const collector = collectors.find(
        (c) => String(c.collectorId) === collectorSel
      );
      if (!collector) {
        throw new Error('Please select a connector');
      }

      // Only reports that support the location filter get these values
      const useLocation = Boolean(currentConfig.supportsLocationFilter);
      const plantName =
        useLocation && plantSel !== ALL_VALUE ? plantSel : undefined;
      const areaName =
        useLocation && areaSel !== ALL_VALUE ? areaSel : undefined;
      const consoleName =
        useLocation && consoleSel !== ALL_VALUE ? consoleSel : undefined;

      const data = await fetchReportData(reportType, {
        startDate: start,
        endDate: end,
        periodType,
        plantName,
        areaName,
        consoleName,
        collectorId: collector.collectorId,
        collectorName: collector.collectorName,
      });

      setReportData(data);
      setResolvedType(reportType);

      // Shown in the report header + PDF,
      // e.g. "RockwellDB > Plant 1 > Area 1 > Console 1"
      const locationLabel = [
        collector.collectorName,
        plantName,
        areaName,
        consoleName,
      ]
        .filter(Boolean)
        .join(' > ');

      // Meta is captured at generate time, so the PDF always matches the
      // report that is on screen (even if the dropdowns are changed later).
      setReportMeta({
        title: currentConfig.label,
        periodLabel: locationLabel ? `${label} | ${locationLabel}` : label,
        start,
        end,
        fileBaseName: currentConfig.actionName,
      });
    } catch (err) {
      console.error('Report generation failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate report'
      );
      setReportData(null);
      setResolvedType(null);
      setReportMeta(null);
    } finally {
      setLoading(false);
    }
  }

  const { exporting, handleExportPdf } = useReportPdfExport({
    reportRef,
    meta: reportMeta,
    onError: setError,
  });

  /* ---- AUTO GENERATE (Playwright): runs once, only if autoExport=true ----
     Waits until the connector list is loaded, because handleGenerate()
     resolves the connector id + name from that list. States were already
     filled from the URL in the initial render. */
  const autoRanRef = useRef(false);

  useEffect(() => {
    if (!autoParams || autoRanRef.current) {
      return;
    }
    if (collectors.length === 0) {
      return;
    }

    autoRanRef.current = true;
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoParams, collectors]);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      {/* HEADER */}
      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div>
          <div className="text-base font-semibold text-slate-700">Reports</div>
          <div className="text-[10px] text-slate-400">
            Generate and export alarm reports
          </div>
        </div>
      </header>

      {/* CONTROLS */}
      <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 pb-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* CONNECTOR — applies to every report */}
          <div className="w-full sm:w-52">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Connector
            </label>
            <SelectDropdown
              label=""
              options={collectorOptions}
              value={
                collectorOptions.find((o) => o.value === collectorSel) ?? null
              }
              onChange={(opt) => {
                const selected = opt as Option | null;
                if (selected) {
                  setCollectorSel(selected.value);
                }
              }}
            />
          </div>

          <div className="w-full sm:w-60">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Report Type
            </label>
            <SelectDropdown
              label=""
              options={REPORT_TYPE_OPTIONS}
              value={
                REPORT_TYPE_OPTIONS.find((o) => o.value === reportType) ?? null
              }
              onChange={(opt) => {
                const selected = opt as Option | null;
                if (selected) {
                  handleReportTypeChange(selected.value as ReportType);
                }
              }}
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Period
            </label>
            <SelectDropdown
              label=""
              options={PERIOD_OPTIONS}
              value={PERIOD_OPTIONS.find((o) => o.value === periodType) ?? null}
              isOptionDisabled={(opt) =>
                !currentConfig.periods.includes(
                  (opt as Option).value as PeriodType
                )
              }
              onChange={(opt) => {
                const selected = opt as Option | null;
                if (selected) {
                  setPeriodType(selected.value as PeriodType);
                }
              }}
            />
          </div>

          {periodType === 'daily' && (
            <div className="w-full sm:w-52">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Date
              </label>
              <input
                type="date"
                max={getToday()}
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition hover:border-sky-600 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
            </div>
          )}

          {periodType === 'weekly' && (
            <div className="relative w-full sm:w-52">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Any Date in Week
              </label>
              <input
                type="date"
                max={getToday()}
                value={weekAnchorDate}
                onChange={(e) => setWeekAnchorDate(e.target.value)}
                className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition hover:border-sky-600 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
              <div className="absolute left-0 top-full mt-0 whitespace-nowrap text-[10px] text-gray-400">
                Week:{' '}
                {formatDisplayDate(computeWeekRange(weekAnchorDate).start)} –{' '}
                {formatDisplayDate(computeWeekRange(weekAnchorDate).end)}
              </div>
            </div>
          )}

          {periodType === 'monthly' && (
            <div className="w-full sm:w-52">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Month
              </label>
              <input
                type="month"
                max={getCurrentMonthValue()}
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
                className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition hover:border-sky-600 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
            </div>
          )}

          {periodType === 'custom' && (
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="w-full sm:w-40">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Start Date
                </label>
                <input
                  type="date"
                  max={customEnd}
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition hover:border-sky-600 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  End Date
                </label>
                <input
                  type="date"
                  min={customStart}
                  max={getToday()}
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition hover:border-sky-600 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>
          )}

          {/* PLANT / AREA / CONSOLE — only for reports that support it
              (supportsLocationFilter = true in reportConfigs.ts).
              Options come from the GetPlantAreaConsole API. */}
          {currentConfig.supportsLocationFilter && (
            <>
              <div className="w-full sm:w-44">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Plant
                </label>
                <SelectDropdown
                  label=""
                  options={plantOptions}
                  value={plantOptions.find((o) => o.value === plantSel) ?? null}
                  onChange={(opt) => {
                    const selected = opt as Option | null;
                    if (selected) {
                      handlePlantChange(selected.value);
                    }
                  }}
                />
              </div>
              <div className="w-full sm:w-44">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Area
                </label>
                <SelectDropdown
                  label=""
                  options={areaOptions}
                  value={areaOptions.find((o) => o.value === areaSel) ?? null}
                  onChange={(opt) => {
                    const selected = opt as Option | null;
                    if (selected) {
                      handleAreaChange(selected.value);
                    }
                  }}
                />
              </div>
              <div className="w-full sm:w-44">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Console
                </label>
                <SelectDropdown
                  label=""
                  options={consoleOptions}
                  value={
                    consoleOptions.find((o) => o.value === consoleSel) ?? null
                  }
                  onChange={(opt) => {
                    const selected = opt as Option | null;
                    if (selected) {
                      setConsoleSel(selected.value);
                    }
                  }}
                />
              </div>
            </>
          )}

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !collectorSel}
              title={!collectorSel ? 'Select a connector first' : undefined}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded bg-sky-600 px-3 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Generate Report
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!reportData || exporting}
              className="flex h-9 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={!reportData ? 'Generate a report first' : 'Export to PDF'}
            >
              {exporting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* REPORT OUTPUT */}
      <div className="mt-2 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        {!reportData && !loading && (
          <EmptyState
            message="Select a connector, report type and period, then click Generate Report"
            height={260}
          />
        )}

        {loading && (
          <div
            className="flex flex-col items-center justify-center gap-2 text-slate-400"
            style={{ minHeight: 260 }}
          >
            <RefreshCw size={20} className="animate-spin text-sky-500" />
            <p className="text-xs font-medium">Generating report…</p>
          </div>
        )}

        {reportData !== null && reportMeta && !loading && (
          <div
            ref={reportRef}
            data-report-ready="true"
            className="bg-white p-2"
            style={
              {
                [TABLE_FONT_VAR]: DEFAULT_TABLE_FONT_SIZE,
              } as React.CSSProperties
            }
          >
            <ReportHeader
              title={reportMeta.title}
              periodLabel={reportMeta.periodLabel}
            />
            {renderReportBody(resolvedType, reportData)}
          </div>
        )}
      </div>

      {reportData !== null && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
          >
            <Download size={13} />
            Download this report as PDF
          </button>
        </div>
      )}
    </div>
  );
}
