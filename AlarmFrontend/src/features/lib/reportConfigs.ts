// src/features/lib/reportConfigs.ts
//
// Everything that is NOT a React component lives here:
// types -> report registry -> style tokens -> date helpers -> fetch dispatcher.
// reportsPage.tsx only imports from this file, never defines its own data/logic.

import {
  getTop10BadActorsReport,
  getAlarmRateReport,
  getChatteringAlarmReport,
  getStandingAlarmReport,
  getAlarmFloodReport,
  getAlarmPriorityReport,
  getAllTagReport,
  getAlarmKpiReport,
  getPlantAreaConsole,
  getCollectors,
} from './reportApi';
import type { PlantAreaConsole, Collector } from './reportApi';

// re-exported so reportsPage.tsx only ever imports from this file
export { getPlantAreaConsole, getCollectors };
export type { PlantAreaConsole, Collector };

/* ================================================================== */
/* 1. TYPES */
/* ================================================================== */

export type ReportType =
  | 'top10BadActors'
  | 'chatteringAlarm'
  | 'standing'
  | 'alarmFlood'
  | 'alarmRate'
  | 'alarmPriorityDistribution'
  | 'kpiSummary'
  | 'allTagReport';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

export type Option = {
  value: string;
  label: string;
};

export interface ReportTypeConfig {
  value: ReportType;
  label: string;
  actionName: string;
  periods: PeriodType[];
  /** true => Reports page shows Plant / Area / Console dropdowns */
  supportsLocationFilter?: boolean;
}

export interface Top10BadActorItem {
  id: number;
  rankNo: number;
  tagName: string;
  priority: number;
  count: number;
  percent: number;
}

export interface ChatteringAlarmItem {
  sourceName: string;
  chatteringCount: number;
}

export interface StandingAlarmItem {
  eventstamp: string;
  tagName: string;
  comment: string;
  alarmType: string;
  priority: string;
  duration: string;
}

export interface AlarmFloodBlock {
  blockTime: string;
  gdsOp: number;
  sruOp: number;

  // extra real-API fields (optional, existing UI can ignore them)
  floodEventId?: number;
  floodStart?: string;
  floodEnd?: string;
  durationMinutes?: number;
  floodedBuckets?: number;
  floodAlarmCount?: number;
  peakAlarmCount?: number;
  peakAlarmRatePerHour?: number;
  floodConditionPercentage?: number;
}

export interface AlarmFloodData {
  percentTimeInDuration: number;
  peakAlarmRate: number;
  averageAlarmRate: number;
  blocks: AlarmFloodBlock[];
}

export interface AlarmRateItem {
  hour: string;
  alarmCount: number;
  alarmRate: number;
  alarmRatePer10Min: number;
}

export interface AlarmPriorityItem {
  slot: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  criticalPct: number;
  highPct: number;
  mediumPct: number;
  lowPct: number;
}

export interface KpiSummaryItem {
  kpi: string;
  target: string;
  asFound: number;
  evaluation: 'Critical' | 'Acceptable' | 'Manageable' | string;
}
export interface KpiTopActorItem {
  rankNo: number;
  tagName: string;
  alarmCount: number;
}

export interface KpiChatteringItem {
  tagName: string;
  chatteringCount: number;
}

export interface KpiStandingItem {
  tagName: string;
  startTime: string;
  clearTime: string;
  duration: string;
  tier: string;
}

export interface KpiAlarmRateItem {
  hour: string;
  alarmCount: number;
}

export interface KpiReportData {
  kpi: KpiSummaryItem[];
  topActors: KpiTopActorItem[];
  chattering: KpiChatteringItem[];
  standing: KpiStandingItem[];
  alarmRate: KpiAlarmRateItem[];
}

export interface AllTagItem {
  plantName: string;
  areaName: string;
  consoleName: string;
  sourceName: string;
  priority: string;
  message: string;
  active: string;
  acked: string;
}

export type ReportDataOf<T extends ReportType> = T extends 'top10BadActors'
  ? Top10BadActorItem[]
  : T extends 'chatteringAlarm'
    ? ChatteringAlarmItem[]
    : T extends 'standing'
      ? StandingAlarmItem[]
      : T extends 'alarmFlood'
        ? AlarmFloodData
        : T extends 'alarmRate'
          ? AlarmRateItem[]
          : T extends 'alarmPriorityDistribution'
            ? AlarmPriorityItem[]
            : T extends 'kpiSummary'
              ? KpiReportData
              : T extends 'allTagReport'
                ? AllTagItem[]
                : never;

export interface Column<T> {
  key: keyof T;
  label: string;
  align?: 'left' | 'right';
}

export interface ReportQueryParams {
  startDate: string;
  endDate: string;
  periodType: PeriodType;
  plantName?: string;
  areaName?: string;
  consoleName?: string;
  collectorId?: number;
  collectorName?: string;
}

/* ================================================================== */
/* 2. REPORT REGISTRY — add a new report by adding ONE entry here, */
/* one fetch branch below, and one case in reportsPage's */
/* renderReportBody. Nothing else needs to change. */
/* ================================================================== */

