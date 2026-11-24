// src/pages/liveDashboard.tsx

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  CircleCheck,
  CircleX,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { alarmSignalRService } from '../features/lib/alarmSignalRService';
import { useAlarmSignalR } from '../features/lib/useAlarmSignalR';

import type { AlarmEvent } from '../features/interfaces/alarmModels';

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function getStringValue(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '-';
}

function getBooleanValue(
  obj: Record<string, unknown>,
  keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = obj[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Alarm field helpers */
/* ------------------------------------------------------------------ */

function getSourceName(alarm: AlarmEvent): string {
  return getStringValue(alarm as Record<string, unknown>, [
    'SourceName',
    'sourceName',
  ]);
}

function getEventTimestamp(alarm: AlarmEvent): string {
  return getStringValue(alarm as Record<string, unknown>, [
    'EventTimeStamp',
    'eventTimeStamp',
    'eventTimestamp',
  ]);
}

function getPriority(alarm: AlarmEvent): string | null {
  const value = getValueCI(alarm as Record<string, unknown>, [
    'priority',
    'priorityName',
  ]);

  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();

  return null;
}

function getPriorityClass(priority: string | null): string {
  if (!priority) return 'border-slate-200 bg-slate-50 text-slate-500';

  switch (priority.toLowerCase()) {
    case '1':
    case 'critical':
    case 'urgent':
      return 'border-red-200 bg-red-50 text-red-700';
    case '2':
    case 'high':
    case 'major':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case '3':
    case 'medium':
    case 'warning':
    case 'minor':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case '4':
    case 'low':
    case 'info':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

/**
 * Object ma key shodhva mate (case-insensitive).
 * "isCritical", "IsCritical", "iscritical" - badhu chale.
 */
function getValueCI(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();

  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(k.toLowerCase(), v);
  }

  for (const key of keys) {
    const v = lowerMap.get(key.toLowerCase());

    if (v !== undefined && v !== null) {
      return v;
    }
  }

  return undefined;
}

/**
 * Row critical tyare j gane jyare isCritical true ya 1 hoy.
 * Priority upar koi depend nathi.
 */
function isCriticalAlarm(alarm: AlarmEvent): boolean {
  const flag = getValueCI(alarm as Record<string, unknown>, [
    'isCritical',
    'critical',
  ]);

  if (flag === true || flag === 1) return true;

  if (typeof flag === 'string') {
    const f = flag.trim().toLowerCase();
    return f === 'true' || f === '1';
  }

  return false;
}

function getMessage(alarm: AlarmEvent): string {
  return getStringValue(alarm as Record<string, unknown>, [
    'Message',
    'message',
  ]);
}

function getActive(alarm: AlarmEvent): boolean | null {
  return getBooleanValue(alarm as Record<string, unknown>, [
    'Active',
    'active',
  ]);
}

function getAcked(alarm: AlarmEvent): boolean | null {
  return getBooleanValue(alarm as Record<string, unknown>, ['Acked', 'acked']);
}

/* ------------------------------------------------------------------ */
/* Formatting */
/* ------------------------------------------------------------------ */

function formatDateTime(value: string | null | undefined): string {
  if (!value || value === '-') {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

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

function getConnectionMeta(state: string) {
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
/* Boolean Badge */
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

/* ------------------------------------------------------------------ */
/* Main */
/* ------------------------------------------------------------------ */

export default function LiveDashboard() {
  const [searchParams] = useSearchParams();

  const collectorIdParam = searchParams.get('collectorId');
  const collectorName = searchParams.get('collectorName') ?? '';

  const parsedCollectorId = Number(collectorIdParam);
  const collectorId =
    collectorIdParam !== null && Number.isFinite(parsedCollectorId)
      ? parsedCollectorId
      : null;

  const { alarms, connectionState, lastUpdatedAt } = useAlarmSignalR({
    collectorId,
    collectorName,
  });

  const connection = getConnectionMeta(connectionState);

  const ConnectionIcon = connection.icon;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      {/* ======================================================== */}
      {/* PAGE HEADER */}
      {/* ======================================================== */}

      <header className="shrink-0 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center justify-between gap-4">
          {/* Left */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <h1 className="truncate text-[18px] font-semibold leading-tight text-slate-800">
                  Live Alarm Dashboard
                </h1>

                <p className="mt-0.5 text-[12px] text-slate-400">
                  {collectorName
                    ? `Real-time alarm monitoring - ${collectorName}`
                    : 'Real-time alarm monitoring'}
                </p>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-2">
            {lastUpdatedAt && (
              <div className="hidden xl:block">
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Last Update
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

            {connectionState !== 'Connected' && (
              <button
                type="button"
                onClick={() => void alarmSignalRService.connect()}
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
      {/* CONNECTION MESSAGE */}
      {/* ======================================================== */}

      {connectionState === 'Disconnected' && (
        <div className="mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          SignalR connection is disconnected. Waiting for connection...
        </div>
      )}

      {connectionState === 'Reconnecting' && (
        <div className="mt-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
          SignalR connection lost. Reconnecting automatically...
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE ALARM PANEL */}
      {/* ======================================================== */}

      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            {/* ================================================== */}
            {/* FIXED / STICKY TABLE HEADER */}
            {/* ================================================== */}

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

                <th className="sticky top-0 w-[110px] whitespace-nowrap bg-slate-100 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Priority
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

            {/* ==================================================== */}
            {/* TABLE BODY */}
            {/* ==================================================== */}

            <tbody>
              {alarms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Bell size={22} className="text-slate-400" />
                      </div>

                      <p className="mt-3 text-[14px] font-semibold text-slate-500">
                        No alarm events available
                      </p>

                      <p className="mt-1 text-[12px] text-slate-400">
                        Waiting for live alarm updates...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                alarms.map((alarm, index) => {
                  const eventTimestamp = getEventTimestamp(alarm);
                  const sourceName = getSourceName(alarm);
                  const priority = getPriority(alarm);
                  const message = getMessage(alarm);
                  const active = getActive(alarm);
                  const acked = getAcked(alarm);

                  const isCritical = isCriticalAlarm(alarm);

                  // Critical + not yet acknowledged => blink.
                  // Blink hamesha rakhvu hoy to: const shouldBlink = isCritical;
                  const shouldBlink = isCritical && acked !== true;

                  return (
                    <tr
                      key={`${sourceName}-${eventTimestamp}-${index}`}
                      className={`group border-b transition-colors ${
                        isCritical
                          ? `${
                              shouldBlink ? 'critical-row-blink' : ''
                            } border-red-200 bg-red-50 hover:bg-red-100`
                          : `border-slate-100 hover:bg-sky-50/50 ${
                              index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                            }`
                      }`}
                    >
                      {/* # */}
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-medium ${
                          isCritical ? 'text-red-700' : 'text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </td>

                      {/* Event Time */}
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-[12px] ${
                          isCritical ? 'text-red-700' : 'text-slate-500'
                        }`}
                      >
                        {formatDateTime(eventTimestamp)}
                      </td>

                      {/* Source */}
                      <td
                        className={`max-w-[220px] px-3 py-2.5 text-[12px] font-semibold ${
                          isCritical ? 'text-red-800' : 'text-slate-700'
                        }`}
                        title={sourceName}
                      >
                        <div className="truncate">{sourceName}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2.5 text-center">
                        {priority === null ? (
                          <span className="text-[12px] text-slate-400">-</span>
                        ) : (
                          <span
                            className={`inline-flex min-w-[30px] items-center justify-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${getPriorityClass(priority)}`}
                          >
                            {priority}
                          </span>
                        )}
                      </td>

                      {/* Message */}
                      <td
                        className={`max-w-[340px] px-3 py-2.5 text-[12px] ${
                          isCritical
                            ? 'font-medium text-red-700'
                            : 'text-slate-600'
                        }`}
                        title={message}
                      >
                        <div className="truncate">{message}</div>
                      </td>

                      {/* Active */}
                      <td className="px-3 py-2.5 text-center">
                        <BooleanBadge value={active} />
                      </td>

                      {/* Acked */}
                      <td className="px-3 py-2.5 text-center">
                        <BooleanBadge value={acked} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ====================================================== */}
        {/* TABLE FOOTER */}
        {/* ====================================================== */}

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="text-[11px] font-medium text-slate-500">
              Live data via SignalR
            </span>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            {alarms.length.toLocaleString()} records
          </span>
        </div>
      </section>
    </div>
  );
}
