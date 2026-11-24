import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import uiReducer from '../features/ui/uiSlice';
import criticalAlarmReducer from '../features/lib/criticalAlarmSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    criticalAlarms: criticalAlarmReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
