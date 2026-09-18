// src/pages/alarmKPIDashboard.tsx
import React, { useEffect, useMemo, useState, type JSX } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { createCrudApi } from '../features/lib/createCrudApi';

interface KpiItem {
  kpi: string;
  target: string;
  asFound: number;
  evaluation: 'Critical' | 'Acceptable' | string;
}

interface TopAlarmItem {
  sourceName: string;
  alarmCount: number;
}

interface ChatteringAlarmItem {
  sourceName: string;
  chatteringCount: number;
}

interface FloodAlarmItem {
  sourceName: string | null;
  floodAlarmCount: number;
  floodPeriodCount: number;
  firstFloodTime: string | null;
  lastFloodTime: string | null;
}

interface StandingStaleAlarmItem {
  sourceName: string;
  alarmStartTime: string;
  alarmClearTime: string;
  hoursActive: number;
  tier: string;
}

interface AlarmKpiResponse {
  kpi: KpiItem[];
  top10Alarms: TopAlarmItem[];
  chatteringAlarms: ChatteringAlarmItem[];
  floodAlarms: FloodAlarmItem[];
  standingStaleAlarms?: StandingStaleAlarmItem[];
}

/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */

// createCrudApi('AlarmKPI') + Api.get('GetAlarmKPI?StartDate=..&EndDate=..')
// matches: /api/AlarmKPI/GetAlarmKPI?StartDate=...&EndDate=...
const RESOURCE_NAME = 'AlarmKPI';
const ACTION_NAME = 'GetAlarmKPI';

/* Priority KPI rows the donut is built from — matched by substring */
/* against kpi.kpi so it stays dynamic even if wording shifts slightly. */
const PRIORITY_MATCHERS: { key: string; match: string; color: string }[] = [
  { key: 'Critical', match: 'critical priority', color: '#DC2626' },
  { key: 'High', match: 'high priority', color: '#F97316' },
  { key: 'Medium', match: 'medium priority', color: '#F59E0B' },
  { key: 'Low', match: 'low priority', color: '#10B981' },
];

