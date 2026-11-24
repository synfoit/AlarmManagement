// src/features/lib/useCriticalAlarmSubscription.ts

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { criticalAlarmSignalRService } from './criticalAlarmSignalRService';
import {
  criticalAlarmsReceived,
  criticalConnectionStateChanged,
} from './criticalAlarmSlice';

import type { CriticalAlarm } from './criticalAlarmModels';

/* ------------------------------------------------------------------ */
/* Payload normalization (key names case-insensitive) */
/* ------------------------------------------------------------------ */

let sequence = 0;

function toNullableText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map<string, unknown>();

  for (const [k, v] of Object.entries(obj)) {
    lower.set(k.toLowerCase(), v);
  }

  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (value !== undefined && value !== null) return value;
  }

  return undefined;
}

function toText(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return '-';
}

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return value === 1;

  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }

  return null;
}

function normalize(raw: unknown): CriticalAlarm | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  sequence += 1;

  const priority = pick(data, ['priority', 'priorityName']);

  const sourceTable = toText(pick(data, ['sourceTable']));
  const eventId = toText(pick(data, ['eventId', 'eventID']));
  const notificationId = toText(pick(data, ['id']));

  /*
   * Dedupe key: notification Id (har notification row unique), na hoy to eventId.
   * (EventID ek j alarm na alag state-updates ma repeat thai shake, etle pehla Id.)
   */
  const uniquePart =
    notificationId !== '-'
      ? notificationId
      : eventId !== '-'
        ? eventId
        : `${Date.now()}-${sequence}`;

  return {
    id: `${sourceTable}-${uniquePart}`,
    receivedAt: new Date().toISOString(),
    sourceTable,
    eventId,
    sourceName: toText(pick(data, ['sourceName'])),
    message: toText(pick(data, ['message'])),
    conditionName: toText(pick(data, ['conditionName'])),
    serverName: toText(pick(data, ['serverName'])),
    eventTimestamp: toText(pick(data, ['eventTimeStamp', 'eventTimestamp'])),
    priority:
      typeof priority === 'string' || typeof priority === 'number'
        ? String(priority)
        : null,
    active: toBool(pick(data, ['active'])),
    acked: toBool(pick(data, ['acked'])),

    // navi
    collectorId: toNullableText(pick(data, ['collectorId', 'collectorID'])),
    collectorName: toNullableText(pick(data, ['collectorName'])),
  };
}

/* ------------------------------------------------------------------ */
/* Hook */
/* ------------------------------------------------------------------ */

/**
 * App ma FAKT EK J JAGYAE call karvo (Header ma). Header login pachhi
 * hamesha mounted hoy chhe, etle badha pages ma alerts male chhe.
 */
export function useCriticalAlarmSubscription() {
  const dispatch = useDispatch();

  useEffect(() => {
    void criticalAlarmSignalRService.start({
      onAlarm: (payload) => {
        // Raw payload exactly as received from the hub
        // console.log('[Critical] raw payload:', payload);

        const list = Array.isArray(payload) ? payload : [payload];

        const alarms = list
          .map(normalize)
          .filter((alarm): alarm is CriticalAlarm => alarm !== null);

        if (alarms.length > 0) {
          dispatch(criticalAlarmsReceived(alarms));
        }
      },
      onStateChange: (state) => {
        dispatch(criticalConnectionStateChanged(state));
      },
    });

    return () => {
      void criticalAlarmSignalRService.stop();
    };
  }, [dispatch]);
}
