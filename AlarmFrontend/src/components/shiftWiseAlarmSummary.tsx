import React, { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { createCrudApi } from '../features/lib/createCrudApi';

/* ========================================================= TYPES ========================================================= */ interface ShiftSummary {
  shiftNo: number;
  shiftName: string;
  alarmCount: number;
  alarmFloodCount: number;
  alarmsInsideFlood: number;
  highPriorityAlarmCount: number;
  standingAlarmCount: number;
}
interface PrioritySummary {
  priority: number;
  alarmCount: number;
}
interface FloodDetail {
  shiftNo: number;
  floodStartTime: string;
  floodEndTime: string;
  alarmCountInBucket: number;
}
interface ShiftWiseAlarmResponse {
  selectedDate: string;
  shiftSummary: ShiftSummary[];
  prioritySummary: PrioritySummary[];
  floodDetails: FloodDetail[];
}

/* ========================================================= HELPERS ========================================================= */ const pad =
  (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const getToday = (): string => {
  return formatDate(new Date());
};
const formatTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
/* ========================================================= CARD ========================================================= */ interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
}
const DashboardCard = ({ children, className = '' }: DashboardCardProps) => {
  return (
    <div
      className={` min-h-[220px] overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-sm ${className} `}
    >
      {' '}
      {children}{' '}
    </div>
  );
};
/* ========================================================= CARD TITLE ========================================================= */ interface CardTitleProps {
  title: string;
  subtitle?: string;
}
const CardTitle = ({ title, subtitle }: CardTitleProps) => {
  return (
    <div className="mb-1">
      {' '}
      <div className="text-sm font-medium text-slate-700">{title}</div>{' '}
      {subtitle && (
        <div className="text-[11px] text-slate-500">{subtitle}</div>
      )}{' '}
    </div>
  );
};
/* ========================================================= NO DATA ========================================================= */ const NoData =
  ({ height = 'h-[190px]' }: { height?: string }) => {
    return (
      <div
        className={` flex ${height} items-center justify-center text-xs text-slate-400 `}
      >
        {' '}
        No data available{' '}
      </div>
    );
  };
/* ========================================================= KPI BOX ========================================================= */ interface KpiBoxProps {
  title: string;
  value: number;
  description: string;
  icon: string;
}
const KpiBox = ({ title, value, description, icon }: KpiBoxProps) => {
  return (
    <div className=" rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm ">
      {' '}
      <div className="flex items-center justify-between">
        {' '}
        <div>
          {' '}
          <div className="text-[11px] font-medium text-slate-500">
            {title}
          </div>{' '}
          <div className="mt-0.5 text-2xl font-semibold text-slate-700">
            {' '}
            {value.toLocaleString()}{' '}
          </div>{' '}
          <div className="text-[10px] text-slate-400">{description}</div>{' '}
        </div>{' '}
        <div className=" flex h-9 w-9 items-center justify-center rounded-md bg-sky-50 text-lg text-sky-600 ">
          {' '}
          {icon}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
};
/* ========================================================= MAIN COMPONENT ========================================================= */ const ShiftWiseAlarmSummary =
  () => {
    /* ======================================================= STATE ======================================================= */ const [
      selectedDate,
      setSelectedDate,
    ] = useState<string>(getToday());
    const Api = React.useMemo(() => createCrudApi('AlarmKPI'), []);
    const [data, setData] = useState<ShiftWiseAlarmResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    /* ======================================================= API CALL ======================================================= */ const loadDashboard =
      async () => {
        try {
          setLoading(true);
          setError('');
          const params = new URLSearchParams();
          params.set('SelectedDate', selectedDate);
          const response = await Api.get<ShiftWiseAlarmResponse>(
            `ShiftWiseAlarmSummary?${params.toString()}`
          );

          const result = response?.data;

          if (!result) {
            throw new Error('Empty response from server');
          }
          console.log('Shift Wise Alarm Summary Response:', result);
          setData(result);
        } catch (err) {
          console.error('Shift Wise Alarm Summary API Error:', err);
          setData(null);
          setError('Unable to load Shift Wise Alarm Summary data.');
        } finally {
          setLoading(false);
        }
      };
    /* ======================================================= LOAD DATA WHEN DATE CHANGES ======================================================= */ useEffect(() => {
      loadDashboard();
    }, [selectedDate]);
    /* ======================================================= API DATA ======================================================= */ const shifts =
      data?.shiftSummary ?? [];
    const priorities = data?.prioritySummary ?? [];
    const floodDetails = data?.floodDetails ?? [];
    /* ======================================================= TOTAL KPI ======================================================= */ const totals =
      useMemo(() => {
        return {
          alarmCount: shifts.reduce(
            (sum, item) => sum + Number(item.alarmCount || 0),
            0
          ),
          alarmFloodCount: shifts.reduce(
            (sum, item) => sum + Number(item.alarmFloodCount || 0),
            0
          ),
          alarmsInsideFlood: shifts.reduce(
            (sum, item) => sum + Number(item.alarmsInsideFlood || 0),
            0
          ),
          highPriorityAlarmCount: shifts.reduce(
            (sum, item) => sum + Number(item.highPriorityAlarmCount || 0),
            0
          ),
          standingAlarmCount: shifts.reduce(
            (sum, item) => sum + Number(item.standingAlarmCount || 0),
            0
          ),
        };
      }, [shifts]);
    /* ======================================================= SHIFT CATEGORIES ======================================================= */ const shiftCategories =
      shifts.map((item) => `Shift ${item.shiftNo}`);
    /* ======================================================= COMMON CHART SETTINGS ======================================================= */ const commonXAxisLabels =
      { style: { colors: '#64748b', fontSize: '10px' } };
    const commonYAxisLabels = {
      style: { colors: '#64748b', fontSize: '10px' },
    };
    /* ======================================================= ALARM COUNT / LOAD DISTRIBUTION ======================================================= */ const alarmCountOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#1491d4'],
        plotOptions: {
          bar: { horizontal: false, columnWidth: '45%', borderRadius: 2 },
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', fontWeight: 500, colors: ['#475569'] },
        },
        xaxis: {
          categories: shiftCategories,
          labels: commonXAxisLabels,
          axisBorder: { color: '#cbd5e1' },
          axisTicks: { color: '#cbd5e1' },
        },
        yaxis: { min: 0, labels: commonYAxisLabels },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: {
            formatter: (value) => `${Number(value).toLocaleString()} alarms`,
          },
        },
        legend: { show: false },
      };
    /* ======================================================= ALARM FLOOD OPTIONS ======================================================= */ const alarmFloodOptions: ApexOptions =
      {
        chart: {
          type: 'line',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#1491d4'],
        stroke: { curve: 'smooth', width: 2 },
        markers: { size: 4, strokeWidth: 0 },
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', colors: ['#475569'] },
        },
        xaxis: {
          categories: shiftCategories,
          labels: commonXAxisLabels,
          axisBorder: { color: '#cbd5e1' },
          axisTicks: { color: '#cbd5e1' },
        },
        yaxis: { min: 0, labels: commonYAxisLabels },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: { formatter: (value) => `${Number(value)} floods` },
        },
        legend: { show: false },
      };
    /* ======================================================= ALARMS INSIDE FLOOD ======================================================= */ const alarmsInsideFloodOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#eab308'],
        plotOptions: {
          bar: { horizontal: false, columnWidth: '45%', borderRadius: 2 },
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', colors: ['#475569'] },
        },
        xaxis: {
          categories: shiftCategories,
          labels: commonXAxisLabels,
          axisBorder: { color: '#cbd5e1' },
        },
        yaxis: { min: 0, labels: commonYAxisLabels },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: {
            formatter: (value) => `${Number(value).toLocaleString()} alarms`,
          },
        },
        legend: { show: false },
      };
    /* ======================================================= HIGH PRIORITY ======================================================= */ const highPriorityOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#ef6b6b'],
        plotOptions: {
          bar: { horizontal: false, columnWidth: '45%', borderRadius: 2 },
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', colors: ['#475569'] },
        },
        xaxis: {
          categories: shiftCategories,
          labels: commonXAxisLabels,
          axisBorder: { color: '#cbd5e1' },
        },
        yaxis: { min: 0, labels: commonYAxisLabels },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: {
            formatter: (value) => `${Number(value).toLocaleString()} alarms`,
          },
        },
        legend: { show: false },
      };
    /* ======================================================= STANDING ALARM ======================================================= */ const standingAlarmOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#1491d4'],
        plotOptions: {
          bar: { horizontal: false, columnWidth: '45%', borderRadius: 2 },
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', colors: ['#475569'] },
        },
        xaxis: {
          categories: shiftCategories,
          labels: commonXAxisLabels,
          axisBorder: { color: '#cbd5e1' },
        },
        yaxis: { min: 0, labels: commonYAxisLabels },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: {
            formatter: (value) =>
              `${Number(value).toLocaleString()} standing alarms`,
          },
        },
        legend: { show: false },
      };
    /* ======================================================= PRIORITY DISTRIBUTION ======================================================= */ const prioritySeries =
      priorities.map((item) => Number(item.alarmCount || 0));
    const priorityLabels = priorities.map(
      (item) => `Priority ${item.priority}`
    );
    const priorityColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
    const priorityOptions: ApexOptions = {
      chart: {
        type: 'donut',
        toolbar: { show: false },
        fontFamily: 'Inter, Arial, sans-serif',
      },
      labels: priorityLabels,
      colors: priorityColors,
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '10px',
        labels: { colors: '#475569' },
        markers: { size: 6 },
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 500 },
        formatter: (value) => `${Math.round(Number(value))}%`,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '62%',
            labels: {
              show: true,
              name: { color: '#64748b', fontSize: '10px' },
              value: {
                color: '#334155',
                fontSize: '17px',
                fontWeight: 600,
                formatter: (value) => Number(value).toLocaleString(),
              },
              total: {
                show: true,
                label: 'Total',
                color: '#64748b',
                formatter: () =>
                  prioritySeries
                    .reduce((sum, value) => sum + value, 0)
                    .toLocaleString(),
              },
            },
          },
        },
      },
      stroke: { width: 2, colors: ['#ffffff'] },
      tooltip: {
        theme: 'light',
        y: { formatter: (value) => `${Number(value).toLocaleString()} alarms` },
      },
    };
    /* ======================================================= FLOOD TIMELINE DATA ======================================================= */ const floodTimelineData =
      useMemo(() => {
        return floodDetails.map((item) => ({
          x: formatTime(item.floodStartTime),
          y: Number(item.alarmCountInBucket || 0),
          shift: item.shiftNo,
          start: item.floodStartTime,
          end: item.floodEndTime,
        }));
      }, [floodDetails]);
    /* ======================================================= FLOOD TIMELINE OPTIONS ======================================================= */ const floodTimelineOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: {
            show: true,
            tools: {
              download: false,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true,
            },
            autoSelected: 'zoom',
          },
          zoom: { enabled: true },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        colors: ['#1491d4'],
        plotOptions: { bar: { columnWidth: '65%', borderRadius: 1 } },
        dataLabels: { enabled: false },
        xaxis: {
          type: 'category',
          labels: {
            rotate: -45,
            style: { colors: '#64748b', fontSize: '9px' },
          },
          axisBorder: { color: '#cbd5e1' },
          axisTicks: { color: '#cbd5e1' },
        },
        yaxis: {
          min: 0,
          title: {
            text: 'Alarm Count',
            style: { color: '#64748b', fontSize: '10px', fontWeight: 400 },
          },
          labels: { style: { colors: '#64748b', fontSize: '10px' } },
        },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          custom: ({ dataPointIndex }) => {
            const item = floodTimelineData[dataPointIndex];
            if (!item) {
              return '';
            }
            return ` <div style=" padding:10px 12px; background:#ffffff; color:#334155; border:1px solid #e2e8f0; font-size:11px; box-shadow:0 4px 12px rgba(0,0,0,0.08); " > <div> <strong>Shift:</strong> ${item.shift} </div> <div> <strong>Time:</strong> ${formatTime(item.start)} - ${formatTime(item.end)} </div> <div> <strong>Alarm Count:</strong> ${item.y} </div> </div> `;
          },
        },
      };
    /* ======================================================= JSX ======================================================= */ return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-800">
        {' '}
        {/* ================================================= HEADER ================================================= */}{' '}
        <div className="mb-3 flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm ">
          {' '}
          {/* TITLE */}{' '}
          <div>
            {' '}
            <div className="text-base font-semibold text-slate-700">
              {' '}
              Shift-wise Alarm Summary{' '}
            </div>{' '}
            <div className="text-[10px] text-slate-400">
              Alarm KPI Dashboard
            </div>{' '}
          </div>{' '}
          {/* DATE + REFRESH */}{' '}
          <div className="flex items-center gap-2">
            {' '}
            <label className="text-xs text-slate-500">Selected Date</label>{' '}
            <input
              type="date"
              max={getToday()}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className=" h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 "
            />{' '}
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className=" flex h-8 items-center gap-2 rounded bg-sky-600 px-3 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 "
            >
              {' '}
              {loading && (
                <span className=" h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white " />
              )}{' '}
              Refresh{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
        {/* ================================================= ERROR ================================================= */}{' '}
        {error && (
          <div className=" mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 ">
            {' '}
            {error}{' '}
          </div>
        )}{' '}
        {/* ================================================= KPI SUMMARY ================================================= */}{' '}
        <div className=" mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 ">
          {' '}
          <KpiBox
            title="Total Alarm Count"
            value={totals.alarmCount}
            description="All shifts"
            icon="⚠"
          />{' '}
          <KpiBox
            title="Alarm Flood Count"
            value={totals.alarmFloodCount}
            description="All shifts"
            icon="≋"
          />{' '}
          <KpiBox
            title="Alarms Inside Flood"
            value={totals.alarmsInsideFlood}
            description="During flood periods"
            icon="▥"
          />{' '}
          <KpiBox
            title="High Priority"
            value={totals.highPriorityAlarmCount}
            description="All shifts"
            icon="!"
          />{' '}
          <KpiBox
            title="Standing Alarms"
            value={totals.standingAlarmCount}
            description="Unresolved alarms"
            icon="◷"
          />{' '}
        </div>{' '}
        {/* ================================================= MAIN GRID ================================================= */}{' '}
        <div className=" grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12 ">
          {' '}
          {/* ================================================= 1. ALARM COUNT / LOAD ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle
              title="Alarm Count / Load Distribution"
              subtitle="Shift-wise"
            />{' '}
            {shifts.length > 0 ? (
              <Chart
                type="bar"
                height={200}
                series={[
                  {
                    name: 'Alarm Count',
                    data: shifts.map((item) => Number(item.alarmCount || 0)),
                  },
                ]}
                options={alarmCountOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-[10px] text-slate-400">
              {' '}
              Indicates operator workload{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= 2. ALARM FLOODS ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle
              title="Number of Alarm Floods"
              subtitle="Shift-wise"
            />{' '}
            {shifts.length > 0 ? (
              <Chart
                type="line"
                height={200}
                series={[
                  {
                    name: 'Alarm Floods',
                    data: shifts.map((item) =>
                      Number(item.alarmFloodCount || 0)
                    ),
                  },
                ]}
                options={alarmFloodOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-[10px] text-slate-400">
              {' '}
              Indicates occurrence of alarm floods{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= 3. ALARMS INSIDE FLOOD ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle title="Alarms Inside Flood" subtitle="Shift-wise" />{' '}
            {shifts.length > 0 ? (
              <Chart
                type="bar"
                height={200}
                series={[
                  {
                    name: 'Alarms Inside Flood',
                    data: shifts.map((item) =>
                      Number(item.alarmsInsideFlood || 0)
                    ),
                  },
                ]}
                options={alarmsInsideFloodOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-[10px] text-slate-400">
              {' '}
              Alarms generated during flood periods{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= 4. HIGH PRIORITY ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle
              title="High Priority Alarm Count"
              subtitle="Shift-wise"
            />{' '}
            {shifts.length > 0 ? (
              <Chart
                type="bar"
                height={200}
                series={[
                  {
                    name: 'High Priority',
                    data: shifts.map((item) =>
                      Number(item.highPriorityAlarmCount || 0)
                    ),
                  },
                ]}
                options={highPriorityOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-[10px] text-slate-400">
              {' '}
              Indicates high priority alarm frequency{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= 5. STANDING ALARM ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle
              title="Standing Alarm Count"
              subtitle="Shift-wise"
            />{' '}
            {shifts.length > 0 ? (
              <Chart
                type="bar"
                height={200}
                series={[
                  {
                    name: 'Standing Alarms',
                    data: shifts.map((item) =>
                      Number(item.standingAlarmCount || 0)
                    ),
                  },
                ]}
                options={standingAlarmOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-[10px] text-slate-400">
              {' '}
              Indicates unresolved alarms{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= 6. PRIORITY DISTRIBUTION ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle
              title="Alarm Priority Distribution"
              subtitle="Priority-wise"
            />{' '}
            {prioritySeries.length > 0 ? (
              <Chart
                type="donut"
                height={215}
                series={prioritySeries}
                options={priorityOptions}
              />
            ) : (
              <NoData />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= 7. FLOOD TIMELINE ================================================= */}{' '}
          <DashboardCard className="xl:col-span-12">
            {' '}
            <CardTitle
              title="Alarm Flood Timeline"
              subtitle="15-minute bucket-wise alarm count"
            />{' '}
            {floodTimelineData.length > 0 ? (
              <Chart
                type="bar"
                height={300}
                series={[
                  {
                    name: 'Alarm Count',
                    data: floodTimelineData.map((item) => ({
                      x: item.x,
                      y: item.y,
                    })),
                  },
                ]}
                options={floodTimelineOptions}
              />
            ) : (
              <NoData height="h-[270px]" />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= 8. SHIFT SUMMARY TABLE ================================================= */}{' '}
          <DashboardCard className="xl:col-span-12">
            {' '}
            <CardTitle
              title="Shift Summary"
              subtitle="Detailed shift-wise KPI values"
            />{' '}
            <div className="overflow-x-auto">
              {' '}
              <table className=" w-full min-w-[850px] text-left text-xs ">
                {' '}
                <thead>
                  {' '}
                  <tr className=" border-b border-slate-200 bg-slate-50 text-slate-500 ">
                    {' '}
                    <th className="px-3 py-2">Shift</th>{' '}
                    <th className="px-3 py-2 text-right">Alarm Count</th>{' '}
                    <th className="px-3 py-2 text-right">Alarm Floods</th>{' '}
                    <th className="px-3 py-2 text-right">
                      Alarms Inside Flood
                    </th>{' '}
                    <th className="px-3 py-2 text-right">High Priority</th>{' '}
                    <th className="px-3 py-2 text-right">
                      Standing Alarms
                    </th>{' '}
                  </tr>{' '}
                </thead>{' '}
                <tbody>
                  {' '}
                  {shifts.map((shift) => (
                    <tr
                      key={shift.shiftNo}
                      className=" border-b border-slate-100 transition hover:bg-slate-50 "
                    >
                      {' '}
                      <td className="px-3 py-2">
                        {' '}
                        <div className="font-medium text-slate-700">
                          {' '}
                          Shift {shift.shiftNo}{' '}
                        </div>{' '}
                        <div className="text-[10px] text-slate-400">
                          {' '}
                          {shift.shiftName}{' '}
                        </div>{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {' '}
                        {Number(shift.alarmCount || 0).toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-slate-600">
                        {' '}
                        {Number(
                          shift.alarmFloodCount || 0
                        ).toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-slate-600">
                        {' '}
                        {Number(
                          shift.alarmsInsideFlood || 0
                        ).toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right font-medium text-red-500">
                        {' '}
                        {Number(
                          shift.highPriorityAlarmCount || 0
                        ).toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right font-medium text-amber-600">
                        {' '}
                        {Number(
                          shift.standingAlarmCount || 0
                        ).toLocaleString()}{' '}
                      </td>{' '}
                    </tr>
                  ))}{' '}
                  {/* TOTAL ROW */}{' '}
                  {shifts.length > 0 && (
                    <tr className=" bg-slate-50 font-semibold ">
                      {' '}
                      <td className="px-3 py-2 text-slate-700">Total</td>{' '}
                      <td className="px-3 py-2 text-right text-slate-700">
                        {' '}
                        {totals.alarmCount.toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-slate-700">
                        {' '}
                        {totals.alarmFloodCount.toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-slate-700">
                        {' '}
                        {totals.alarmsInsideFlood.toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-red-500">
                        {' '}
                        {totals.highPriorityAlarmCount.toLocaleString()}{' '}
                      </td>{' '}
                      <td className="px-3 py-2 text-right text-amber-600">
                        {' '}
                        {totals.standingAlarmCount.toLocaleString()}{' '}
                      </td>{' '}
                    </tr>
                  )}{' '}
                </tbody>{' '}
              </table>{' '}
            </div>{' '}
          </DashboardCard>{' '}
        </div>{' '}
      </div>
    );
  };
export default ShiftWiseAlarmSummary;
