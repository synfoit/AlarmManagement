// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../app/store';

import Login from '../components/Login';
import Layout from '../components/Layout';
import Home from '../components/Home';

import UserMaster from '../components/UserMaster';
import UserList from '../components/UserList';
import NotFound from '../components/NotFound';

import ConnectorSettings from '../components/Connectorsettings';
import AlarmKPIDashboard from '../components/alarmKPIDashboard';
import RationalizationKpiDashboard from '../components/rationalizationKpiDashboard';
import ShiftWiseAlarmSummary from '../components/shiftWiseAlarmSummary';
import ReportsPage from '../components/ReportsPage';
import PlantMaster from '../components/PlantMaster';
import AreaMaster from '../components/AreaMAster';
import ConsoleMaster from '../components/ConsoleMaster';
import SourceMaster from '../components/SourceMaster';
import EmailConfiguration from '../components/EmailConfiguration';
import LiveDashboard from '../components/liveDashboard';

import ConnectionList from '../components/ConnectionList';
import ParsingConfig from '../components/ParsingConfig';
import LookUpMaster from '../components/LookUpMaster';
import CriticalTagConfigMaster from '../components/CriticalTagConfigMaster';
import CriticalTagDashboard from '../components/CriticalTagDashboard';

export default function AppRoutes() {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  return (
    <Routes>
      {/* Public login route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
      />

      {/* Protected routes under shared layout */}
      <Route
        path="/"
        element={
          isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="live-dashboard" element={<LiveDashboard />} />
        <Route path="alarm-kpi-dashboard" element={<AlarmKPIDashboard />} />
        <Route
          path="rationalization-kpi-dashboard"
          element={<RationalizationKpiDashboard />}
        />
        <Route
          path="shift-wise-alarm-summary"
          element={<ShiftWiseAlarmSummary />}
        />
        <Route
          path="critical-tag-dashboard"
          element={<CriticalTagDashboard />}
        />

        <Route path="manage-user" element={<UserMaster />} />
        <Route path="manage-user/:id" element={<UserMaster />} />
        <Route path="user-list" element={<UserList />} />

        <Route path="reports" element={<ReportsPage />} />
        <Route path="connection-setting" element={<ConnectorSettings />} />
        <Route path="connection-setting/:id" element={<ConnectorSettings />} />
        <Route path="connection-list" element={<ConnectionList />} />
        <Route path="parsing-config" element={<ParsingConfig />} />
        <Route path="email-configuration" element={<EmailConfiguration />} />
        <Route path="plant" element={<PlantMaster />} />
        <Route path="area" element={<AreaMaster />} />
        <Route path="console" element={<ConsoleMaster />} />
        <Route path="source" element={<SourceMaster />} />
        <Route path="lookup" element={<LookUpMaster />} />
        <Route
          path="critical-tags-config"
          element={<CriticalTagConfigMaster />}
        />

        {/* <Route path="*" element={<Navigate to="home" replace />} /> */}

        {/* Show NotFound inside layout if path doesn't match */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Fallback: anything else goes to login */}
      <Route path="*" element={<NotFound />} />
      {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
    </Routes>
  );
}
