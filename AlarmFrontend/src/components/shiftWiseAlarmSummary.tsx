// src/pages/shiftWiseAlarmSummary.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';

/* ------------------------------------------------------------------ */
/* API Response Types */
/* ------------------------------------------------------------------ */

interface ShiftSummary {
  shiftNo: number;
  shiftName: string;
  alarmCount: number;
  alarmFloodEventGenerateCount: number;
  totalFloodMinutes: number;
  floodConditionPercentage: number;
  standingAlarmCount: number;
  chatteringSourceCount: number;
  criticalPriorityCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
}

interface BadActor {
  shiftNo: number;
  badActorRank: number;
  sourceName: string;
}

interface FloodEvent {
  shiftNo: number;
  floodEventID: number;
  floodStart: string;
  floodEnd: string;
  durationMinutes: number;
  floodedBuckets: number;
  peakAlarmCount: number;
}

interface ChatteringSource {
  shiftNo: number;
  sourceName: string;
  chatteringCount: number;
}

interface ShiftWiseAlarmResponse {
  selectedDate: string;
  shiftSummaries: ShiftSummary[];
  badActors: BadActor[];
  floodEvents: FloodEvent[];
  chatteringSources: ChatteringSource[];
}

/** Range-bar point shape we attach our own `meta` to. */
interface FloodRangePoint {
  x: string;
  y: number[];
  meta: FloodEvent;
}

/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */

const RESOURCE_NAME = 'AlarmKPI';
const ACTION_NAME = 'ShiftWiseAlarmSummary';

/* ------------------------------------------------------------------ */
/* Colors */
/* ------------------------------------------------------------------ */

const PRIORITY_COLORS = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
};

/* Tailwind dot classes (same order as Critical, High, Medium, Low) */
const PRIORITY_DOT_CLASSES = [
  'bg-[#DC2626]',
  'bg-[#F97316]',
  'bg-[#F59E0B]',
  'bg-[#10B981]',
];

const PRIMARY_COLOR = '#2563EB';
const FLOOD_COLOR = '#0EA5E9';
const CHATTER_COLOR = '#7C3AED';
const CHATTER_COLOR_LIGHT = '#C4B5FD';
const CONDITION_COLORS = ['#2563EB', '#8B5CF6', '#0891B2'];
const STANDING_COLOR = '#F59E0B';
const FLOOD_TIMELINE_COLORS = ['#F87171', '#DC2626', '#991B1B'];

/* ------------------------------------------------------------------ */
/* Shared chart style tokens (same look as Alarm KPI Dashboard) */
/* ------------------------------------------------------------------ */

const AXIS_LABEL_STYLE = {
  colors: '#94A3B8',
  fontSize: '12px',
};

const Y_AXIS_LABEL_STYLE = {
  colors: '#94A3B8',
  fontSize: '13px',
};

const CATEGORY_LABEL_STYLE = {
  colors: '#475569',
  fontSize: '13px',
};

const GRID_STYLE = {
  borderColor: '#E2E8F0',
  strokeDashArray: 3,
};

const TOP_DATA_LABEL = {
  enabled: true,
  offsetY: -14,
  style: {
    colors: ['#334155'],
    fontSize: '11px',
    fontWeight: 600,
  },
  background: {
    enabled: false,
  },
};

const LEGEND_STYLE = {
  show: true,
  position: 'bottom' as const,
  fontSize: '12px',
  markers: { size: 6 },
  labels: { colors: '#475569' },
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getToday = () => formatDate(new Date());

const formatDateTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const toMs = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatMinutes = (minutes: number) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours === 0) {
    return `${rest}m`;
  }

  return `${hours}h ${pad(rest)}m`;
};

const getShiftLabel = (shiftNo: number) => `Shift ${shiftNo}`;

/* ------------------------------------------------------------------ */
/* Empty State */
/* ------------------------------------------------------------------ */

const EMPTY_STATE_MIN_HEIGHT: Record<number, string> = {
  160: 'min-h-[160px]',
  250: 'min-h-[250px]',
};