/* Hero KPI cards — matched by substring against kpi.kpi. Only real */
/* fields present in the API response are used; nothing is fabricated. */
const HERO_MATCHERS: { label: string; match: string }[] = [
  { label: 'Alarms / Hour / Operator', match: 'alarms/hour' },
  { label: 'Alarms / 10 Min / Operator', match: 'alarms/10 min' },
  { label: '% Time in Flood', match: 'flood condition time' },
  { label: 'Top 10 Alarm Contribution', match: 'top 10 alarms contribution' },
  { label: 'Chattering Alarms', match: 'chattering alarms' },
  { label: 'Stale Alarms', match: 'stale alarms' },
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

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function evalPillClasses(evaluation: string) {
  if (evaluation === 'Critical') return 'bg-red-100 text-red-700';
  if (evaluation === 'Acceptable') return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
}

function evalDotClasses(evaluation: string) {
  if (evaluation === 'Critical') return 'bg-red-500';
  if (evaluation === 'Acceptable') return 'bg-emerald-500';
  return 'bg-amber-500';
}

/* ------------------------------------------------------------------ */
/* Standing / stale alarm helpers */
/* ------------------------------------------------------------------ */

function formatAlarmDateTime(iso: string | null | undefined) {
  if (!iso) return 'Not available';

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

function formatHoursActive(hours: number) {
  if (!Number.isFinite(hours)) return '—';

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  }

  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }

  return `${Math.round(hours * 60)}m`;
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers */
/* ------------------------------------------------------------------ */

function EmptyState({
  message = 'Data not available',
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
      <p className="text-xs font-medium text-center px-4">{message}</p>
    </div>
  );
}

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
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component */
/* ------------------------------------------------------------------ */

export default function AlarmKPIDashboard(): JSX.Element {
  const Api = React.useMemo(() => createCrudApi(RESOURCE_NAME), []);
  const [showChatteringLabels, setShowChatteringLabels] = useState(false);

  const [data, setData] = useState<AlarmKpiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format a Date as the value a <input type="datetime-local"> expects
  // (local time, "YYYY-MM-DDTHH:mm") — using local getters, not toISOString,
  // so the displayed value matches the user's own clock/timezone.
  function toDatetimeLocalValue(d: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [fromDate, setFromDate] = useState(toDatetimeLocalValue(yesterday));
  const [toDate, setToDate] = useState(toDatetimeLocalValue(now));

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        StartDate: fromDate.replace('T', ' ') + ':00',
        EndDate: toDate.replace('T', ' ') + ':00',
      });

      const res = await Api.get<AlarmKpiResponse>(
        `${ACTION_NAME}?${params.toString()}`
      );
      const json = res?.data;
      if (!json) throw new Error('Empty response from server');
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

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasData = !!data;
  const kpiList = data?.kpi ?? [];
  const top10Alarms = data?.top10Alarms ?? [];
  const chatteringAlarms = data?.chatteringAlarms ?? [];
  const floodAlarms = data?.floodAlarms ?? [];

  /* ---------------- Derived: standing / stale alarms ---------------- */
  const standingStaleAlarms = useMemo(
    () =>
      [...(data?.standingStaleAlarms ?? [])].sort(
        (a, b) => b.hoursActive - a.hoursActive
      ),
    [data?.standingStaleAlarms]
  );

  const staleAlarms = useMemo(
    () =>
      standingStaleAlarms.filter(
        (alarm) => alarm.tier.toLowerCase() === 'stale'
      ),
    [standingStaleAlarms]
  );

  const standingAlarms = useMemo(
    () =>
      standingStaleAlarms.filter(
        (alarm) => alarm.tier.toLowerCase() === 'standing'
      ),
    [standingStaleAlarms]
  );
  const longestStandingStaleAlarm =
    standingStaleAlarms.length > 0 ? standingStaleAlarms[0] : null;

  useEffect(() => {
    setShowChatteringLabels(false);
  }, [data?.chatteringAlarms]);

  /* ---------------- Derived: hero cards ---------------- */
  const heroCards = useMemo(
    () =>
      HERO_MATCHERS.map((h) => {
        const found = kpiList.find((k) =>
          k.kpi.toLowerCase().includes(h.match)
        );
        return { ...h, item: found ?? null };
      }),
    [kpiList]
  );

  /* ---------------- Derived: priority donut ---------------- */
  const priorityData = useMemo(
    () =>
      PRIORITY_MATCHERS.map((p) => {
        const found = kpiList.find((k) =>
          k.kpi.toLowerCase().includes(p.match)
        );
        return { ...p, value: found ? found.asFound : 0 };
      }).filter((p) => p.value > 0 || kpiList.length > 0),
    [kpiList]
  );

  /* ---------------- Derived: flood by source (top 8) ---------------- */
  // Rows with no sourceName / zero count are placeholder rows from the API
  // (e.g. no flood activity for that slot) — filter them out so the chart
  // and "has data" checks reflect only real flood sources.
  const validFloodAlarms = useMemo(
    () =>
      floodAlarms.filter(
        (f): f is FloodAlarmItem & { sourceName: string } =>
          !!f.sourceName && f.floodAlarmCount > 0
      ),
    [floodAlarms]
  );

  const floodBySource = useMemo(
    () =>
      [...validFloodAlarms]
        .sort((a, b) => b.floodAlarmCount - a.floodAlarmCount)
        .slice(0, 8),
    [validFloodAlarms]
  );

  /* ---------------- ApexCharts configs ---------------- */

  const priorityDonutOptions: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'inherit' },
    labels: priorityData.map((p) => `${p.key}`),
    colors: priorityData.map((p) => p.color),
    dataLabels: { enabled: false },
    legend: { show: false },
    stroke: { width: 2, colors: ['#fff'] },
    plotOptions: { pie: { donut: { size: '62%' } } },
    tooltip: {
      theme: 'light',
      y: { formatter: (v: number) => `${v}%` },
    },
  };
  const priorityDonutSeries = priorityData.map((p) => p.value);

  const floodBarOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
    colors: ['#10B981'],
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: '55%' },
    },
    dataLabels: {
      enabled: true,
      style: { colors: ['#334155'], fontSize: '11px', fontWeight: 600 },
      offsetX: 6,
    },
    grid: { borderColor: '#E2E8F0', strokeDashArray: 3 },
    xaxis: {
      categories: floodBySource.map((f) => f.sourceName),
      labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#475569', fontSize: '11px' } } },
    tooltip: { theme: 'light' },
  };
  const floodBarSeries = [
    { name: 'Flood Count', data: floodBySource.map((f) => f.floodAlarmCount) },
  ];

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

      // ✅ Labels will be shown only after bar animation completes
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
        borderRadius: 4,
        columnWidth: '50%',

        // Keep label at the top of each bar
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
        fontSize: '9px',
        fontWeight: 600,
      },

      background: {
        enabled: false,
      },
    },

    // Extra top padding + headroom
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
          fontSize: '10px',
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
      max: chatteringMaxValue + 2,

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
        },

        formatter: (v: number) => Math.round(v).toString(),
      },
    },

    tooltip: {
      theme: 'light',
    },
  };

  const chatteringBarSeries = [
    {
      name: 'Chattering Count',
      data: chatteringAlarms.map((c) => c.chatteringCount),
    },
  ];

  const top10Options: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
    colors: ['#2563EB'],
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: '55%' },
    },
    // Light/white label color so the count is readable against the blue bar.
    dataLabels: {
      enabled: true,
      style: { colors: ['#e7e7e7'], fontSize: '11px', fontWeight: 500 },
      offsetX: -2,
    },
    grid: { borderColor: '#E2E8F0', strokeDashArray: 3 },
    xaxis: {
      categories: top10Alarms.map((a) => a.sourceName),
      labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#475569', fontSize: '11px' } } },
    tooltip: { theme: 'light' },
  };
  const top10Series = [
    { name: 'Alarm Count', data: top10Alarms.map((a) => a.alarmCount) },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      {/* ---------------- Header ---------------- */}
      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {/* ================================================= LEFT SIDE - TITLE ================================================= */}
        <div className="flex min-w-[220px] items-center gap-2">
          {/* <AlertTriangle className="text-red-500" size={20} /> */}

          <div>
            <div className="text-base font-semibold text-slate-700">
              Alarm KPI Dashboard
            </div>

            <div className="text-[10px] text-slate-400">
              Alarm Management System
            </div>
          </div>
        </div>

        {/* ================================================= RIGHT SIDE - FILTERS ================================================= */}
        <div className="flex flex-wrap items-center gap-3">
          {/* FROM DATE */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">From</label>

            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="
          h-8
          rounded
          border
          border-slate-300
          bg-white
          px-2
          text-xs
          text-slate-700
          outline-none
          transition
          focus:border-sky-500
          focus:ring-1
          focus:ring-sky-200
        "
            />
          </div>

          <span className="text-xs text-slate-400">→</span>

          {/* TO DATE */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">To</label>

            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="
          h-8
          rounded
          border
          border-slate-300
          bg-white
          px-2
          text-xs
          text-slate-700
          outline-none
          transition
          focus:border-sky-500
          focus:ring-1
          focus:ring-sky-200
        "
            />
          </div>

          {/* REFRESH */}
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="
        flex
        h-8
        items-center
        gap-2
        rounded
        bg-sky-600
        px-3
        text-xs
        font-medium
        text-white
        transition
        hover:bg-sky-700
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
          Failed to load alarm data{error ? `: ${error}` : ''}. Showing "Data
          not available" until the API responds.
        </div>
      )}
      {!error && loading && !hasData && (
        <div className="border-b border-blue-200 bg-blue-50 px-5 py-2 text-xs text-blue-700 mt-3">
          Loading alarm data…
        </div>
      )}

      {/* ---------------- Content ---------------- */}

      <main className="flex-1 space-y-2 overflow-y-auto mt-3">
        {/* Hero KPI row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {heroCards.map((h, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">{h.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-800">
                {h.item ? fmtKpiValue(h.item) : '—'}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                {h.item ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${evalPillClasses(
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
                  <span className="text-[10px] text-slate-300">
                    not in response
                  </span>
                )}
                {h.item && (
                  <span className="text-[10px] text-slate-400">
                    target {h.item.target}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Priority donut / Flood by source / Chattering */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SectionCard title="Alarm Priority Distribution">
            {hasData && priorityData.some((p) => p.value > 0) ? (
              <>
                <Chart
                  options={priorityDonutOptions}
                  series={priorityDonutSeries}
                  type="donut"
                  height={200}
                />
                <div className="mt-2 space-y-1">
                  {priorityData.map((p) => (
                    <div
                      key={p.key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.key}
                      </span>
                      <span className="font-medium text-slate-700">
                        {p.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState height={200} />
            )}
          </SectionCard>

          <SectionCard title="Flood Alarms by Source">
            {hasData && floodBySource.length > 0 ? (
              <Chart
                options={floodBarOptions}
                series={floodBarSeries}
                type="bar"
                height={Math.max(200, floodBySource.length * 30)}
              />
            ) : (
              <EmptyState message="No flood alarms in range" height={200} />
            )}
          </SectionCard>

          <SectionCard title="Chattering Alarms">
            {hasData && chatteringAlarms.length > 0 ? (
              <Chart
                options={chatteringBarOptions}
                series={chatteringBarSeries}
                type="bar"
                height={240}
              />
            ) : (
              <EmptyState
                message="No chattering alarms in range"
                height={240}
              />
            )}
          </SectionCard>
        </div>

        {/* ISA 18.2 table / standing-stale alarms / top 10 */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SectionCard title="ISA 18.2 Compliance">
            {hasData && kpiList.length > 0 ? (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-slate-400">
                      <th className="py-2 pr-2 font-medium">Metric</th>
                      <th className="py-2 pr-2 font-medium">Target</th>
                      <th className="py-2 font-medium">Evaluate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kpiList.map((k, i) => (
                      <tr key={i} className="text-slate-700">
                        <td className="py-2 pr-2">{k.kpi}</td>
                        <td className="py-2 pr-2 text-slate-500">{k.target}</td>
                        <td className="py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${evalPillClasses(
                              k.evaluation
                            )}`}
                          >
                            {k.evaluation}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState height={220} />
            )}
          </SectionCard>

          <SectionCard title="Standing & Stale Alarms">
            {hasData && standingStaleAlarms.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] text-slate-400">Total</p>
                    <p className="text-base font-semibold text-slate-700">
                      {standingStaleAlarms.length}
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2">
                    <p className="text-[10px] text-amber-600">Standing</p>
                    <p className="text-base font-semibold text-amber-700">
                      {standingAlarms.length}
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2">
                    <p className="text-[10px] text-red-600">Stale</p>
                    <p className="text-base font-semibold text-red-700">
                      {staleAlarms.length}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                    <p className="text-[10px] text-slate-400">Longest Active</p>
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {longestStandingStaleAlarm
                        ? formatHoursActive(
                            longestStandingStaleAlarm.hoursActive
                          )
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="max-h-[250px] overflow-y-auto overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[11px]">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="py-2 pr-3 font-medium">Source</th>
                        <th className="py-2 pr-3 text-center font-medium">
                          Status
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Active For
                        </th>
                        <th className="py-2 pr-3 font-medium">Alarm Start</th>
                        <th className="py-2 font-medium">Alarm Clear</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {standingStaleAlarms.map((alarm, index) => {
                        const isStale = alarm.tier.toLowerCase() === 'stale';

                        return (
                          <tr
                            key={`${alarm.sourceName}-${alarm.alarmStartTime}-${index}`}
                            className="text-slate-700"
                          >
                            <td
                              className="max-w-[180px] truncate py-2.5 pr-3 font-medium"
                              title={alarm.sourceName}
                            >
                              {alarm.sourceName}
                            </td>

                            <td className="py-2.5 pr-3 text-center">
                              <span
                                className={`inline-flex min-w-[58px] justify-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                  isStale
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {alarm.tier}
                              </span>
                            </td>

                            <td className="py-2.5 pr-3 text-right font-semibold text-slate-700">
                              {formatHoursActive(alarm.hoursActive)}
                            </td>

                            <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">
                              {formatAlarmDateTime(alarm.alarmStartTime)}
                            </td>

                            <td className="whitespace-nowrap py-2.5 text-slate-500">
                              {formatAlarmDateTime(alarm.alarmClearTime)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState
                message="No standing or stale alarms in range"
                height={240}
              />
            )}
          </SectionCard>

          <SectionCard title="Top 10 Alarms">
            {hasData && top10Alarms.length > 0 ? (
              <Chart
                options={top10Options}
                series={top10Series}
                type="bar"
                height={Math.max(220, top10Alarms.length * 24)}
              />
            ) : (
              <EmptyState height={240} />
            )}
          </SectionCard>
        </div>

        {/* Flood alarm details table */}
        <SectionCard
          title="Flood Alarm Details"
          action={
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              {hasData ? `${validFloodAlarms.length} sources` : ''}
            </span>
          }
        >
          {hasData ? (
            <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="w-[28%] py-2 pr-4 text-left font-medium">
                      Source
                    </th>
                    <th className="w-[16%] py-2 pr-4 text-center font-medium">
                      Flood Count
                    </th>
                    <th className="w-[16%] py-2 pr-4 text-center font-medium">
                      Flood Periods
                    </th>
                    <th className="w-[20%] py-2 pr-4 text-center font-medium">
                      First Flood
                    </th>
                    <th className="w-[20%] py-2 text-center font-medium">
                      Last Flood
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validFloodAlarms.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-slate-400"
                      >
                        No flood alarms in range
                      </td>
                    </tr>
                  )}
                  {validFloodAlarms.map((f, i) => (
                    <tr key={i} className="text-slate-700">
                      <td className="truncate py-2.5 pr-4 text-left font-medium">
                        {f.sourceName}
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                          {f.floodAlarmCount}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center text-slate-500">
                        {f.floodPeriodCount}
                      </td>
                      <td className="truncate py-2.5 pr-4 text-center text-slate-500">
                        {fmtTime(f.firstFloodTime)}
                      </td>
                      <td className="truncate py-2.5 text-center text-slate-500">
                        {fmtTime(f.lastFloodTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState height={200} />
          )}
        </SectionCard>
      </main>
    </div>
  );
}
