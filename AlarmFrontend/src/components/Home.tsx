// src/pages/summary.tsx

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import {
  Activity,
  AlertTriangle,
  BellRing,
  BellOff,
  Gauge,
  RefreshCw,
  Server,
  ArrowUpRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Routes - tamara router pramane path change kari lejo */
/* ------------------------------------------------------------------ */

const LIVE_PATH = '/live-dashboard';
const KPI_PATH = '/alarm-kpi-dashboard';

/* ------------------------------------------------------------------ */
/* Static data - pachi API thi replace karvanu */
/* ------------------------------------------------------------------ */

type CollectorStatus = 'Online' | 'Offline' | 'Degraded';

interface Collector {
  id: number;
  name: string;
  status: CollectorStatus;
  activeAlarms: number;
  unacked: number;
  lastUpdate: string;
}

const COLLECTORS: Collector[] = [
  {
    id: 1,
    name: 'Plant A - Boiler DCS',
    status: 'Online',
    activeAlarms: 14,
    unacked: 4,
    lastUpdate: '2 sec ago',
  },
  {
    id: 2,
    name: 'Plant A - Turbine',
    status: 'Online',
    activeAlarms: 6,
    unacked: 1,
    lastUpdate: '3 sec ago',
  },
  {
    id: 3,
    name: 'Plant B - Compressor',
    status: 'Degraded',
    activeAlarms: 21,
    unacked: 9,
    lastUpdate: '48 sec ago',
  },
  {
    id: 4,
    name: 'Plant B - Utilities',
    status: 'Online',
    activeAlarms: 3,
    unacked: 0,
    lastUpdate: '1 sec ago',
  },
  {
    id: 5,
    name: 'Tank Farm',
    status: 'Offline',
    activeAlarms: 0,
    unacked: 0,
    lastUpdate: '12 min ago',
  },
];

const HEALTH_SCORE = 82;

const ALARMS_PER_HOUR = [
  12, 9, 7, 6, 8, 11, 18, 26, 34, 29, 22, 19, 24, 31, 27, 21, 18, 23, 28, 20,
  15, 13, 10, 8,
];

const PRIORITY = [
  { key: 'Critical', value: 8, color: '#DC2626' },
  { key: 'High', value: 22, color: '#F97316' },
  { key: 'Medium', value: 41, color: '#F59E0B' },
  { key: 'Low', value: 29, color: '#10B981' },
];

const BAD_ACTORS = [
  { name: 'FIC-1012.PV_HI', count: 86 },
  { name: 'TIC-2204.DEV', count: 64 },
  { name: 'LIC-3301.PV_LO', count: 51 },
  { name: 'PIC-1105.PV_HI', count: 39 },
  { name: 'FIC-1020.BAD_PV', count: 27 },
];

const RECENT_ALARMS = [
  {
    time: '14:32:08',
    source: 'PIC-1105.PV_HI',
    message: 'Pressure high',
    priority: 1,
  },
  {
    time: '14:31:47',
    source: 'TIC-2204.DEV',
    message: 'Temperature deviation',
    priority: 2,
  },
  {
    time: '14:29:12',
    source: 'LIC-3301.PV_LO',
    message: 'Level low',
    priority: 2,
  },
  {
    time: '14:26:55',
    source: 'FIC-1012.PV_HI',
    message: 'Flow high',
    priority: 3,
  },
  {
    time: '14:21:30',
    source: 'XV-4410.FAIL',
    message: 'Valve feedback fail',
    priority: 3,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function statusClasses(status: CollectorStatus) {
  if (status === 'Online')
    return {
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    };
  if (status === 'Degraded')
    return {
      pill: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    };
  return { pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
}

function priorityClass(p: number) {
  if (p === 1) return 'border-red-200 bg-red-50 text-red-700';
  if (p === 2) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (p === 3) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function healthMeta(score: number) {
  if (score >= 80)
    return { label: 'Healthy', color: '#10B981', text: 'text-emerald-600' };
  if (score >= 60)
    return {
      label: 'Needs attention',
      color: '#F59E0B',
      text: 'text-amber-600',
    };
  return { label: 'Critical', color: '#DC2626', text: 'text-red-600' };
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-700">{title}</h2>
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

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3.5 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <p className="text-[26px] font-bold leading-tight text-slate-800">
          {value}
        </p>
        <p className="truncate text-[11px] text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main */
/* ------------------------------------------------------------------ */

export default function Summary() {
  const navigate = useNavigate();

  const totals = useMemo(() => {
    const online = COLLECTORS.filter((c) => c.status !== 'Offline').length;
    const active = COLLECTORS.reduce((s, c) => s + c.activeAlarms, 0);
    const unacked = COLLECTORS.reduce((s, c) => s + c.unacked, 0);
    const today = ALARMS_PER_HOUR.reduce((s, n) => s + n, 0);
    return { online, active, unacked, today };
  }, []);

  const health = healthMeta(HEALTH_SCORE);

  const openDashboard = (path: string, c: Collector) =>
    navigate(
      `${path}?collectorId=${c.id}&collectorName=${encodeURIComponent(c.name)}`
    );

  /* ---------------- Charts ---------------- */

  const gaugeOptions: ApexOptions = {
    chart: {
      type: 'radialBar',
      fontFamily: 'inherit',
      sparkline: { enabled: true },
    },
    colors: [health.color],
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: '68%' },
        track: { background: '#E2E8F0', strokeWidth: '100%' },
        dataLabels: {
          name: { show: true, offsetY: 24, color: '#94A3B8', fontSize: '13px' },
          value: {
            offsetY: -14,
            fontSize: '38px',
            fontWeight: 700,
            color: '#1E293B',
            formatter: (v: number) => `${v}%`,
          },
        },
      },
    },
    stroke: { lineCap: 'round' },
    labels: [health.label],
  };

  const hourlyOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'inherit',
      zoom: { enabled: false },
    },
    colors: ['#2563EB'],
    stroke: { curve: 'smooth', width: 2.5 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    grid: { borderColor: '#E2E8F0', strokeDashArray: 3 },
    xaxis: {
      categories: ALARMS_PER_HOUR.map(
        (_, i) => `${String(i).padStart(2, '0')}:00`
      ),
      tickAmount: 8,
      labels: { rotate: 0, style: { colors: '#94A3B8', fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      labels: {
        style: { colors: '#94A3B8', fontSize: '12px' },
        formatter: (v: number) => Math.round(v).toString(),
      },
    },
    tooltip: { theme: 'light', y: { formatter: (v: number) => `${v} alarms` } },
  };

  const priorityOptions: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'inherit' },
    labels: PRIORITY.map((p) => p.key),
    colors: PRIORITY.map((p) => p.color),
    dataLabels: { enabled: false },
    legend: { show: false },
    stroke: { width: 2, colors: ['#fff'] },
    plotOptions: {
      pie: {
        donut: {
          size: '66%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Active',
              color: '#94A3B8',
              fontSize: '13px',
              formatter: () => String(totals.active),
            },
            value: { fontSize: '26px', fontWeight: 700, color: '#1E293B' },
          },
        },
      },
    },
    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' } },
    },
    tooltip: { theme: 'light', y: { formatter: (v: number) => `${v}%` } },
  };

  const maxActor = Math.max(...BAD_ACTORS.map((a) => a.count));

  /* ---------------- UI ---------------- */

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      {/* HEADER */}
      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-700">Summary</h1>
          <p className="text-[12px] text-slate-400">
            Plant-wide alarm overview across all collectors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium text-slate-400">
              Last updated
            </p>
            <p className="text-[12px] font-medium text-slate-600">Just now</p>
          </div>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded bg-sky-600 px-3 text-[14px] font-medium text-white transition hover:bg-sky-700"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {/* HERO: health gauge + stat tiles */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-10"
              style={{ background: health.color }}
            />
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-700">
                Alarm system health
              </h2>
              <Gauge size={18} className="text-slate-300" />
            </div>

            <Chart
              options={gaugeOptions}
              series={[HEALTH_SCORE]}
              type="radialBar"
              height={230}
            />

            <p className="-mt-4 text-center text-[12px] text-slate-500">
              <span className={`font-semibold ${health.text}`}>
                {health.label}
              </span>{' '}
              · based on ISA 18.2 KPIs for today
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-2">
            <StatTile
              label="Collectors online"
              value={`${totals.online}/${COLLECTORS.length}`}
              hint="1 collector offline"
              icon={Server}
              iconClass="bg-sky-50 text-sky-600"
            />
            <StatTile
              label="Active alarms"
              value={totals.active}
              hint="Across all collectors"
              icon={BellRing}
              iconClass="bg-red-50 text-red-600"
            />
            <StatTile
              label="Unacknowledged"
              value={totals.unacked}
              hint="Waiting for operator"
              icon={BellOff}
              iconClass="bg-amber-50 text-amber-600"
            />
            <StatTile
              label="Alarms today"
              value={totals.today}
              hint="Since 00:00"
              icon={Activity}
              iconClass="bg-emerald-50 text-emerald-600"
            />
          </div>
        </div>

        {/* ROW: trend + priority */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <SectionCard
            title="Alarms per hour"
            subtitle="Today, all collectors"
            className="lg:col-span-2"
          >
            <Chart
              options={hourlyOptions}
              series={[{ name: 'Alarms', data: ALARMS_PER_HOUR }]}
              type="area"
              height={250}
            />
          </SectionCard>

          <SectionCard
            title="Priority distribution"
            subtitle="Share of active alarms"
          >
            <Chart
              options={priorityOptions}
              series={PRIORITY.map((p) => p.value)}
              type="donut"
              height={190}
            />
            <div className="mt-2 space-y-1.5">
              {PRIORITY.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    {p.key}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {p.value}%
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ROW: collectors table */}
        <SectionCard
          title="Collectors"
          subtitle="Open live alarms or KPIs for a collector"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="py-2 pr-2 font-medium">Collector</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 pr-2 text-center font-medium">Active</th>
                  <th className="py-2 pr-2 text-center font-medium">Unacked</th>
                  <th className="py-2 pr-2 font-medium">Last update</th>
                  <th className="py-2 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COLLECTORS.map((c) => {
                  const s = statusClasses(c.status);
                  return (
                    <tr
                      key={c.id}
                      className="text-slate-700 transition hover:bg-slate-50/70"
                    >
                      <td className="py-2.5 pr-2 font-medium">{c.name}</td>
                      <td className="py-2.5 pr-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                          />
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-center font-semibold">
                        {c.activeAlarms}
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        <span
                          className={
                            c.unacked > 0
                              ? 'font-semibold text-amber-600'
                              : 'text-slate-400'
                          }
                        >
                          {c.unacked}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-500">
                        {c.lastUpdate}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDashboard(LIVE_PATH, c)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Live <ArrowUpRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDashboard(KPI_PATH, c)}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-sky-600 px-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-700"
                          >
                            KPI <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ROW: bad actors + recent alarms */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <SectionCard
            title="Top bad actors"
            subtitle="Most frequent alarms today"
          >
            <div className="space-y-3">
              {BAD_ACTORS.map((a) => (
                <div key={a.name}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="truncate font-medium text-slate-700">
                      {a.name}
                    </span>
                    <span className="font-semibold text-slate-600">
                      {a.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${(a.count / maxActor) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent alarms"
            subtitle="Latest events"
            action={
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <AlertTriangle size={13} /> Sample data
              </span>
            }
          >
            <ul className="divide-y divide-slate-100">
              {RECENT_ALARMS.map((a, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`inline-flex min-w-[30px] items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${priorityClass(a.priority)}`}
                  >
                    {a.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-700">
                      {a.source}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">
                      {a.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-slate-400">
                    {a.time}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
