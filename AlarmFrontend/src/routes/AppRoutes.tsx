// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../app/store';

import Login from '../components/Login';
import Layout from '../components/Layout';
import Home from '../components/Home';

import UserMaster from '../components/UserMaster';
import UserList from '../components/UserList';
import Report from '../components/Report';

import NotFound from '../components/NotFound';
import BlenderMaster from '../components/BlenderMaster';
import BlenderList from '../components/BlenderList';

import BaseOilReport from '../components/reports/BaseOilReport';
import ProductListReport from '../components/reports/ProductListReport';
import RmCodeWiseReport from '../components/reports/RmCodeWiseReport';
import TankWiseReport from '../components/reports/TankWiseReport';
import PiggingReport from '../components/reports/PiggingReport';
import CumulativeFamilyWiseReport from '../components/reports/CumulativeFamilyWiseReport';
import CumulativeBlenderWiseReport from '../components/reports/CumulativeBlenderWiseReport';
import DetailBatchReport from '../components/reports/DetailBatchReport';
import BlenderWiseConsumptionReport from '../components/reports/BlenderWiseConsumptionReport';
import DosingReport from '../components/reports/DosingReport';
import ConnectorSettings from '../components/Connectorsettings';
import AlarmKPIDashboard from '../components/alarmKPIDashboard';
import RationalizationKpiDashboard from '../components/rationalizationKpiDashboard';
import ShiftWiseAlarmSummary from '../components/shiftWiseAlarmSummary';

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
        <Route path="alarm-kpi-dashboard" element={<AlarmKPIDashboard />} />
        <Route
          path="rationalization-kpi-dashboard"
          element={<RationalizationKpiDashboard />}
        />
        <Route
          path="shift-wise-alarm-summary"
          element={<ShiftWiseAlarmSummary />}
        />

        <Route path="manage-user" element={<UserMaster />} />
        <Route path="manage-user/:id" element={<UserMaster />} />
        <Route path="user-list" element={<UserList />} />

        <Route path="manage-blender" element={<BlenderMaster />} />
        <Route path="manage-blender/:id" element={<BlenderMaster />} />
        <Route path="blender-list" element={<BlenderList />} />
        <Route path="connector-settings" element={<ConnectorSettings />} />

        <Route path="report" element={<Report />} />
        <Route path="base-oil-report" element={<BaseOilReport />} />
        <Route path="product-list-report" element={<ProductListReport />} />
        <Route path="dosing-report" element={<DosingReport />} />
        <Route
          path="cumulative-blender-wise-report"
          element={<CumulativeBlenderWiseReport />}
        />
        <Route
          path="cumulative-family-wise-report"
          element={<CumulativeFamilyWiseReport />}
        />
        <Route path="detail-batch-report" element={<DetailBatchReport />} />
        <Route path="pigging-report" element={<PiggingReport />} />
        <Route path="rm-code-wise-report" element={<RmCodeWiseReport />} />
        <Route path="tank-wise-report" element={<TankWiseReport />} />
        <Route
          path="blender-wise-consumption-report"
          element={<BlenderWiseConsumptionReport />}
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
