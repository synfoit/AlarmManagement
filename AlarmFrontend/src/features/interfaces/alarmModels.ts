// src/features/interfaces/alarmModels.ts

export interface AlarmEvent {
  SourceName?: string | null;
  ServerName?: string | null;
  EventTimeStamp?: string | null;
  Priority?: number | null;
  Message?: string | null;
  ConditionName?: string | null;
  AlarmClass?: string | null;
  Active?: boolean;
  Acked?: boolean;

  Tag1Value?: string | null;
  Tag2Value?: string | null;
  Tag3Value?: string | null;
  Tag4Value?: string | null;

  /*
   * Keeping lowercase aliases also makes the UI tolerant
   * if the backend serializer is configured differently.
   */
  sourceName?: string | null;
  serverName?: string | null;
  eventTimeStamp?: string | null;
  priority?: number | string | null;
  message?: string | null;
  conditionName?: string | null;
  alarmClass?: string | null;
  active?: boolean;
  acked?: boolean;

  tag1Value?: string | null;
  tag2Value?: string | null;
  tag3Value?: string | null;
  tag4Value?: string | null;

  [key: string]: unknown;
}

export interface AlarmSummary {
  ActiveCount?: number;
  UnackedCount?: number;
  CriticalPriorityCount?: number;
  TotalCount?: number;

  /*
   * Lowercase aliases
   */
  activeCount?: number;
  unackedCount?: number;
  criticalPriorityCount?: number;
  totalCount?: number;

  [key: string]: unknown;
}

export type AlarmConnectionState =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting';

export interface AlarmSignalRSnapshot {
  alarms: AlarmEvent[];
  summary: AlarmSummary | null;
  connectionState: AlarmConnectionState;
  lastUpdatedAt: string | null;
}
