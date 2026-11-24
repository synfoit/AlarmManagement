// src/pages/criticalTagDashboard.tsx

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  CircleCheck,
  CircleX,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';

import type { RootState } from '../app/store';
import {
  clearCriticalAlarms,
  markAllCriticalRead,
} from '../features/lib/criticalAlarmSlice';
import { criticalAlarmSignalRService } from '../features/lib/criticalAlarmSignalRService';
import { useCriticalCollectorSubscription } from '../features/lib/useCriticalCollectorSubscription';

import type { CriticalConnectionState } from '../features/lib/criticalAlarmModels';

const NEW_ROW_WINDOW_MS = 10_000;

/* ------------------------------------------------------------------ */
/* Formatting */
/* ------------------------------------------------------------------ */

function formatDateTime(value: string | null | undefined): string {
  if (!value || value === '-') return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/* Connection */
/* ------------------------------------------------------------------ */

function getConnectionMeta(state: CriticalConnectionState) {
  switch (state) {
    case 'Connected':
      return {
        label: 'Connected',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dotClass: 'bg-emerald-500',
        icon: Wifi,
      };

    case 'Connecting':
      return {
        label: 'Connecting',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        dotClass: 'bg-amber-500',
        icon: RefreshCw,
      };

    case 'Reconnecting':
      return {
        label: 'Reconnecting',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        dotClass: 'bg-amber-500',
        icon: RefreshCw,
      };

    default:
      return {
        label: 'Disconnected',
        className: 'border-red-200 bg-red-50 text-red-700',
        dotClass: 'bg-red-500',
        icon: WifiOff,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Small components */
/* ------------------------------------------------------------------ */

function BooleanBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700">
        <CircleCheck size={13} />
        Yes
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-600">
        <CircleX size={13} />
        No
      </span>
    );
  }

  return <span className="text-[12px] text-slate-400">-</span>;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'red' | 'amber' | 'slate';
}) {
  const toneClass = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700',
  }[tone];

  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-[24px] font-semibold leading-none ${toneClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main */
/* ------------------------------------------------------------------ */

export default function CriticalTagDashboard() {
  const dispatch = useDispatch();

  // NEW: live dashboard ni jem collector params URL mathi
  const [searchParams] = useSearchParams();

  const collectorIdParam = searchParams.get('collectorId');
  const collectorName = searchParams.get('collectorName') ?? '';

  const parsedCollectorId = Number(collectorIdParam);
  const collectorId =
    collectorIdParam !== null && Number.isFinite(parsedCollectorId)
      ? parsedCollectorId
      : null;

  // "ConnectorRockwellDB_11" jevo key banavi ne hub ma subscribe kare
  useCriticalCollectorSubscription(collectorId, collectorName);

  const { alarms, connectionState, lastUpdatedAt, unreadCount } = useSelector(
    (state: RootState) => state.criticalAlarms
  );

  const [query, setQuery] = useState('');

  // Page khullo hoy tyare aavti navi alerts "read" gani ne header badge clear
  useEffect(() => {
    if (unreadCount > 0) {
      dispatch(markAllCriticalRead());
    }
  }, [unreadCount, dispatch]);

  const connection = getConnectionMeta(connectionState);
  const ConnectionIcon = connection.icon;

  const stats = useMemo(
    () => ({
      total: alarms.length,
      unacked: alarms.filter((a) => a.acked !== true).length,
      active: alarms.filter((a) => a.active === true).length,
      sources: new Set(alarms.map((a) => a.sourceName)).size,
    }),
    [alarms]
  );

  const filteredAlarms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alarms;

    return alarms.filter((a) =>
      [a.sourceName, a.message, a.conditionName, a.serverName].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [alarms, query]);

  const now = Date.now();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      {/* ======================================================== */}
      {/* PAGE HEADER */}
      {/* ======================================================== */}

      <header className="shrink-0 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-4">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <Siren size={20} className="text-red-600" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-semibold leading-tight text-slate-800">
                Critical Alarm Dashboard
              </h1>

              <p className="mt-0.5 text-[12px] text-slate-400">
                {collectorName
                  ? `Real-time critical alerts - ${collectorName}`
                  : 'Real-time critical alerts from the notification hub'}
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-2">
            {lastUpdatedAt && (
              <div className="hidden xl:block">
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Last Alert
                  </p>

                  <p className="mt-0.5 text-[12px] font-medium text-slate-600">
                    {formatDateTime(lastUpdatedAt)}
                  </p>
                </div>
              </div>
            )}

            <div
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[11px] font-semibold ${connection.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${connection.dotClass}`} />

              <ConnectionIcon
                size={14}
                className={
                  connectionState === 'Connecting' ||
                  connectionState === 'Reconnecting'
                    ? 'animate-spin'
                    : ''
                }
              />

              <span>{connection.label}</span>
            </div>

            {connectionState === 'Disconnected' && (
              <button
                type="button"
                onClick={() => void criticalAlarmSignalRService.connect()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={14} />
                Connect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* SUMMARY */}
      {/* ======================================================== */}

      <div className="mt-3 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total Critical" value={stats.total} tone="red" />
        <SummaryCard
          label="Unacknowledged"
          value={stats.unacked}
          tone="amber"
        />
        <SummaryCard label="Active" value={stats.active} tone="red" />
        <SummaryCard
          label="Sources Affected"
          value={stats.sources}
          tone="slate"
        />
      </div>

      {/* ======================================================== */}
      {/* CONNECTION MESSAGE */}
      {/* ======================================================== */}

      {connectionState === 'Disconnected' && (
        <div className="mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          Critical alert connection is disconnected. You may miss new alerts
          until it reconnects.
        </div>
      )}

      {connectionState === 'Reconnecting' && (
        <div className="mt-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
          Connection lost. Reconnecting automatically...
        </div>
      )}

      {/* ======================================================== */}
      {/* CRITICAL ALARM PANEL */}
      {/* ======================================================== */}

      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search source, message, condition..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={() => dispatch(clearCriticalAlarms())}
            disabled={alarms.length === 0}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="sticky top-0 w-[56px] whitespace-nowrap bg-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  #
                </th>
                <th className="sticky top-0 min-w-[200px] whitespace-nowrap bg-slate-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Event Timestamp
                </th>
                <th className="sticky top-0 min-w-[200px] whitespace-nowrap bg-slate-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Source Name
                </th>
                <th className="sticky top-0 min-w-[200px] whitespace-nowrap bg-slate-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Condition
                </th>
                <th className="sticky top-0 w-[340px] bg-slate-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Message
                </th>
                <th className="sticky top-0 w-[100px] bg-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Active
                </th>
                <th className="sticky top-0 w-[100px] bg-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Acked
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          alarms.length === 0 ? 'bg-emerald-50' : 'bg-slate-100'
                        }`}
                      >
                        {alarms.length === 0 ? (
                          <ShieldCheck size={22} className="text-emerald-500" />
                        ) : (
                          <Search size={22} className="text-slate-400" />
                        )}
                      </div>

                      <p className="mt-3 text-[14px] font-semibold text-slate-600">
                        {alarms.length === 0
                          ? 'No critical alarms'
                          : 'No matching alarms'}
                      </p>

                      <p className="mt-1 text-[12px] text-slate-400">
                        {alarms.length === 0
                          ? 'All clear. New critical alerts will appear here instantly.'
                          : 'Try a different search term.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((alarm, index) => {
                  const isNew =
                    now - Date.parse(alarm.receivedAt) < NEW_ROW_WINDOW_MS;

                  return (
                    <tr
                      key={alarm.id}
                      className={`group border-b border-slate-100 transition-colors hover:bg-red-50/60 ${
                        isNew ? 'critical-row-new' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      {/* # */}
                      <td className="whitespace-nowrap border-l-4 border-l-red-500 px-3 py-2.5 text-center text-[12px] font-medium text-slate-400">
                        {index + 1}
                      </td>

                      {/* Event Time */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-slate-500">
                        {formatDateTime(alarm.eventTimestamp)}
                      </td>

                      {/* Source */}
                      <td
                        className="max-w-[220px] px-3 py-2.5 text-[12px] font-semibold text-red-800"
                        title={alarm.sourceName}
                      >
                        <div className="truncate">{alarm.sourceName}</div>
                      </td>

                      {/* Condition */}
                      <td
                        className="max-w-[220px] px-3 py-2.5 text-[12px] text-slate-600"
                        title={alarm.conditionName}
                      >
                        <div className="truncate">{alarm.conditionName}</div>
                      </td>

                      {/* Message */}
                      <td
                        className="max-w-[340px] px-3 py-2.5 text-[12px] font-medium text-red-700"
                        title={alarm.message}
                      >
                        <div className="truncate">{alarm.message}</div>
                      </td>

                      {/* Active */}
                      <td className="px-3 py-2.5 text-center">
                        <BooleanBadge value={alarm.active} />
                      </td>

                      {/* Acked */}
                      <td className="px-3 py-2.5 text-center">
                        <BooleanBadge value={alarm.acked} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connection.dotClass}`} />

            <span className="text-[11px] font-medium text-slate-500">
              Live critical alerts via SignalR
            </span>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            {filteredAlarms.length.toLocaleString()} of{' '}
            {alarms.length.toLocaleString()} records
          </span>
        </div>
      </section>
    </div>
  );
}