export const REPORT_TYPES: ReportTypeConfig[] = [
  {
    value: 'top10BadActors',
    label: 'Frequency Analysis',
    actionName: 'Top10BadActorsReport',
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'chatteringAlarm',
    label: 'Chattering Alarm',
    actionName: 'ChatteringAlarmReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'standing',
    label: 'Standing Alarm',
    actionName: 'StandingAlarmReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'alarmFlood',
    label: 'Alarm Flood',
    actionName: 'AlarmFloodReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'alarmRate',
    label: 'Alarm Rate',
    actionName: 'AlarmRateReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'alarmPriorityDistribution',
    label: 'Alarm Priority Distribution',
    actionName: 'AlarmPriorityDistributionReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'kpiSummary',
    label: 'KPI Report (Daily Summary)',
    actionName: 'KpiSummaryReport',
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
  {
    value: 'allTagReport',
    label: 'All Tag Report',
    actionName: 'AllTagReport',
    supportsLocationFilter: true,
    periods: ['daily', 'weekly', 'monthly', 'custom'],
  },
];

export const PERIOD_LABELS: Record<PeriodType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

export const REPORT_TYPE_OPTIONS: Option[] = REPORT_TYPES.map((r) => ({
  value: r.value,
  label: r.label,
}));

export const PERIOD_OPTIONS: Option[] = (
  ['daily', 'weekly', 'monthly', 'custom'] as PeriodType[]
).map((p) => ({
  value: p,
  label: PERIOD_LABELS[p],
}));

export function getReportConfig(reportType: ReportType): ReportTypeConfig {
  const config = REPORT_TYPES.find((r) => r.value === reportType);

  if (!config) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  return config;
}

/* ================================================================== */
/* 3. SHARED CHART / TABLE STYLE TOKENS */
/* ================================================================== */

export const AXIS_LABEL_STYLE = {
  colors: '#94A3B8',
  fontSize: '10px',
};

export const GRID_STYLE = {
  borderColor: '#E2E8F0',
  strokeDashArray: 3,
};

export const PRIMARY_COLOR = '#2563EB';

/**
 * The on-screen table font size is intentionally small/"standard" for
 * everyday web use. When exporting to PDF we temporarily bump this same
 * variable up (see useReportPdfExport in reportsPage.tsx) so the captured
 * table is easier to read on paper, then restore it afterwards. Every
 * report table reads its font-size from this single variable so web and
 * PDF stay in sync.
 */
export const DEFAULT_TABLE_FONT_SIZE = '12px';
export const PDF_TABLE_FONT_SIZE = '17px';
export const TABLE_FONT_VAR = '--report-table-font-size';

/* ================================================================== */
/* 4. DATE HELPERS */
/* ================================================================== */

const pad2 = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const getToday = () => toISODate(new Date());

export const getCurrentMonthValue = () => {
  const d = new Date();

  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

export const formatDisplayDate = (iso: string) => {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return iso;
  }

  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDisplayMonth = (monthValue: string) => {
  const [y, m] = monthValue.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);

  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

/** Now -> 29/09/2026 (dd/mm/yyyy, no time) — used for PDF "Generated" */
export const formatGeneratedDate = (d: Date = new Date()) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Monday..Sunday range containing dateStr */
export function computeWeekRange(dateStr: string): {
  start: string;
  end: string;
} {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: toISODate(monday), end: toISODate(sunday) };
}

/** First..last day of month for YYYY-MM */
export function computeMonthRange(monthValue: string): {
  start: string;
  end: string;
} {
  const [y, m] = monthValue.split('-').map(Number);

  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, m || 1, 0);

  return { start: toISODate(start), end: toISODate(end) };
}

/* ================================================================== */
/* 5. FETCH DISPATCHER — one switch, real API per report type */
/*    (all 8 reports now use the real backend, no mock data left) */
/* ================================================================== */

export async function fetchReportData<T extends ReportType>(
  reportType: T,
  params: ReportQueryParams
): Promise<ReportDataOf<T>> {
  const base = {
    periodType: params.periodType,
    startDate: params.startDate,
    endDate: params.endDate,
    collectorId: params.collectorId,
    collectorName: params.collectorName,
  };

  const withLocation = {
    ...base,
    plantName: params.plantName,
    areaName: params.areaName,
    consoleName: params.consoleName,
  };

  switch (reportType) {
    case 'top10BadActors':
      return (await getTop10BadActorsReport(base)) as ReportDataOf<T>;

    case 'chatteringAlarm':
      return (await getChatteringAlarmReport(withLocation)) as ReportDataOf<T>;

    case 'standing':
      return (await getStandingAlarmReport(withLocation)) as ReportDataOf<T>;

    case 'alarmFlood':
      return (await getAlarmFloodReport(withLocation)) as ReportDataOf<T>;

    case 'alarmRate':
      return (await getAlarmRateReport(withLocation)) as ReportDataOf<T>;

    case 'alarmPriorityDistribution':
      return (await getAlarmPriorityReport(withLocation)) as ReportDataOf<T>;

    case 'kpiSummary':
      return (await getAlarmKpiReport(base)) as ReportDataOf<T>;

    case 'allTagReport':
      return (await getAllTagReport(withLocation)) as ReportDataOf<T>;

    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}
