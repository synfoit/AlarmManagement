/* src/pages/Home.tsx */
import React, { useEffect, useMemo, useState, type JSX } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import {
  AlertTriangle,
  Bell,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  Activity,
  Zap,
  ListChecks,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { createCrudApi } from '../features/lib/createCrudApi';
/* ------------------------------------------------------------------ */
/* Types — mirror the AlarmKPI API response */
/* ------------------------------------------------------------------ */
interface AlarmSummary {
  totalAlarmActivations: number;
  mttA_Minutes: number;
  mttR_Minutes: number;
  acknowledgedAlarms: number;
  unacknowledgedAlarms: number;
  resolvedAlarms: number;
  unresolvedAlarms: number;
  alarmRatePerHour: number;
}
interface StandingAlarm {
  eventID: string;
  sourceName: string;
  conditionName: string;
  subConditionName: string;
  activeSince: string;
  standingMinutes: number;
  severity: number;
  priority: number;
  acked: boolean;
  message: string;
  groupPath: string;
}
interface ChatteringAlarm {
  sourceName: string;
  conditionName: string;
  subConditionName: string;
  stateChangeCount: number;
  firstChange: string;
  lastChange: string;
  durationSeconds: number;
}
interface BadActor {
  sourceName: string;
  conditionName: string;
  subConditionName: string;
  alarmCount: number;
  unacknowledgedCount: number;
  unresolvedCount: number;
  avgMTTA_Minutes: number | null;
  avgMTTR_Minutes: number | null;
}
interface AlarmRateByHour {
  alarmHour: string;
  alarmCount: number;
}
interface AlarmKpiResponse {
  summary: AlarmSummary;
  standingAlarms: StandingAlarm[];
  chatteringAlarms: ChatteringAlarm[];
  badActors: BadActor[];
  alarmRateByHour: AlarmRateByHour[];
}
type NavKey =
  | 'overview'
  | 'live'
  | 'history'
  | 'analysis'
  | 'chattering'
  | 'standing'
  | 'badActors'
  | 'reports';
/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */
/* NOTE: this follows the exact same call pattern used in BlenderMaster.tsx
 * (createCrudApi(resource) + Api.get<T>('Action?query=..')).
 * If the actual backend action name for this resource is different
 * (e.g. "GetAlarmKPI" instead of calling the resource root directly),
 * just change the string inside Api.get<AlarmKpiResponse>(...) below. */
const RESOURCE_NAME = 'AlarmKPI';
export const NAV_ITEMS: {
  key: NavKey;
  label: string;
  icon: JSX.Element;
}[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <Layers size={18} />,
  },
  {
    key: 'live',
    label: 'Live Alarms',
    icon: <Bell size={18} />,
  },
  {
    key: 'history',
    label: 'History',
    icon: <Clock size={18} />,
  },
  {
    key: 'analysis',
    label: 'Analysis',
    icon: <Activity size={18} />,
  },
  {
    key: 'chattering',
    label: 'Chattering',
    icon: <Zap size={18} />,
  },
  {
    key: 'standing',
    label: 'Standing',
    icon: <ListChecks size={18} />,
  },
  {
    key: 'badActors',
    label: 'Bad Actors',
    icon: <AlertTriangle size={18} />,
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: <BarChart3 size={18} />,
  },
];
[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <Layers size={18} />,
  },
  {
    key: 'live',
    label: 'Live Alarms',
    icon: <Bell size={18} />,
  },
  {
    key: 'history',
    label: 'History',
    icon: <Clock size={18} />,
  },
  {
    key: 'analysis',
    label: 'Analysis',
    icon: <Activity size={18} />,
  },
  {
    key: 'chattering',
    label: 'Chattering',
    icon: <Zap size={18} />,
  },
  {
    key: 'standing',
    label: 'Standing',
    icon: <ListChecks size={18} />,
  },
  {
    key: 'badActors',
    label: 'Bad Actors',
    icon: <AlertTriangle size={18} />,
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: <BarChart3 size={18} />,
  },
];
const SEVERITY_MAP: Record<
  number,
  {
    label: string;
    color: string;
    bg: string;
    text: string;
  }
