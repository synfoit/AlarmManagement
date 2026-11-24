// src/features/lib/useAlarmSignalR.ts

import { useEffect, useSyncExternalStore } from 'react';

import { alarmSignalRService } from './alarmSignalRService';

export interface UseAlarmSignalROptions {
  collectorId: number | null;
  collectorName: string;
}

export function useAlarmSignalR(options?: UseAlarmSignalROptions) {
  const snapshot = useSyncExternalStore(
    alarmSignalRService.subscribe,
    alarmSignalRService.getSnapshot,
    alarmSignalRService.getServerSnapshot
  );

  const collectorId = options?.collectorId ?? null;
  const collectorName = options?.collectorName ?? '';

  useEffect(() => {
    void alarmSignalRService.connect({ collectorId, collectorName });

    /*
     * Connection app-wide singleton chhe, unmount par disconnect nathi thatu.
     * Collector badlay to service pote Unsubscribe + Subscribe kare chhe.
     */
  }, [collectorId, collectorName]);

  return snapshot;
}
