// src/features/lib/criticalAlarmModels.ts

export type CriticalConnectionState =
  | 'Connected'
  | 'Connecting'
  | 'Reconnecting'
  | 'Disconnected';

/**
 * Backend (notificationHub -> "CriticalAlarm")thi je alarm aave chhe,
 * ene UI mate normalize kari ne aa shape ma store karvama aave chhe.
 */
export interface CriticalAlarm {
  id: string;
  receivedAt: string;
  sourceTable: string;
  eventId: string;
  sourceName: string;
  message: string;
  conditionName: string;
  serverName: string;
  eventTimestamp: string;
  priority: string | null;
  active: boolean | null;
  acked: boolean | null;

  collectorId: number | string | null;
  collectorName: string | null;
}