function EmptyState({
  message = 'Data not available',
  height = 160,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-slate-400 ${
        EMPTY_STATE_MIN_HEIGHT[height] ?? 'min-h-[160px]'
      }`}
    >
      <AlertTriangle size={24} className="text-slate-300" />

      <p className="px-4 text-center text-[14px] font-medium">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section Card */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: JSX.Element;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold text-slate-700">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI Card (same shape as Alarm KPI hero cards) */
/* ------------------------------------------------------------------ */

type KpiTone = 'blue' | 'cyan' | 'sky' | 'amber' | 'violet';

function tonePillClasses(tone: KpiTone) {
  if (tone === 'amber') {
    return 'bg-amber-100 text-amber-700';
  }

  if (tone === 'violet') {
    return 'bg-violet-100 text-violet-700';
  }

  if (tone === 'cyan') {
    return 'bg-cyan-100 text-cyan-700';
  }

  if (tone === 'sky') {
    return 'bg-sky-100 text-sky-700';
  }

  return 'bg-blue-100 text-blue-700';
}

function toneDotClasses(tone: KpiTone) {
  if (tone === 'amber') {
    return 'bg-amber-500';
  }

  if (tone === 'violet') {
    return 'bg-violet-500';
  }

  if (tone === 'cyan') {
    return 'bg-cyan-500';
  }

  if (tone === 'sky') {
    return 'bg-sky-500';
  }

  return 'bg-blue-500';
}

function KpiCard({
  label,
  value,
  tag,
  hint,
  tone = 'blue',
}: {
  label: string;
  value: string;
  tag: string;
  hint?: string;
  tone?: KpiTone;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>

      <p className="mt-1.5 text-[26px] font-bold leading-none text-slate-800">
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tonePillClasses(
            tone
          )}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${toneDotClasses(tone)}`}
          />

          {tag}
        </span>

        {hint && (
          <span className="truncate text-[11px] text-slate-400">{hint}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Priority Legend */
/* ------------------------------------------------------------------ */

function PriorityLegend() {
  const items = [
    { label: 'Critical', dotClass: PRIORITY_DOT_CLASSES[0] },
    { label: 'High', dotClass: PRIORITY_DOT_CLASSES[1] },
    { label: 'Medium', dotClass: PRIORITY_DOT_CLASSES[2] },
    { label: 'Low', dotClass: PRIORITY_DOT_CLASSES[3] },
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${item.dotClass}`} />

          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component */
/* ------------------------------------------------------------------ */

export default function ShiftWiseAlarmSummary(): JSX.Element {
  const Api = useMemo(() => createCrudApi(RESOURCE_NAME), []);
  const [searchParams] = useSearchParams();

  const collectorId = searchParams.get('collectorId');
  const collectorName = searchParams.get('collectorName');

  const [selectedDate, setSelectedDate] = useState(getToday());

  const [data, setData] = useState<ShiftWiseAlarmResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [activeShift, setActiveShift] = useState<number | null>(null);

  /* -------------------------------------------------------------- */
  /* Fetch API */
  /* -------------------------------------------------------------- */

  const loadDashboard = useCallback(async () => {
    if (!selectedDate) {
      return;
    }

    if (!collectorId || !collectorName) {
      setData(null);
      setError(
        'Collector is not selected. Please open the dashboard from the collector list.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('SelectedDate', selectedDate);
      params.set('CollectorId', collectorId);
      params.set('CollectorName', collectorName);

      const res = await Api.get<ShiftWiseAlarmResponse>(
        `${ACTION_NAME}?${params.toString()}`
      );

      const json = res?.data;

      if (!json) {
        throw new Error('Empty response from server');
      }

      setData(json);
    } catch (err) {
      console.error('Shift Wise Alarm Summary API Error:', err);

      setError(
        err instanceof Error ? err.message : 'Failed to load alarm data'
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }, [Api, selectedDate, collectorId, collectorName]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* -------------------------------------------------------------- */
  /* Basic Data */
  /* -------------------------------------------------------------- */

  const hasData = !!data;

  const shifts = useMemo(
    () =>
      [...(data?.shiftSummaries ?? [])].sort((a, b) => a.shiftNo - b.shiftNo),
    [data]
  );

  const badActors = data?.badActors ?? [];

  const floodEvents = data?.floodEvents ?? [];

  const chatteringSources = data?.chatteringSources ?? [];

  const shiftCategories = useMemo(
    () => shifts.map((item) => getShiftLabel(item.shiftNo)),
    [shifts]
  );

  useEffect(() => {
    if (shifts.length > 0 && !shifts.some((s) => s.shiftNo === activeShift)) {
      setActiveShift(shifts[0].shiftNo);
    }
  }, [shifts, activeShift]);

  /* -------------------------------------------------------------- */
  /* Totals (KPI headline numbers only) */
  /* -------------------------------------------------------------- */

  const totals = useMemo(() => {
    const sum = (pick: (item: ShiftSummary) => number) =>
      shifts.reduce((acc, item) => acc + Number(pick(item) || 0), 0);

    return {
      alarmCount: sum((i) => i.alarmCount),
      floodEvents: sum((i) => i.alarmFloodEventGenerateCount),
      floodMinutes: sum((i) => i.totalFloodMinutes),
      standingAlarms: sum((i) => i.standingAlarmCount),
      chatteringSources: sum((i) => i.chatteringSourceCount),
      critical: sum((i) => i.criticalPriorityCount),
      high: sum((i) => i.highPriorityCount),
      medium: sum((i) => i.mediumPriorityCount),
      low: sum((i) => i.lowPriorityCount),
      avgFloodPercentage: shifts.length
        ? sum((i) => i.floodConditionPercentage) / shifts.length
        : 0,
    };
  }, [shifts]);

  const busiestShift = useMemo(() => {
    if (!shifts.length) {
      return null;
    }

    return shifts.reduce((max, item) =>
      Number(item.alarmCount) > Number(max.alarmCount) ? item : max
    );
  }, [shifts]);

  /* ============================================================ */
  /* CHART OPTIONS */
  /* ============================================================ */

  /* -------------------------------------------------------------- */
  /* 1. Alarm Count / Load Distribution (priority wise, stacked) */
  /* -------------------------------------------------------------- */

  const alarmLoadSeries = useMemo(
    () => [
      {
        name: 'Critical',
        data: shifts.map((i) => Number(i.criticalPriorityCount || 0)),
      },
      {
        name: 'High',
        data: shifts.map((i) => Number(i.highPriorityCount || 0)),
      },
      {
        name: 'Medium',
        data: shifts.map((i) => Number(i.mediumPriorityCount || 0)),
      },
      {
        name: 'Low',
        data: shifts.map((i) => Number(i.lowPriorityCount || 0)),
      },
    ],
    [shifts]
  );

  const alarmLoadOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },

      colors: [
        PRIORITY_COLORS.critical,
        PRIORITY_COLORS.high,
        PRIORITY_COLORS.medium,
        PRIORITY_COLORS.low,
      ],

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '50%',
          borderRadius: 2,
          borderRadiusApplication: 'end',
        },
      },

      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ffffff'],
          fontSize: '12px',
          fontWeight: 600,
        },
        formatter: (v: number) =>
          Number(v) > 0 ? Number(v).toLocaleString() : '',
      },

      grid: {
        ...GRID_STYLE,
        padding: { top: 12, right: 8, left: 4 },
      },

      xaxis: {
        categories: shiftCategories,
        labels: { style: AXIS_LABEL_STYLE },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: {
        min: 0,
        labels: {
          style: Y_AXIS_LABEL_STYLE,
          formatter: (v: number) => Math.round(Number(v ?? 0)).toString(),
        },
      },

      legend: { show: false },

      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },

      tooltip: {
        theme: 'light',
        shared: true,
        intersect: false,
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
          const shiftLabel =
            w?.globals?.labels?.[dataPointIndex] ??
            shiftCategories[dataPointIndex] ??
            '';

          const seriesNames: string[] = w?.globals?.seriesNames ?? [];

          const rows = series
            .map((s: number[], idx: number) => {
              const value = Number(s?.[dataPointIndex] ?? 0);
              const dotClass = PRIORITY_DOT_CLASSES[idx] ?? 'bg-slate-400';
              const name = seriesNames[idx] ?? '';

              return `
                <div class="flex items-center justify-between gap-3.5 py-0.5">
                  <span class="flex items-center gap-1.5 text-slate-600">
                    <span class="inline-block h-2 w-2 rounded-sm ${dotClass}"></span>
                    ${name}
                  </span>
                  <span class="font-semibold text-slate-700">${value.toLocaleString()}</span>
                </div>
              `;
            })
            .join('');

          const total = series.reduce(
            (acc: number, s: number[]) =>
              acc + Number(s?.[dataPointIndex] ?? 0),
            0
          );

          return `
            <div class="min-w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] shadow-lg">
              <div class="mb-1.5 font-bold text-slate-700">${shiftLabel}</div>
              ${rows}
              <div class="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span class="font-semibold text-slate-600">Total</span>
                <span class="font-bold text-slate-700">${total.toLocaleString()}</span>
              </div>
            </div>
          `;
        },
      },
    }),
    [shiftCategories]
  );

  /* -------------------------------------------------------------- */
  /* 2. Chattering Count (shift level) */
  /* -------------------------------------------------------------- */

  const chatteringCycleTotals = useMemo(
    () =>
      shifts.map((shift) =>
        chatteringSources
          .filter((item) => item.shiftNo === shift.shiftNo)
          .reduce((sum, item) => sum + Number(item.chatteringCount || 0), 0)
      ),
    [shifts, chatteringSources]
  );

  const chatteringOverviewSeries = useMemo(
    () => [
      {
        name: 'Chattering sources',
        data: shifts.map((i) => Number(i.chatteringSourceCount || 0)),
      },
      {
        name: 'Chatter cycles',
        data: chatteringCycleTotals,
      },
    ],
    [shifts, chatteringCycleTotals]
  );

  const chatteringOverviewOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },

      colors: [CHATTER_COLOR, CHATTER_COLOR_LIGHT],

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '50%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },

      dataLabels: TOP_DATA_LABEL,

      grid: {
        ...GRID_STYLE,
        padding: { top: 24, right: 8, left: 4 },
      },

      xaxis: {
        categories: shiftCategories,
        labels: { style: AXIS_LABEL_STYLE },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: {
        min: 0,
        labels: {
          style: Y_AXIS_LABEL_STYLE,
          formatter: (v: number) => Math.round(Number(v ?? 0)).toString(),
        },
      },

      legend: LEGEND_STYLE,

      tooltip: { theme: 'light', shared: true, intersect: false },
    }),
    [shiftCategories]
  );

  /* -------------------------------------------------------------- */
  /* 3. Alarm Floods (events + minutes combo) */
  /* -------------------------------------------------------------- */

  const floodComboSeries = useMemo(
    () => [
      {
        name: 'Flood events',
        type: 'column',
        data: shifts.map((i) => Number(i.alarmFloodEventGenerateCount || 0)),
      },
      {
        name: 'Flood minutes',
        type: 'line',
        data: shifts.map((i) => Number(i.totalFloodMinutes || 0)),
      },
    ],
    [shifts]
  );

  const floodComboOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },

      colors: [FLOOD_COLOR, '#F97316'],

      stroke: { width: [0, 2], curve: 'smooth' },

      markers: { size: [0, 4], strokeWidth: 0 },

      plotOptions: {
        bar: { columnWidth: '45%', borderRadius: 2 },
      },

      dataLabels: {
        ...TOP_DATA_LABEL,
        enabledOnSeries: [0, 1],
      },

      grid: {
        ...GRID_STYLE,
        padding: { top: 24, right: 8, left: 4 },
      },

      xaxis: {
        categories: shiftCategories,
        labels: { style: AXIS_LABEL_STYLE },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: [
        {
          min: 0,
          title: {
            text: 'Flood events',
            style: { color: '#94A3B8', fontSize: '12px', fontWeight: 400 },
          },
          labels: { style: Y_AXIS_LABEL_STYLE },
        },
        {
          opposite: true,
          min: 0,
          title: {
            text: 'Flood minutes',
            style: { color: '#94A3B8', fontSize: '12px', fontWeight: 400 },
          },
          labels: { style: Y_AXIS_LABEL_STYLE },
        },
      ],

      legend: LEGEND_STYLE,

      tooltip: { theme: 'light', shared: true, intersect: false },
    }),
    [shiftCategories]
  );

  /* -------------------------------------------------------------- */
  /* 4. Flood Condition % (radial) */
  /* -------------------------------------------------------------- */

  const floodPercentSeries = useMemo(
    () =>
      shifts.map((i) =>
        Number(Number(i.floodConditionPercentage || 0).toFixed(2))
      ),
    [shifts]
  );

  const floodPercentOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'radialBar', fontFamily: 'inherit' },

      labels: shiftCategories,

      colors: CONDITION_COLORS,

      plotOptions: {
        radialBar: {
          hollow: { size: '40%' },
          track: { background: '#F1F5F9' },
          dataLabels: {
            name: { fontSize: '13px', color: '#94A3B8' },
            value: {
              fontSize: '18px',
              color: '#334155',
              fontWeight: 600,
              formatter: (val: number) => `${Number(val).toFixed(1)}%`,
            },
            total: {
              show: true,
              label: 'Day avg',
              color: '#94A3B8',
              formatter: () => `${totals.avgFloodPercentage.toFixed(1)}%`,
            },
          },
        },
      },

      legend: LEGEND_STYLE,
    }),
    [shiftCategories, totals.avgFloodPercentage]
  );

  /* -------------------------------------------------------------- */
  /* 5. Standing Alarms (per shift) */
  /* -------------------------------------------------------------- */

  const standingAlarmMaxValue = useMemo(() => {
    const maxValue = Math.max(
      0,
      ...shifts.map((i) => Number(i.standingAlarmCount || 0))
    );

    if (maxValue === 0) {
      return 10;
    }

    return Math.ceil((maxValue * 1.15) / 5) * 5;
  }, [shifts]);

  const standingAlarmSeries = useMemo(
    () => [
      {
        name: 'Standing alarms',
        data: shifts.map((i) => Number(i.standingAlarmCount || 0)),
      },
    ],
    [shifts]
  );

  const standingAlarmOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },

      colors: [STANDING_COLOR],

      plotOptions: {
        bar: {
          columnWidth: '50%',
          borderRadius: 2,
          dataLabels: { position: 'top' },
        },
      },

      dataLabels: TOP_DATA_LABEL,

      grid: {
        ...GRID_STYLE,
        padding: { top: 24, right: 8, left: 4 },
      },

      xaxis: {
        categories: shiftCategories,
        labels: { style: AXIS_LABEL_STYLE },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: {
        min: 0,
        max: standingAlarmMaxValue,
        tickAmount: 5,
        forceNiceScale: false,
        labels: {
          style: Y_AXIS_LABEL_STYLE,
          formatter: (v: number) => Math.round(Number(v ?? 0)).toString(),
        },
      },

      legend: { show: false },

      tooltip: {
        theme: 'light',
        y: {
          formatter: (v: number) => `${Number(v).toLocaleString()} standing`,
        },
      },
    }),
    [shiftCategories, standingAlarmMaxValue]
  );

  /* -------------------------------------------------------------- */
  /* 6. Priority Donut (whole day) */
  /* -------------------------------------------------------------- */

  const prioritySeries = [
    totals.critical,
    totals.high,
    totals.medium,
    totals.low,
  ];

  const priorityShare = useMemo(() => {
    const items = [
      {
        key: 'Critical',
        value: totals.critical,
        dotClass: PRIORITY_DOT_CLASSES[0],
      },
      { key: 'High', value: totals.high, dotClass: PRIORITY_DOT_CLASSES[1] },
      {
        key: 'Medium',
        value: totals.medium,
        dotClass: PRIORITY_DOT_CLASSES[2],
      },
      { key: 'Low', value: totals.low, dotClass: PRIORITY_DOT_CLASSES[3] },
    ];

    const total = items.reduce((acc, item) => acc + item.value, 0);

    return items.map((item) => ({
      ...item,
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [totals.critical, totals.high, totals.medium, totals.low]);

  const priorityOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'donut', fontFamily: 'inherit' },

      labels: ['Critical', 'High', 'Medium', 'Low'],

      colors: [
        PRIORITY_COLORS.critical,
        PRIORITY_COLORS.high,
        PRIORITY_COLORS.medium,
        PRIORITY_COLORS.low,
      ],

      legend: { show: false },

      dataLabels: { enabled: false },

      plotOptions: {
        pie: {
          donut: {
            size: '62%',
            labels: {
              show: true,
              name: { color: '#94A3B8', fontSize: '13px' },
              value: {
                color: '#334155',
                fontSize: '19px',
                fontWeight: 600,
                formatter: (val: number) => Number(val).toLocaleString(),
              },
              total: {
                show: true,
                label: 'Total',
                color: '#94A3B8',
                formatter: () => totals.alarmCount.toLocaleString(),
              },
            },
          },
        },
      },

      stroke: { width: 2, colors: ['#fff'] },

      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
      },

      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${Number(v).toLocaleString()} alarms` },
      },
    }),
    [totals.alarmCount]
  );

  /* -------------------------------------------------------------- */
  /* 7. Flood Timeline (range bar) */
  /* -------------------------------------------------------------- */

  const floodTimelineSeries = useMemo<
    Array<{ name: string; data: FloodRangePoint[] }>
  >(() => {
    const grouped = new Map<number, FloodEvent[]>();

    floodEvents.forEach((event) => {
      const list = grouped.get(event.shiftNo) ?? [];
      list.push(event);
      grouped.set(event.shiftNo, list);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([shiftNo, events]) => ({
        name: getShiftLabel(shiftNo),
        color:
          FLOOD_TIMELINE_COLORS[(shiftNo - 1) % FLOOD_TIMELINE_COLORS.length],
        data: events.map((event) => ({
          x: getShiftLabel(shiftNo),
          y: [toMs(event.floodStart), toMs(event.floodEnd)],
          meta: event,
        })),
      }));
  }, [floodEvents]);

  const floodTimelineOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'rangeBar',
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        zoom: { enabled: true },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },
      // Shift-wise red shades (Shift 1 = light, Shift 2 = medium, Shift 3 = dark)
      colors: FLOOD_TIMELINE_COLORS,
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '45%',
          borderRadius: 2,
          ...({ rangeBarGrouped: false } as object),
        },
      },
      dataLabels: { enabled: false },
      grid: {
        ...GRID_STYLE,
        padding: { top: 8, right: 8, left: 4 },
      },
      xaxis: {
        type: 'datetime',
        labels: {
          datetimeUTC: false,
          format: 'HH:mm',
          style: AXIS_LABEL_STYLE,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { style: CATEGORY_LABEL_STYLE },
      },
      legend: {
        ...LEGEND_STYLE,
        markers: { size: 6 },
      },
      tooltip: {
        theme: 'light',
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const series = w?.config?.series as
            | Array<{ data?: FloodRangePoint[] }>
            | undefined;

          const point = series?.[seriesIndex]?.data?.[dataPointIndex];
          const event = point?.meta;

          if (!event) {
            return '';
          }

          return `
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 shadow-lg">
            <div class="mb-1 font-bold">Shift ${event.shiftNo} • Flood Event ${event.floodEventID}</div>
            <div><strong>Start:</strong> ${formatDateTime(event.floodStart)}</div>
            <div><strong>End:</strong> ${formatDateTime(event.floodEnd)}</div>
            <div><strong>Duration:</strong> ${formatMinutes(event.durationMinutes)}</div>
            <div><strong>Flooded buckets:</strong> ${event.floodedBuckets}</div>
            <div><strong>Peak alarms:</strong> ${event.peakAlarmCount}</div>
          </div>
        `;
        },
      },
    }),
    []
  );

  /* -------------------------------------------------------------- */
  /* 8. Shift Drill Down */
  /* -------------------------------------------------------------- */

  const shiftBadActors = useMemo(
    () =>
      badActors
        .filter((item) => item.shiftNo === activeShift)
        .sort((a, b) => a.badActorRank - b.badActorRank),
    [badActors, activeShift]
  );

  const shiftChattering = useMemo(
    () =>
      chatteringSources
        .filter((item) => item.shiftNo === activeShift)
        .sort((a, b) => b.chatteringCount - a.chatteringCount),
    [chatteringSources, activeShift]
  );

  const chatteringDetailOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 800 },
      },

      colors: [PRIMARY_COLOR],

      plotOptions: {
        bar: { horizontal: true, barHeight: '55%', borderRadius: 2 },
      },

      dataLabels: {
        enabled: true,
        offsetX: -2,
        style: {
          colors: ['#e7e7e7'],
          fontSize: '13px',
          fontWeight: 500,
        },
      },

      grid: {
        ...GRID_STYLE,
        padding: { top: 8, right: 8, left: 4 },
      },

      xaxis: {
        categories: shiftChattering.map((item) => item.sourceName),
        labels: { style: AXIS_LABEL_STYLE },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: {
        labels: { style: CATEGORY_LABEL_STYLE },
      },

      legend: { show: false },

      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${Number(v)} chatter cycles` },
      },
    }),
    [shiftChattering]
  );

  /* -------------------------------------------------------------- */
  /* 9. Repeat offenders across shifts */
  /* -------------------------------------------------------------- */

  const repeatOffenders = useMemo(() => {
    const map = new Map<string, number[]>();

    badActors.forEach((item) => {
      const list = map.get(item.sourceName) ?? [];
      list.push(item.shiftNo);
      map.set(item.sourceName, list);
    });

    return Array.from(map.entries())
      .map(([sourceName, shiftList]) => ({
        sourceName,
        shiftList: Array.from(new Set(shiftList)).sort((a, b) => a - b),
      }))
      .filter((item) => item.shiftList.length > 1)
      .sort((a, b) => b.shiftList.length - a.shiftList.length);
  }, [badActors]);

  /* ============================================================ */
  /* UI */
  /* ============================================================ */

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      {/* ======================================================== */}
      {/* HEADER */}
      {/* ======================================================== */}

      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {/* LEFT */}
        <div className="flex min-w-[220px] items-center gap-2">
          <div>
            <div className="text-[18px] font-semibold text-slate-700">
              Shift-wise Alarm Summary
            </div>

            <div className="text-[12px] text-slate-400">
              Alarm KPI Dashboard
              {data?.selectedDate
                ? ` • ${new Date(data.selectedDate).toLocaleDateString()}`
                : ''}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[14px] text-slate-500">Date</label>

            <input
              type="date"
              max={getToday()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
            />
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading || !selectedDate}
            className="flex h-9 items-center gap-2 rounded bg-sky-600 px-3 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* ERROR */}
      {/* ======================================================== */}

      {error && (
        <div className="mt-3 border-b border-red-200 bg-red-50 px-5 py-2 text-[14px] text-red-700">
          Failed to load shift-wise alarm data
          {error ? `: ${error}` : ''}. Showing "Data not available" until the
          API responds.
        </div>
      )}

      {/* ======================================================== */}
      {/* LOADING */}
      {/* ======================================================== */}

      {!error && loading && !hasData && (
        <div className="mt-3 border-b border-blue-200 bg-blue-50 px-5 py-2 text-[14px] text-blue-700">
          Loading shift-wise alarm data…
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN */}
      {/* ======================================================== */}

      <main className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {/* ====================================================== */}
        {/* TOP KPI CARDS */}
        {/* ====================================================== */}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            label="Total Alarm Count"
            value={totals.alarmCount.toLocaleString()}
            tag={
              busiestShift
                ? `Peak: Shift ${busiestShift.shiftNo}`
                : 'All shifts'
            }
            hint="all shifts"
            tone="blue"
          />

          <KpiCard
            label="Alarm Flood Count"
            value={totals.floodEvents.toLocaleString()}
            tag="Flood events"
            hint="generated events"
            tone="cyan"
          />

          <KpiCard
            label="Time in Flood"
            value={formatMinutes(totals.floodMinutes)}
            tag={`Day avg ${totals.avgFloodPercentage.toFixed(1)}%`}
            hint="combined"
            tone="sky"
          />

          <KpiCard
            label="Standing Alarms"
            value={totals.standingAlarms.toLocaleString()}
            tag="Unresolved"
            hint="across shifts"
            tone="amber"
          />

          <KpiCard
            label="Chattering Sources"
            value={totals.chatteringSources.toLocaleString()}
            tag="Repeating tags"
            hint="tune deadband"
            tone="violet"
          />
        </div>

        {/* ====================================================== */}
        {/* ROW 1 */}
        {/* LOAD DISTRIBUTION | CHATTERING COUNT */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <SectionCard
            title="Alarm Count / Load Distribution"
            subtitle="Shift-wise, split by priority"
          >
            {hasData && shifts.length > 0 ? (
              <>
                <Chart
                  options={alarmLoadOptions}
                  series={alarmLoadSeries}
                  type="bar"
                  height={280}
                />

                <PriorityLegend />
              </>
            ) : (
              <EmptyState message="No alarm data available" height={250} />
            )}
          </SectionCard>

          <SectionCard
            title="Chattering Count"
            subtitle="Sources vs total chatter cycles"
          >
            {hasData && shifts.length > 0 ? (
              <Chart
                options={chatteringOverviewOptions}
                series={chatteringOverviewSeries}
                type="bar"
                height={280}
              />
            ) : (
              <EmptyState
                message="No chattering alarms in range"
                height={250}
              />
            )}
          </SectionCard>
        </div>

        {/* ====================================================== */}
        {/* ROW 2 */}
        {/* FLOODS | FLOOD CONDITION % | STANDING */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SectionCard
            title="Alarm Floods"
            subtitle="Event count vs total flood minutes"
          >
            {hasData && shifts.length > 0 ? (
              <Chart
                options={floodComboOptions}
                series={floodComboSeries}
                type="line"
                height={280}
              />
            ) : (
              <EmptyState message="No flood data available" height={250} />
            )}
          </SectionCard>

          <SectionCard
            title="Flood Condition %"
            subtitle="Share of shift spent in flood"
          >
            {hasData && floodPercentSeries.length > 0 ? (
              <Chart
                options={floodPercentOptions}
                series={floodPercentSeries}
                type="radialBar"
                height={280}
              />
            ) : (
              <EmptyState
                message="Flood condition data not available"
                height={250}
              />
            )}
          </SectionCard>

          <SectionCard title="Standing Alarm Count" subtitle="Shift-wise">
            {hasData && shifts.length > 0 ? (
              <Chart
                options={standingAlarmOptions}
                series={standingAlarmSeries}
                type="bar"
                height={280}
              />
            ) : (
              <EmptyState message="No standing alarms found" height={250} />
            )}
          </SectionCard>
        </div>

        {/* ====================================================== */}
        {/* ROW 3 */}
        {/* PRIORITY DONUT | FLOOD TIMELINE */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SectionCard title="Alarm Priority Distribution" subtitle="Whole day">
            {hasData && totals.alarmCount > 0 ? (
              <>
                <Chart
                  options={priorityOptions}
                  series={prioritySeries}
                  type="donut"
                  height={210}
                />

                <div className="mt-2.5 space-y-1.5">
                  {priorityShare.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span
                          className={`h-2 w-2 rounded-full ${p.dotClass}`}
                        />

                        {p.key}
                      </span>

                      <span className="font-semibold text-slate-700">
                        {p.value.toLocaleString()}
                        <span className="ml-1 font-normal text-slate-400">
                          ({p.percent.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="Priority data not available" height={250} />
            )}
          </SectionCard>

          <SectionCard
            title="Alarm Flood Timeline"
            subtitle="Hover an event for start, end, duration, buckets and peak alarms"
            className="lg:col-span-2"
          >
            {hasData && floodTimelineSeries.length > 0 ? (
              <Chart
                options={floodTimelineOptions}
                series={floodTimelineSeries}
                type="rangeBar"
                height={330}
              />
            ) : (
              <EmptyState
                message="No flood events for this date"
                height={250}
              />
            )}
          </SectionCard>
        </div>

        {/* ====================================================== */}
        {/* ROW 4 */}
        {/* SHIFT DRILL DOWN */}
        {/* ====================================================== */}

        <SectionCard
          title="Shift Drill Down"
          subtitle="Top bad actors and chattering sources for the selected shift"
          action={
            shifts.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {shifts.map((shift) => (
                  <button
                    key={shift.shiftNo}
                    type="button"
                    onClick={() => setActiveShift(shift.shiftNo)}
                    className={`rounded px-2.5 py-1 text-[13px] font-medium transition ${
                      activeShift === shift.shiftNo
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Shift {shift.shiftNo}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {/* ---------------------------------------------------- */}
            {/* Top 10 Bad Actors */}
            {/* ---------------------------------------------------- */}

            <div className="min-w-0">
              <p className="mb-2 text-[13px] font-medium text-slate-500">
                Top 10 bad actors
              </p>

              {shiftBadActors.length > 0 ? (
                <div className="max-h-[310px] overflow-y-auto overflow-x-hidden">
                  <table className="w-full table-fixed text-left text-[13px]">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[82%]" />
                    </colgroup>

                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="py-2.5 pr-3 font-medium">Rank</th>

                        <th className="py-2.5 font-medium">Source</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {shiftBadActors.map((actor) => (
                        <tr
                          key={`${actor.shiftNo}-${actor.badActorRank}`}
                          className="text-slate-700 transition hover:bg-slate-50/70"
                        >
                          <td className="py-2.5 pr-3 text-slate-400">
                            #{actor.badActorRank}
                          </td>

                          <td
                            className="truncate py-2.5 font-medium text-slate-700"
                            title={actor.sourceName}
                          >
                            {actor.sourceName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  message="No bad actors for selected shift"
                  height={250}
                />
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* Chattering sources (per source) */}
            {/* ---------------------------------------------------- */}

            <div className="min-w-0">
              <p className="mb-2 text-[13px] font-medium text-slate-500">
                Chattering sources
              </p>

              {shiftChattering.length > 0 ? (
                <Chart
                  options={chatteringDetailOptions}
                  series={[
                    {
                      name: 'Chatter cycles',
                      data: shiftChattering.map((item) =>
                        Number(item.chatteringCount || 0)
                      ),
                    },
                  ]}
                  type="bar"
                  height={Math.max(240, shiftChattering.length * 28)}
                />
              ) : (
                <EmptyState
                  message="No chattering sources for selected shift"
                  height={250}
                />
              )}
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/* Repeat offenders */}
          {/* ------------------------------------------------------ */}

          {repeatOffenders.length > 0 && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[13px] font-medium text-slate-500">
                Sources that stay bad across shifts
              </p>

              <div className="flex flex-wrap gap-1.5">
                {repeatOffenders.map((item) => (
                  <span
                    key={item.sourceName}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-600"
                  >
                    {item.sourceName}

                    <span className="ml-1.5 text-slate-400">
                      S{item.shiftList.join(', S')}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
