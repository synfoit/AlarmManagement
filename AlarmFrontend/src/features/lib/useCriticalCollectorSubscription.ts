// src/features/lib/useCriticalCollectorSubscription.ts

import { useEffect } from 'react';

import {
  buildCollectorKey,
  criticalAlarmSignalRService,
} from './criticalAlarmSignalRService';

/**
 * Live dashboard ni jem collectorId + collectorName thi critical alerts mate subscribe kare.
 * Subscription app-wide chhe (unmount par unsubscribe nathi thatu), jethi page
 * badlo to pan Header ma critical alerts aavta rahe.
 */
export function useCriticalCollectorSubscription(
  collectorId: number | null,
  collectorName: string
) {
  useEffect(() => {
    if (collectorId === null || !collectorName.trim()) return;

    void criticalAlarmSignalRService.subscribe(
      buildCollectorKey(collectorName, collectorId)
    );
  }, [collectorId, collectorName]);
}