> = {
  1: {
    label: 'Emergency',
    color: '#DC2626',
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  2: {
    label: 'Critical',
    color: '#DC2626',
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  251: {
    label: 'Advisory',
    color: '#2563EB',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  501: {
    label: 'Warning',
    color: '#D97706',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
};
function severityInfo(sev: number) {
  return (
    SEVERITY_MAP[sev] ?? {
      label: `Sev ${sev}`,
      color: '#6B7280',
      bg: 'bg-gray-100',
      text: 'text-gray-700',
    }
  );
}
function priorityBadge(priority: number) {
  const map: Record<number, string> = {
    1: 'bg-red-100 text-red-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-amber-100 text-amber-700',
    4: 'bg-sky-100 text-sky-700',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-700';
}
/* ------------------------------------------------------------------ */
/* Small presentational helpers */
/* ------------------------------------------------------------------ */
function KpiCard({
  label,
  value,
  suffix,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: string;
  icon: JSX.Element;
  accent: 'red' | 'amber' | 'blue' | 'green' | 'slate';
}) {
  const accents: Record<string, string> = {
    red: 'border-l-red-500 text-red-600 bg-red-50',
    amber: 'border-l-amber-500 text-amber-600 bg-amber-50',
    blue: 'border-l-blue-500 text-blue-600 bg-blue-50',
    green: 'border-l-emerald-500 text-emerald-600 bg-emerald-50',
    slate: 'border-l-slate-400 text-slate-600 bg-slate-50',
  };
  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${accents[accent].split(' ')[0]}`}
    >
      {' '}
      <div className="flex items-start justify-between">
        {' '}
        <div>
          {' '}
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {' '}
            {label}
          </p>{' '}
          <p className="mt-1 text-2xl font-semibold text-slate-800">
            {' '}
            {value}
            {suffix && (
              <span className="ml-1 text-sm font-normal text-slate-400">
                {' '}
                {suffix}
              </span>
            )}
          </p>{' '}
          {delta && <p className="mt-1 text-xs text-slate-400">{delta}</p>}
        </div>{' '}
        <div
          className={`rounded-md p-2 ${accents[accent].split(' ').slice(1).join(' ')}`}
        >
          {' '}
          {icon}
        </div>{' '}
      </div>{' '}
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
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      {' '}
      <div className="mb-3 flex items-center justify-between">
        {' '}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {' '}
          {title}
        </h2>{' '}
        {action}
      </div>{' '}
      {children}
    </div>
  );
}
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
      style={{
        minHeight: height,
      }}
    >
      {' '}
      <AlertTriangle size={20} className="text-slate-300" />{' '}
      <p className="text-xs font-medium">{message}</p>{' '}
    </div>
  );
}
function LoadingState({
  message = 'Loading...',
  height = 160,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-slate-400"
      style={{
        minHeight: height,
      }}
    >
      {' '}
      <RefreshCw size={20} className="animate-spin text-blue-400" />{' '}
      <p className="text-xs font-medium">{message}</p>{' '}
    </div>
  );
}
function fmtTime(iso: string) {
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
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtNum(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}
/* ------------------------------------------------------------------ */
/* Main component */
/* ------------------------------------------------------------------ */
export default function Home(): JSX.Element {
  const Api = React.useMemo(() => createCrudApi(RESOURCE_NAME), []);
  const [data, setData] = useState<AlarmKpiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  function toDatetimeLocalValue(d: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [fromDate, setFromDate] = useState(toDatetimeLocalValue(yesterday));
  const [toDate, setToDate] = useState(toDatetimeLocalValue(new Date()));
  const [source, setSource] = useState('All Sources');
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fromDate: fromDate.replace('T', ' ') + ':00',
        toDate: toDate.replace('T', ' ') + ':00',
        standingMinutes: '30',
        chatteringWindowMinutes: '10',
        chatteringMinChanges: '5',
        topBadActors: '10',
      });
      /* Same call pattern as BlenderMaster.tsx (Api.get<T>('Action?query')) */
      const res = await Api.get<AlarmKpiResponse>(`?${params.toString()}`);
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
  useEffect(() => {
    fetchData();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [autoRefresh, fromDate, toDate]);
  const hasData = !!data;
  const summary = data?.summary ?? null;
  const standingAlarms = data?.standingAlarms ?? [];
  const chatteringAlarms = data?.chatteringAlarms ?? [];
  const badActors = data?.badActors ?? [];
  const alarmRateByHour = data?.alarmRateByHour ?? [];
  const severityPie = useMemo(() => {
    const counts = new Map<
      string,
      {
        count: number;
        color: string;
      }
    >();
    standingAlarms.forEach((a) => {
      const info = severityInfo(a.severity);
      const prev = counts.get(info.label);
      counts.set(info.label, {
        count: (prev?.count ?? 0) + 1,
        color: info.color,
      });
    });
    return Array.from(counts.entries()).map(([name, v]) => ({
      name,
      value: v.count,
      color: v.color,
    }));
  }, [standingAlarms]);
  const groupPathBars = useMemo(() => {
    const counts = new Map<string, number>();
    standingAlarms.forEach((a) =>
      counts.set(a.groupPath, (counts.get(a.groupPath) ?? 0) + 1)
    );
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [standingAlarms]);
  const groupMax = useMemo(
    () => groupPathBars.reduce((m, g) => Math.max(m, g.count), 0),
    [groupPathBars]
  );
  /* 24-hour labels; show the date only when the day actually changes
   * (or on the very first point), otherwise just show HH:00. */
  const rateChartData = useMemo(() => {
    let prevDateKey: string | null = null;
    return alarmRateByHour.map((r, idx) => {
      const d = new Date(r.alarmHour);
      const dateKey = d.toDateString();
      const hh = d.getHours().toString().padStart(2, '0');
      const timeLabel = `${hh}:00`;
      let label = timeLabel;
      if (idx === 0 || dateKey !== prevDateKey) {
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        label = `${dd}/${mm} ${timeLabel}`;
      }
      prevDateKey = dateKey;
      return {
        hour: label,
        count: r.alarmCount,
      };
    });
  }, [alarmRateByHour]);
  /* ---------------- ApexCharts configs ---------------- */
  const rateBarOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: {
        show: true,
        tools: {
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      fontFamily: 'inherit',
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true,
      },
    },
    colors: ['#2563EB'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '50%',
      },
    },
    dataLabels: {
      enabled: false,
    },
    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    xaxis: {
      categories: rateChartData.map((d) => d.hour),
      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
        },
        rotate: -45,
        rotateAlways: false,
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
      forceNiceScale: true,
      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
        },
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    tooltip: {
      theme: 'light',
    },
  };
  const rateBarSeries = [
    {
      name: 'Alarms',
      data: rateChartData.map((d) => d.count),
    },
  ];
  const severityDonutOptions: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
    },
    labels: severityPie.map((s) => s.name),
    colors: severityPie.map((s) => s.color),
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
          size: '65%',
        },
      },
    },
    tooltip: {
      theme: 'light',
    },
  };
  const severityDonutSeries = severityPie.map((s) => s.value);
  const groupBarOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: {
        show: true,
        tools: {
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      fontFamily: 'inherit',
      zoom: {
        enabled: true,
        type: 'x',
      },
    },
    colors: ['#2563EB'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '45%',
      },
    },
    dataLabels: {
      enabled: false,
    },
    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,
    },
    xaxis: {
      categories: groupPathBars.map((g) => g.name),
      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
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
      min: 0,
      /* Explicit max/tickAmount so the axis always reflects the real
       * data range instead of getting stuck at a stale default (e.g. 6)
       * when the max count is actually higher (e.g. 14). */
      max:
        groupMax > 0 ? groupMax + Math.max(1, Math.ceil(groupMax * 0.15)) : 5,
      tickAmount: groupMax > 0 ? Math.min(groupMax, 6) : undefined,
      forceNiceScale: true,
      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '11px',
        },
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    tooltip: {
      theme: 'light',
    },
  };
  const groupBarSeries = [
    {
      name: 'Alarms',
      data: groupPathBars.map((g) => g.count),
    },
  ];
  return (
    <>
      {' '}
      {/* ---------------- Main ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {' '}
        {/* Top bar */}
        <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          {' '}
          {/* ================================================= LEFT SIDE - TITLE ================================================= */}
          <div className="flex min-w-[220px] items-center gap-2">
            {' '}
            {/* <AlertTriangle className="text-red-500" size={20} /> */}
            <div>
              {' '}
              <div className="text-base font-semibold text-slate-700">
                {' '}
                Alarm Dashboard{' '}
              </div>{' '}
              <div className="text-[10px] text-slate-400">
                {' '}
                Alarm Management System{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          {/* ================================================= RIGHT SIDE - FILTERS ================================================= */}
          <div className="flex flex-wrap items-center gap-2">
            {' '}
            {/* FROM DATE */}
            <div className="flex items-center gap-2">
              {' '}
              <label className="text-xs text-slate-500">From</label>{' '}
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className=" h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200 "
              />{' '}
            </div>{' '}
            <span className="text-xs text-slate-400">→</span> {/* TO DATE */}
            <div className="flex items-center gap-2">
              {' '}
              <label className="text-xs text-slate-500">To</label>{' '}
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className=" h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200 "
              />{' '}
            </div>{' '}
            {/* SOURCE */}
            <div className="relative">
              {' '}
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className=" h-8 appearance-none rounded border border-slate-300 bg-white py-1 pl-3 pr-8 text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200 "
              >
                {' '}
                <option>All Sources</option>{' '}
                {Array.from(
                  new Set(standingAlarms.map((a) => a.sourceName))
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>{' '}
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              />{' '}
            </div>{' '}
            {/* REFRESH */}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className=" flex h-8 items-center gap-2 rounded bg-sky-600 px-3 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 "
            >
              {' '}
              <RefreshCw
                size={14}
                className={loading ? 'animate-spin' : ''}
              />{' '}
              Refresh{' '}
            </button>{' '}
            {/* AUTO REFRESH */}
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={` flex h-8 items-center gap-2 rounded border px-3 text-xs font-medium transition ${autoRefresh ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'} `}
            >
              {' '}
              <span
                className={` h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-300'} `}
              />{' '}
              Auto Refresh{' '}
            </button>{' '}
          </div>{' '}
        </header>{' '}
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
            {' '}
            Failed to load alarm data{error ? `: ${error}` : ''}. Showing "Data
            not available" until the API responds.{' '}
          </div>
        )}
        {!error && loading && !hasData && (
          <div className="border-b border-blue-200 bg-blue-50 px-5 py-2 text-xs text-blue-700 mt-3">
            {' '}
            Loading alarm data…{' '}
          </div>
        )}
        {/* Content */}
        <main className="flex-1 space-y-2 overflow-y-auto mt-3">
          {' '}
          {/* KPI row */}
          {hasData && summary ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {' '}
              <KpiCard
                label="Total Alarms"
                value={summary.totalAlarmActivations.toLocaleString()}
                icon={<Bell size={16} />}
                accent="slate"
              />{' '}
              <KpiCard
                label="Acknowledged"
                value={summary.acknowledgedAlarms.toLocaleString()}
                icon={<CheckCircle2 size={16} />}
                accent="green"
              />{' '}
              <KpiCard
                label="Unacknowledged"
                value={summary.unacknowledgedAlarms.toLocaleString()}
                icon={<XCircle size={16} />}
                accent="red"
              />{' '}
              <KpiCard
                label="Unresolved"
                value={summary.unresolvedAlarms.toLocaleString()}
                icon={<AlertTriangle size={16} />}
                accent="amber"
              />{' '}
              <KpiCard
                label="MTTA"
                value={fmtNum(summary.mttA_Minutes)}
                suffix="min"
                icon={<Clock size={16} />}
                accent="blue"
              />{' '}
              <KpiCard
                label="MTTR"
                value={fmtNum(summary.mttR_Minutes)}
                suffix="min"
                icon={<Clock size={16} />}
                accent="blue"
              />{' '}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              {' '}
              <EmptyState message="KPI data not available" height={80} />{' '}
            </div>
          )}
          {/* Rate + severity + category */}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            {' '}
            <SectionCard title="Alarm rate / hour" className="lg:col-span-3">
              {' '}
              {hasData && rateChartData.length > 0 ? (
                <>
                  {' '}
                  <div className="text-xs text-slate-400">
                    {' '}
                    Avg rate:{' '}
                    <span className="font-medium text-slate-600">
                      {' '}
                      {fmtNum(summary?.alarmRatePerHour, 1)}
                      /hr{' '}
                    </span>{' '}
                  </div>{' '}
                  <Chart
                    options={rateBarOptions}
                    series={rateBarSeries}
                    type="bar"
                    height={220}
                  />{' '}
                </>
              ) : (
                <EmptyState height={220} />
              )}
            </SectionCard>{' '}
            <SectionCard title="Standing alarms by severity">
              {' '}
              {hasData && severityPie.length > 0 ? (
                <>
                  {' '}
                  <Chart
                    options={severityDonutOptions}
                    series={severityDonutSeries}
                    type="donut"
                    height={220}
                  />{' '}
                  <div className="mt-2 space-y-1">
                    {' '}
                    {severityPie.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between text-xs"
                      >
                        {' '}
                        <span className="flex items-center gap-1.5 text-slate-600">
                          {' '}
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: s.color,
                            }}
                          />{' '}
                          {s.name}
                        </span>{' '}
                        <span className="font-medium text-slate-700">
                          {' '}
                          {s.value}
                        </span>{' '}
                      </div>
                    ))}
                  </div>{' '}
                </>
              ) : (
                <EmptyState height={220} />
              )}
            </SectionCard>{' '}
          </div>{' '}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            {' '}
            <SectionCard title="Standing alarms by group">
              {' '}
              {hasData && groupPathBars.length > 0 ? (
                <Chart
                  options={groupBarOptions}
                  series={groupBarSeries}
                  type="bar"
                  height={180}
                />
              ) : (
                <EmptyState height={180} />
              )}
            </SectionCard>{' '}
            {/* Chattering alarms */}
            <SectionCard title="Chattering alarms">
              {' '}
              {hasData ? (
                <div className="overflow-x-auto">
                  {' '}
                  <table className="w-full text-left text-xs">
                    {' '}
                    <thead>
                      {' '}
                      <tr className="text-slate-400">
                        {' '}
                        <th className="pb-2 font-medium">Source</th>{' '}
                        <th className="pb-2 font-medium">Condition</th>{' '}
                        <th className="pb-2 font-medium text-right">Changes</th>{' '}
                        <th className="pb-2 font-medium text-right">
                          {' '}
                          Duration{' '}
                        </th>{' '}
                      </tr>{' '}
                    </thead>{' '}
                    <tbody className="divide-y divide-slate-100">
                      {chatteringAlarms.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-4 text-center text-slate-400"
                          >
                            No chattering alarms in range
                          </td>
                        </tr>
                      )}
                      {chatteringAlarms.map((c, i) => (
                        <tr key={i} className="text-slate-700">
                          <td className="py-2 font-medium">{c.sourceName}</td>
                          <td className="py-2 text-slate-500">
                            {c.conditionName}
                          </td>
                          <td className="py-2 text-right">
                            <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                              {c.stateChangeCount}
                            </span>
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {fmtDuration(c.durationSeconds / 60)}
                          </td>
                        </tr>
                      ))}
                    </tbody>{' '}
                  </table>{' '}
                </div>
              ) : (
                <EmptyState />
              )}
            </SectionCard>{' '}
            {/* Bad actors */}
            <SectionCard title="Top bad actors">
              {' '}
              {hasData ? (
                <div className="max-h-[220px] overflow-y-auto">
                  {' '}
                  <table className="w-full text-left text-xs">
                    {' '}
                    <thead className="sticky top-0 bg-white">
                      {' '}
                      <tr className="text-slate-400">
                        {' '}
                        <th className="pb-2 font-medium">Source</th>{' '}
                        <th className="pb-2 font-medium text-right">Count</th>{' '}
                        <th className="pb-2 font-medium text-right">
                          MTTA
                        </th>{' '}
                      </tr>{' '}
                    </thead>{' '}
                    <tbody className="divide-y divide-slate-100">
                      {badActors.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-4 text-center text-slate-400"
                          >
                            No bad actors in range
                          </td>
                        </tr>
                      )}
                      {badActors.map((b, i) => (
                        <tr key={i} className="text-slate-700">
                          <td className="py-2">
                            <p className="font-medium">{b.sourceName}</p>
                            <p className="text-[11px] text-slate-400">
                              {b.conditionName}
                            </p>
                          </td>
                          <td className="py-2 text-right font-medium">
                            {b.alarmCount}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {fmtNum(b.avgMTTA_Minutes, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>{' '}
                  </table>{' '}
                </div>
              ) : (
                <EmptyState />
              )}
            </SectionCard>{' '}
          </div>{' '}
          {/* Standing alarms table */}
          <SectionCard
            title="Standing alarms (> 30 min)"
            action={
              <span className="text-xs text-slate-400">
                {' '}
                {hasData ? `${standingAlarms.length} active` : ''}
              </span>
            }
          >
            {' '}
            {hasData ? (
              <div className="overflow-x-auto">
                {' '}
                <table className="w-full text-left text-sm">
                  {' '}
                  <thead>
                    {' '}
                    <tr className="border-b border-slate-200 text-xs text-slate-400">
                      {' '}
                      <th className="py-2 pr-4 font-medium">Source</th>{' '}
                      <th className="py-2 pr-4 font-medium">Severity</th>{' '}
                      <th className="py-2 pr-4 font-medium">Priority</th>{' '}
                      <th className="py-2 pr-4 font-medium">Active since</th>{' '}
                      <th className="py-2 pr-4 font-medium">Active for</th>{' '}
                      <th className="py-2 pr-4 font-medium">Acked</th>{' '}
                      <th className="py-2 font-medium">Message</th>{' '}
                    </tr>{' '}
                  </thead>{' '}
                  <tbody className="divide-y divide-slate-100">
                    {standingAlarms.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-6 text-center text-slate-400"
                        >
                          No standing alarms in range
                        </td>
                      </tr>
                    )}
                    {standingAlarms.map((a) => {
                      const sev = severityInfo(a.severity);
                      return (
                        <tr key={a.eventID} className="text-slate-700">
                          <td className="py-2.5 pr-4 font-medium">
                            {a.sourceName}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}
                            >
                              {sev.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${priorityBadge(a.priority)}`}
                            >
                              P{a.priority}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">
                            {fmtTime(a.activeSince)}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">
                            {fmtDuration(a.standingMinutes)}
                          </td>
                          <td className="py-2.5 pr-4">
                            {a.acked ? (
                              <CheckCircle2
                                size={16}
                                className="text-emerald-500"
                              />
                            ) : (
                              <XCircle size={16} className="text-red-400" />
                            )}
                          </td>
                          <td className="py-2.5 text-slate-600">{a.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>{' '}
                </table>{' '}
              </div>
            ) : (
              <EmptyState height={200} />
            )}
          </SectionCard>{' '}
        </main>{' '}
      </div>{' '}
    </>
  );
}
