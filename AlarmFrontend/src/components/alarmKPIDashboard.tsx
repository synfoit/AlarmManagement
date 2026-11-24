// src/pages/alarmKPIDashboard.tsx

import React, { useEffect, useMemo, useState, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { createCrudApi } from '../features/lib/createCrudApi';

/* ------------------------------------------------------------------ */
/* API Response Types */
/* ------------------------------------------------------------------ */

interface KpiItem {
  kpi: string;
  target: string;
  asFound: number;
  evaluation: 'Critical' | 'Acceptable' | 'Manageable' | string;
}

interface TopAlarmItem {
  sourceName: string;
  alarmCount: number;
}

interface ChatteringAlarmItem {
  sourceName: string;
  chatteringCount: number;
}

interface StandingStaleAlarmItem {
  sourceName: string;
  alarmStartTime: string;
  alarmClearTime: string;
  hoursActive: number;
  tier: string;
}

interface AlarmRateItem {
  hourStart: string;
  hourEnd: string;
  alarmCount: number;
}

interface AlarmKpiResponse {
  kpi: KpiItem[];
  top10BadActors: TopAlarmItem[];
  chatteringAlarms: ChatteringAlarmItem[];
  standingStaleAlarms: StandingStaleAlarmItem[];
  alarmRate: AlarmRateItem[];
}

/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */

const RESOURCE_NAME = 'AlarmKPI';
const ACTION_NAME = 'GetAlarmKPI';

/* Max number of time labels shown on Alarm Rate x-axis */
const ALARM_RATE_MAX_X_LABELS = 12;

/* ------------------------------------------------------------------ */
/* Priority Matchers */
/* ------------------------------------------------------------------ */

const PRIORITY_MATCHERS: {
  key: string;
  match: string;
  color: string;
  dotClass: string;
}[] = [
  {
    key: 'Critical',
    match: 'critical priority',
    color: '#DC2626',
    dotClass: 'bg-[#DC2626]',
  },
  {
    key: 'High',
    match: 'high priority',
    color: '#F97316',
    dotClass: 'bg-[#F97316]',
  },
  {
    key: 'Medium',
    match: 'medium priority',
    color: '#F59E0B',
    dotClass: 'bg-[#F59E0B]',
  },
  {
    key: 'Low',
    match: 'low priority',
    color: '#10B981',
    dotClass: 'bg-[#10B981]',
  },
];

/* ------------------------------------------------------------------ */
/* Top KPI Cards */
/* ------------------------------------------------------------------ */

const HERO_MATCHERS: {
  label: string;
  match: string;
}[] = [
  {
    label: 'Alarms / Hour / Operator',
    match: 'alarms/hour',
  },
  {
    label: 'Alarms / 10 Min / Operator',
    match: 'alarms/10 min',
  },
  {
    label: '% Time in Flood',
    match: 'flood condition time',
  },
  {
    label: 'Top 10 Alarm Contribution',
    match: 'top 10 alarms contribution',
  },
  {
    label: 'Chattering Alarms',
    match: 'chattering alarms',
  },
  {
    label: 'Standing Alarms',
    match: 'standing alarms',
  },
];

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function isPercentKpi(target: string) {
  return target.includes('%');
}

function fmtKpiValue(item: KpiItem) {
  const pct = isPercentKpi(item.target);

  const val = Number.isInteger(item.asFound)
    ? item.asFound.toString()
    : item.asFound.toFixed(2);

  return `${val}${pct ? '%' : ''}`;
}

function evalPillClasses(evaluation: string) {
  if (evaluation === 'Critical') {
    return 'bg-red-100 text-red-700';
  }

  if (evaluation === 'Acceptable') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (evaluation === 'Manageable') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-600';
}

function evalDotClasses(evaluation: string) {
  if (evaluation === 'Critical') {
    return 'bg-red-500';
  }

  if (evaluation === 'Acceptable') {
    return 'bg-emerald-500';
  }

  if (evaluation === 'Manageable') {
    return 'bg-amber-500';
  }

  return 'bg-slate-400';
}

function formatAlarmDateTime(iso: string | null | undefined) {
  if (!iso) {
    return 'Not available';
  }

  const d = new Date(iso);

  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1) {
    return 'Not available';
  }

  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatHourLabel(iso: string) {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return iso;
  }

  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatHoursActive(hours: number | null | undefined) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) {
    return '—';
  }

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = Math.round(hours % 24);

    return `${days}d ${rem}h`;
  }

  return `${hours.toFixed(1)} h`;
}

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
  action,
  children,
  className = '',
}: {
  title: string;
  action?: JSX.Element;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-slate-700">{title}</h2>

        {action}
      </div>

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component */
/* ------------------------------------------------------------------ */

export default function AlarmKPIDashboard(): JSX.Element {
  const Api = React.useMemo(() => createCrudApi(RESOURCE_NAME), []);

  const [data, setData] = useState<AlarmKpiResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showChatteringLabels, setShowChatteringLabels] = useState(false);
  const [searchParams] = useSearchParams();

  const collectorId = searchParams.get('collectorId');
  const collectorName = searchParams.get('collectorName');

  /* -------------------------------------------------------------- */
  /* Single Date */
  /* -------------------------------------------------------------- */

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  /* -------------------------------------------------------------- */
  /* Fetch API */
  /* -------------------------------------------------------------- */

  async function fetchData() {
    if (!selectedDate || !collectorId || !collectorName) {
      setData(null);
      setError(
        'Collector is not selected. Please open the dashboard from the collector list.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        selectedDate,
        CollectorId: collectorId,
        CollectorName: collectorName,
      });

      const res = await Api.get<AlarmKpiResponse>(
        `${ACTION_NAME}?${params.toString()}`
      );

      const json = res?.data;

      if (!json) {
        throw new Error('Empty response from server');
      }

      setData(json);
    } catch (err) {
      console.error('AlarmKPI fetch failed:', err);

      setError(
        err instanceof Error ? err.message : 'Failed to load alarm data'
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------------------- */
  /* Initial API Call */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    fetchData();

    // Refresh the dashboard whenever the collector changes.
    // To load a different date, the user clicks the existing Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorId, collectorName]);

  /* -------------------------------------------------------------- */
  /* Basic Data */
  /* -------------------------------------------------------------- */

  const hasData = !!data;

  const kpiList = data?.kpi ?? [];

  const top10BadActors = data?.top10BadActors ?? [];

  const chatteringAlarms = data?.chatteringAlarms ?? [];

  const alarmRate = data?.alarmRate ?? [];

  /* -------------------------------------------------------------- */
  /* Hero KPI Cards */
  /* -------------------------------------------------------------- */

  const heroCards = useMemo(
    () =>
      HERO_MATCHERS.map((h) => {
        const found = kpiList.find((k) =>
          k.kpi.toLowerCase().includes(h.match)
        );

        return {
          ...h,
          item: found ?? null,
        };
      }),
    [kpiList]
  );

  /* -------------------------------------------------------------- */
  /* Standing / Stale */
  /* -------------------------------------------------------------- */

  const standingStaleAlarms = useMemo(
    () =>
      [...(data?.standingStaleAlarms ?? [])].sort(
        (a, b) => b.hoursActive - a.hoursActive
      ),
    [data?.standingStaleAlarms]
  );

  const standingAlarms = useMemo(
    () =>
      standingStaleAlarms.filter(
        (alarm) => alarm.tier.toLowerCase() === 'standing'
      ),
    [standingStaleAlarms]
  );

  /* -------------------------------------------------------------- */
  /* Chattering Label Reset */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    setShowChatteringLabels(false);
  }, [data?.chatteringAlarms]);

  /* -------------------------------------------------------------- */
  /* Priority Data */
  /* -------------------------------------------------------------- */

  const priorityData = useMemo(
    () =>
      PRIORITY_MATCHERS.map((p) => {
        const found = kpiList.find((k) =>
          k.kpi.toLowerCase().includes(p.match)
        );

        return {
          ...p,
          value: found ? found.asFound : 0,
        };
      }).filter((p) => p.value > 0 || kpiList.length > 0),
    [kpiList]
  );

  /* ============================================================ */
  /* CHART OPTIONS */
  /* ============================================================ */

  /* -------------------------------------------------------------- */
  /* Priority Donut */
  /* -------------------------------------------------------------- */

  const priorityDonutOptions: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
    },

    labels: priorityData.map((p) => p.key),

    colors: priorityData.map((p) => p.color),

    dataLabels: {
      enabled: false,
    },

    legend: {
      show: false,
    },

    stroke: {
      width: 2,
      colors: ['#fff'],
    },

    plotOptions: {
      pie: {
        donut: {
          size: '62%',
        },
      },
    },

    // Disable the color change on hover and on active slice
    states: {
      hover: {
        filter: {
          type: 'none',
        },
      },
      active: {
        filter: {
          type: 'none',
        },
      },
    },

    tooltip: {
      theme: 'light',
      y: {
        formatter: (v: number) => `${v}%`,
      },
    },
  };
  const priorityDonutSeries = priorityData.map((p) => p.value);

  /* -------------------------------------------------------------- */
  /* Top 10 Bad Actors */
  /* -------------------------------------------------------------- */

  const top10Options: ApexOptions = {
    chart: {
      type: 'bar',

      toolbar: {
        show: false,
      },

      fontFamily: 'inherit',
    },

    colors: ['#2563EB'],

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 2,
        barHeight: '55%',
      },
    },

    dataLabels: {
      enabled: true,

      style: {
        colors: ['#e7e7e7'],
        fontSize: '13px',
        fontWeight: 500,
      },

      offsetX: -2,
    },

    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,
    },

    xaxis: {
      categories: top10BadActors.map((a) => a.sourceName),

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '13px',
        },
      },

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },
    },

    yaxis: {
      labels: {
        style: {
          colors: '#475569',
          fontSize: '13px',
        },
      },
    },

    tooltip: {
      theme: 'light',

      y: {
        formatter: (value: number) => `${value} alarms`,
      },
    },
  };

  const top10Series = [
    {
      name: 'Alarm Count',

      data: top10BadActors.map((a) => a.alarmCount),
    },
  ];

  /* -------------------------------------------------------------- */
  /* Chattering */
  /* -------------------------------------------------------------- */

  const chatteringMaxValue = Math.max(
    0,
    ...chatteringAlarms.map((c) => c.chatteringCount)
  );

  const chatteringBarOptions: ApexOptions = {
    chart: {
      type: 'bar',

      toolbar: {
        show: false,
      },

      fontFamily: 'inherit',

      events: {
        animationEnd: () => {
          setShowChatteringLabels(true);
        },
      },

      animations: {
        enabled: true,
        speed: 800,
      },
    },

    colors: ['#2563EB'],

    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: '50%',

        dataLabels: {
          position: 'top',
        },
      },
    },

    dataLabels: {
      enabled: showChatteringLabels,

      offsetY: -14,

      style: {
        colors: ['#334155'],
        fontSize: '11px',
        fontWeight: 600,
      },

      background: {
        enabled: false,
      },
    },

    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,

      padding: {
        top: 24,
      },
    },

    xaxis: {
      categories: chatteringAlarms.map((c) => c.sourceName),

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '12px',
        },

        rotate: -45,
      },

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },
    },

    yaxis: {
      min: 0,

      max: chatteringMaxValue > 0 ? chatteringMaxValue + 2 : 2,

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '13px',
        },

        formatter: (v: number) => Math.round(v).toString(),
      },
    },

    tooltip: {
      theme: 'light',

      y: {
        formatter: (value: number) => `${value} alarms`,
      },
    },
  };

  const chatteringBarSeries = [
    {
      name: 'Chattering Count',

      data: chatteringAlarms.map((c) => c.chatteringCount),
    },
  ];

  /* -------------------------------------------------------------- */
  /* Alarm Rate */
  /* -------------------------------------------------------------- */

  const alarmRateMaxValue = useMemo(() => {
    const maxValue = Math.max(0, ...alarmRate.map((item) => item.alarmCount));

    if (maxValue === 0) {
      return 10;
    }

    /*
     * Give the highest bar enough headroom
     * for the label above the bar.
     */
    return Math.ceil((maxValue * 1.15) / 20) * 20;
  }, [alarmRate]);

  /* Full "HH:mm - HH:mm" labels used in the tooltip */
  const alarmRateRangeLabels = useMemo(
    () =>
      alarmRate.map(
        (item) =>
          `${formatHourLabel(item.hourStart)} - ${formatHourLabel(
            item.hourEnd
          )}`
      ),
    [alarmRate]
  );

  const alarmRateOptions: ApexOptions = {
    chart: {
      type: 'bar',

      toolbar: {
        show: false,
      },

      fontFamily: 'inherit',

      animations: {
        enabled: true,
        speed: 800,
      },
    },

    colors: ['#2563EB'],

    plotOptions: {
      bar: {
        borderRadius: 2,
        /* many bars -> make them a bit wider so they stay visible */
        columnWidth: alarmRate.length > 48 ? '80%' : '55%',

        dataLabels: {
          position: 'top',
        },
      },
    },

    /*
     * Show the value above a bar ONLY when it is > 0.
     * The "0" labels on every empty slot were the main
     * reason the chart looked crowded.
     */
    dataLabels: {
      enabled: true,

      offsetY: -18,

      formatter: (val: number) => (val > 0 ? String(val) : ''),

      style: {
        colors: ['#334155'],
        fontSize: '11px',
        fontWeight: 600,
      },

      background: {
        enabled: false,
      },
    },

    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,

      padding: {
        top: 30,
        right: 8,
        left: 4,
      },
    },

    xaxis: {
      categories: alarmRate.map((item) => formatHourLabel(item.hourStart)),

      /*
       * Limit how many time labels are drawn on the x-axis
       * (about 12 in total) instead of one for every slot.
       */
      tickAmount: Math.min(
        Math.max(alarmRate.length, 1),
        ALARM_RATE_MAX_X_LABELS
      ),

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
        },

        rotate: -45,

        rotateAlways: false,

        hideOverlappingLabels: true,

        trim: false,

        maxHeight: 50,
      },

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },

      tooltip: {
        enabled: false,
      },
    },

    yaxis: {
      /*
       * Force the chart to start from 0, otherwise ApexCharts
       * may auto-calculate a negative lower bound.
       */
      min: 0,

      max: alarmRateMaxValue,

      tickAmount: 5,

      forceNiceScale: false,

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '13px',
        },

        formatter: (v: number) => Math.round(v).toString(),
      },
    },

    tooltip: {
      theme: 'light',

      x: {
        formatter: (_val: number, opts?: { dataPointIndex?: number }) =>
          alarmRateRangeLabels[opts?.dataPointIndex ?? 0] ?? String(_val),
      },

      y: {
        formatter: (value: number) => `${value} alarms`,
      },
    },
  };

  const alarmRateSeries = [
    {
      name: 'Alarm Count',

      data: alarmRate.map((item) => item.alarmCount),
    },
  ];

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
              Alarm KPI Dashboard
            </div>

            <div className="text-[12px] text-slate-400">Daily Dashboard</div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[14px] text-slate-500">Date</label>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
            />
          </div>

          <button
            type="button"
            onClick={fetchData}
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
          Failed to load alarm data
          {error ? `: ${error}` : ''}. Showing "Data not available" until the
          API responds.
        </div>
      )}

      {/* ======================================================== */}
      {/* LOADING */}
      {/* ======================================================== */}

      {!error && loading && !hasData && (
        <div className="mt-3 border-b border-blue-200 bg-blue-50 px-5 py-2 text-[14px] text-blue-700">
          Loading alarm data…
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN */}
      {/* ======================================================== */}

      <main className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {/* ====================================================== */}
        {/* TOP KPI CARDS */}
        {/* ====================================================== */}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {heroCards.map((h, i) => (
            <div
              key={i}
              className="rounded-md border border-slate-200 bg-white p-3.5 shadow-sm"
            >
              <p className="text-[13px] font-medium text-slate-500">
                {h.label}
              </p>

              <p className="mt-1.5 text-[26px] font-bold leading-none text-slate-800">
                {h.item ? fmtKpiValue(h.item) : '—'}
              </p>

              <div className="mt-2.5 flex items-center gap-1.5">
                {h.item ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${evalPillClasses(
                      h.item.evaluation
                    )}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${evalDotClasses(
                        h.item.evaluation
                      )}`}
                    />

                    {h.item.evaluation}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-300">
                    Data is not available
                  </span>
                )}

                {h.item && (
                  <span className="truncate text-[11px] text-slate-400">
                    target {h.item.target}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ====================================================== */}
        {/* ROW 1 */}
        {/* ISA | BAD ACTORS | CHATTERING */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          {/* ---------------------------------------------------- */}
          {/* ISA 18.2 Compliance */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="KPI-ISA 18.2">
            {hasData && kpiList.length > 0 ? (
              <div className="max-h-[310px] overflow-y-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="py-2 pr-2 font-medium">Metric</th>

                      <th className="py-2 pr-2 font-medium">Target</th>

                      <th className="py-2 pr-2 font-medium">As Found</th>

                      <th className="py-2 font-medium">Evaluate</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {kpiList.map((k, i) => (
                      <tr
                        key={i}
                        className="text-slate-700 transition hover:bg-slate-50/70"
                      >
                        <td className="py-2 pr-2 leading-4" title={k.kpi}>
                          {k.kpi}
                        </td>

                        <td className="whitespace-nowrap py-2 pr-2 text-slate-500">
                          {k.target}
                        </td>

                        <td className="whitespace-nowrap py-2 pr-2 font-semibold text-slate-700">
                          {fmtKpiValue(k)}
                        </td>

                        <td className="py-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold ${evalPillClasses(
                              k.evaluation
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${evalDotClasses(
                                k.evaluation
                              )}`}
                            />

                            {k.evaluation}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState height={250} />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Top 10 Bad Actors */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Top 10 Alarms/bad actors">
            {hasData && top10BadActors.length > 0 ? (
              <Chart
                options={top10Options}
                series={top10Series}
                type="bar"
                height={Math.max(240, top10BadActors.length * 28)}
              />
            ) : (
              <EmptyState message="No alarm data available" height={250} />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Chattering Alarms */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Chattering Alarms">
            {hasData && chatteringAlarms.length > 0 ? (
              <Chart
                options={chatteringBarOptions}
                series={chatteringBarSeries}
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
        {/* STANDING (wider) | PRIORITY (narrow) | ALARM RATE (wide) */}
        {/* 12-col grid -> 4 / 3 / 5 on large screens only          */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
          {/* ---------------------------------------------------- */}
          {/* Standing Alarms */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Standing Alarms" className="lg:col-span-4">
            {hasData && standingAlarms.length > 0 ? (
              <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed text-left text-[13px]">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[37%]" />
                    <col className="w-[23%]" />
                  </colgroup>

                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="py-2.5 pr-2 font-medium">Source</th>

                      <th className="py-2.5 pr-2 font-medium">Alarm Start</th>

                      <th className="py-2.5 text-right font-medium">Active</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {standingAlarms.map((alarm, index) => (
                      <tr
                        key={`${alarm.sourceName}-${alarm.alarmStartTime}-${index}`}
                        className="text-slate-700 transition hover:bg-slate-50/70"
                      >
                        <td
                          className="truncate py-2.5 pr-2 text-[13px] font-medium text-slate-700"
                          title={alarm.sourceName}
                        >
                          {alarm.sourceName}
                        </td>

                        <td
                          className="truncate py-2.5 pr-2 text-[13px] text-slate-600"
                          title={formatAlarmDateTime(alarm.alarmStartTime)}
                        >
                          {formatAlarmDateTime(alarm.alarmStartTime)}
                        </td>

                        <td
                          className="whitespace-nowrap py-2.5 text-right text-[13px] font-semibold text-slate-700"
                          title={`${alarm.hoursActive} hours active`}
                        >
                          {formatHoursActive(alarm.hoursActive)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                message="No standing alarms for selected date"
                height={250}
              />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Alarm Priority Distribution */}
          {/* ---------------------------------------------------- */}

          <SectionCard
            title="Alarm Priority Distribution"
            className="lg:col-span-3"
          >
            {hasData && priorityData.some((p) => p.value > 0) ? (
              <>
                <Chart
                  options={priorityDonutOptions}
                  series={priorityDonutSeries}
                  type="donut"
                  height={170}
                />

                <div className="mt-2.5 space-y-1.5">
                  {priorityData.map((p) => (
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
                        {p.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="Priority data not available" height={250} />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Alarm Rate */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Alarm Rate" className="lg:col-span-5">
            {hasData && alarmRate.length > 0 ? (
              <Chart
                options={alarmRateOptions}
                series={alarmRateSeries}
                type="bar"
                height={280}
              />
            ) : (
              <EmptyState message="No alarm rate data available" height={250} />
            )}
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
