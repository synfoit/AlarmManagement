// src/features/lib/criticalAlarmSlice.ts

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type {
  CriticalAlarm,
  CriticalConnectionState,
} from './criticalAlarmModels';

/** Memory control: aatla thi vadhare alarms store ma nahi rakhiye. */
const MAX_ALARMS = 500;

interface CriticalAlarmState {
  /** Newest first */
  alarms: CriticalAlarm[];
  /** Header badge mate: haju user e joya nathi evA alarms */
  unreadCount: number;
  connectionState: CriticalConnectionState;
  lastUpdatedAt: string | null;
}

const initialState: CriticalAlarmState = {
  alarms: [],
  unreadCount: 0,
  connectionState: 'Disconnected',
  lastUpdatedAt: null,
};

const criticalAlarmSlice = createSlice({
  name: 'criticalAlarms',
  initialState,
  reducers: {
    criticalAlarmsReceived(state, action: PayloadAction<CriticalAlarm[]>) {
      // Duplicate (same sourceTable + id) skip - toastId jevu j
      const seen = new Set(state.alarms.map((a) => a.id));
      const fresh = action.payload.filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });

      if (fresh.length === 0) return;

      // payload chronological hoy to reverse karine newest-first rakhiye
      const incoming = [...fresh].reverse();

      state.alarms = [...incoming, ...state.alarms].slice(0, MAX_ALARMS);
      state.unreadCount += fresh.length;
      state.lastUpdatedAt = new Date().toISOString();
    },

    criticalConnectionStateChanged(
      state,
      action: PayloadAction<CriticalConnectionState>
    ) {
      state.connectionState = action.payload;
    },

    markAllCriticalRead(state) {
      state.unreadCount = 0;
    },

    clearCriticalAlarms(state) {
      state.alarms = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  criticalAlarmsReceived,
  criticalConnectionStateChanged,
  markAllCriticalRead,
  clearCriticalAlarms,
} = criticalAlarmSlice.actions;

export default criticalAlarmSlice.reducer;
