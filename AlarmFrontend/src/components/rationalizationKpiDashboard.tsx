import React, { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { createCrudApi } from '../features/lib/createCrudApi';

type DurationType = 'DAY' | 'WEEK' | 'MONTH';
interface Summary {
  durationType: DurationType;
  currentStartDate: string;
  currentEndDate: string;
  previousStartDate: string;
  previousEndDate: string;
  currentAlarmCount: number;
  previousAlarmCount: number;
  currentAlarmRate: number;
  previousAlarmRate: number;
  alarmRateChangePercentage: number;
  alarmCountChangePercentage: number;
}
interface AlarmTrend {
  trendValue: number;
  trendLabel: string;
  currentCriticalCount: number;
  currentHighCount: number;
  currentMediumCount: number;
  currentLowCount: number;
  currentTotalCount: number;
  previousCriticalCount: number;
  previousHighCount: number;
  previousMediumCount: number;
  previousLowCount: number;
  previousTotalCount: number;
}
interface ChatteringAlarm {
  sourceName: string;
  currentChatteringCount: number;
  previousChatteringCount: number;
  countChange: number;
}
interface StandingAlarm {
  sourceName: string;
  currentStandingHours: number;
  previousStandingHours: number;
  durationChangeHours: number;
}
interface BadActor {
  sourceName: string;
  currentAlarmCount: number;
  previousAlarmCount: number;
  changePercentage: number;
}
interface PriorityDistribution {
  priority: number;
  currentCount: number;
  previousCount: number;
  currentPercentage: number;
  previousPercentage: number;
}
interface DashboardResponse {
  summary: Summary;
  chatteringAlarms: ChatteringAlarm[];
  standingAlarms: StandingAlarm[];
  badActors: BadActor[];
  priorityDistribution: PriorityDistribution[];
  alarmTrend: AlarmTrend[];
}
interface Filters {
  durationType: DurationType;
  startDate: string;
  endDate: string;
  month: string;
  year: number;
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];
/* ========================================================= DATE HELPERS ========================================================= */ const pad =
  (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (value: string, days: number) => {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};
const getToday = () => {
  return formatDate(new Date());
};
const getMonthStart = (year: number, month: string) => {
  return `${year}-${month}-01`;
};
const getMonthEnd = (year: number, month: string) => {
  const lastDay = new Date(year, Number(month), 0).getDate();
  return `${year}-${month}-${pad(lastDay)}`;
};
/* ========================================================= REUSABLE CARD ========================================================= */ const DashboardCard =
  ({
    children,
    className = '',
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    return (
      <div
        className={` min-h-[220px] overflow-hidden rounded-md border border-slate-200 bg-white p-2.5 shadow-sm ${className} `}
      >
        {' '}
        {children}{' '}
      </div>
    );
  };
const CardTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-1 truncate text-sm font-medium text-slate-700">
      {' '}
      {children}{' '}
    </div>
  );
};
const NoData = ({ height = 'h-[165px]' }: { height?: string }) => {
  return (
    <div
      className={` flex ${height} items-center justify-center text-xs text-slate-400 `}
    >
      {' '}
      No data available{' '}
    </div>
  );
};
const Legend = ({ bg, label }: { bg: string; label: string }) => {
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-600">
      {' '}
      <span className={`h-2.5 w-2.5 rounded-sm ${bg}`} /> {label}{' '}
    </span>
  );
};
/* ========================================================= MAIN COMPONENT ========================================================= */ const RationalizationKpiDashboard =
  () => {
    const Api = React.useMemo(() => createCrudApi('AlarmKPI'), []);
    const currentDate = new Date();
    const [filters, setFilters] = useState<Filters>({
      durationType: 'DAY',
      startDate: getToday(),
      endDate: getToday(),
      month: pad(currentDate.getMonth() + 1),
      year: currentDate.getFullYear(),
    });
    const [data, setData] = useState<DashboardResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    /* * Weekly exactly 7 days. * * Example: * StartDate = 2026-07-07 * EndDate = 2026-07-14 * * Also prevents selecting a week whose * ending date would be in the future. */ const maxWeeklyStartDate =
      addDays(getToday(), -7);
    /* ======================================================= BUILD API REQUEST ======================================================= */ const buildApiQuery =
      () => {
        const params = new URLSearchParams();
        params.set('DurationType', filters.durationType);
        /* ---------------- DAY ---------------- */ if (
          filters.durationType === 'DAY'
        ) {
          /* * User requirement: * Day -> only StartDate */ params.set(
            'StartDate',
            filters.startDate
          );
        }
        /* ---------------- WEEK ---------------- */ if (
          filters.durationType === 'WEEK'
        ) {
          const weeklyEndDate = addDays(filters.startDate, 7);
          params.set('StartDate', filters.startDate);
          params.set('EndDate', weeklyEndDate);
        }
        /* ---------------- MONTH ---------------- */ if (
          filters.durationType === 'MONTH'
        ) {
          const startDate = getMonthStart(filters.year, filters.month);
          const endDate = getMonthEnd(filters.year, filters.month);
          params.set('StartDate', startDate);
          params.set('EndDate', endDate);
        }
        return params;
      };
    /* ======================================================= API CALL ======================================================= */ const loadDashboard =
      async () => {
        try {
          setLoading(true);
          setError('');
          const params = buildApiQuery();
          const response = await Api.get<DashboardResponse>(
            `RationalizationDashboard?${params.toString()}`
          );

          const result = response?.data;

          if (!result) {
            throw new Error('Empty response from server');
          }
          console.log('Rationalization KPI Response:', result);
          setData(result);
        } catch (err) {
          console.error('Rationalization KPI API Error:', err);
          setData(null);
          setError('Unable to load Rationalization KPI data.');
        } finally {
          setLoading(false);
        }
      };
    useEffect(() => {
      loadDashboard();
    }, [filters.durationType, filters.startDate, filters.month, filters.year]);
    /* ======================================================= API DATA ======================================================= */ const summary =
      data?.summary;
    const trend = data?.alarmTrend ?? [];
    /* ======================================================= CHATTERING ALARMS ======================================================= */ const chatteringData =
      useMemo(() => {
        return [...(data?.chatteringAlarms ?? [])]
          .map((item) => ({
            name: item.sourceName,
            value: Number(item.currentChatteringCount ?? 0),
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }, [data]);
    /* ======================================================= STANDING ALARMS ======================================================= */ const standingData =
      useMemo(() => {
        return [...(data?.standingAlarms ?? [])]
          .map((item) => ({
            name: item.sourceName,
            value: Number(item.currentStandingHours ?? 0),
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }, [data]);
    /* ======================================================= BAD ACTORS ======================================================= */ const badActorData =
      useMemo(() => {
        return [...(data?.badActors ?? [])]
          .map((item) => ({
            name: item.sourceName,
            value: Number(item.currentAlarmCount ?? 0),
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }, [data]);
    /* ======================================================= PRIORITY DISTRIBUTION ======================================================= */ /* * API response: * * priority 2 -> Low * priority 3 -> Medium * priority 4 -> High * * Critical is currently not returned by this API, * therefore it remains 0. */ const priorityData =
      useMemo(() => {
        const current = { low: 0, medium: 0, high: 0, critical: 0 };
        const previous = { low: 0, medium: 0, high: 0, critical: 0 };
        (data?.priorityDistribution ?? []).forEach((item) => {
          const priority = Number(item.priority);
          if (priority === 2) {
            current.low = Number(item.currentPercentage ?? 0);
            previous.low = Number(item.previousPercentage ?? 0);
          }
          if (priority === 3) {
            current.medium = Number(item.currentPercentage ?? 0);
            previous.medium = Number(item.previousPercentage ?? 0);
          }
          if (priority === 4) {
            current.high = Number(item.currentPercentage ?? 0);
            previous.high = Number(item.previousPercentage ?? 0);
          }
        });
        return { current, previous };
      }, [data]);
    const currentPrioritySeries = [
      priorityData.current.low,
      priorityData.current.medium,
      priorityData.current.high,
      priorityData.current.critical,
    ];
    const previousPrioritySeries = [
      priorityData.previous.low,
      priorityData.previous.medium,
      priorityData.previous.high,
      priorityData.previous.critical,
    ];
    const hasCurrentPriorityData = currentPrioritySeries.some(
      (value) => value > 0
    );
    const hasPreviousPriorityData = previousPrioritySeries.some(
      (value) => value > 0
    );
    /* ======================================================= BAR CHART OPTIONS ======================================================= */ const horizontalBarOptions =
      (categories: string[]): ApexOptions => {
        return {
          chart: {
            type: 'bar',
            toolbar: { show: false },
            fontFamily: 'Inter, Arial, sans-serif',
          },
          plotOptions: {
            bar: { horizontal: true, borderRadius: 2, barHeight: '55%' },
          },
          colors: ['#1491d4'],
          dataLabels: {
            enabled: true,
            style: { fontSize: '10px', fontWeight: 500 },
          },
          xaxis: {
            categories,
            labels: { style: { fontSize: '10px', colors: '#64748b' } },
          },
          yaxis: {
            labels: {
              maxWidth: 160,
              style: { fontSize: '10px', colors: '#334155' },
            },
          },
          grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
          tooltip: { theme: 'light' },
        };
      };
    /* ======================================================= STANDING ALARM OPTIONS ======================================================= */ const standingOptions: ApexOptions =
      {
        chart: {
          type: 'bar',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        plotOptions: { bar: { columnWidth: '38%', borderRadius: 2 } },
        colors: ['#1491d4'],
        dataLabels: { enabled: false },
        xaxis: {
          categories: standingData.map((item) => item.name),
          labels: {
            rotate: -35,
            style: { fontSize: '9px', colors: '#64748b' },
          },
        },
        yaxis: {
          min: 0,
          labels: { style: { fontSize: '10px', colors: '#64748b' } },
        },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        tooltip: {
          theme: 'light',
          y: { formatter: (value) => `${Number(value).toFixed(2)} hours` },
        },
      };
    /* ======================================================= DONUT OPTIONS ======================================================= */ const donutOptions: ApexOptions =
      {
        chart: {
          type: 'donut',
          toolbar: { show: false },
          fontFamily: 'Inter, Arial, sans-serif',
        },
        labels: ['Low', 'Medium', 'High', 'Critical'],
        colors: ['#0ea5e9', '#eab308', '#ef4444', '#7c3aed'],
        legend: { show: false },
        dataLabels: {
          enabled: true,
          formatter: (value) => `${Math.round(Number(value))}%`,
          style: { fontSize: '14px', fontWeight: 600 },
          dropShadow: { enabled: false },
        },
        plotOptions: { pie: { donut: { size: '62%' } } },
        stroke: { width: 2, colors: ['#ffffff'] },
        tooltip: {
          theme: 'light',
          y: { formatter: (value) => `${Number(value).toFixed(2)}%` },
        },
      };
    /* ======================================================= TREND OPTIONS ======================================================= */ const trendOptions: ApexOptions =
      {
        chart: {
          type: 'line',
          fontFamily: 'Inter, Arial, sans-serif',
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
          zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
        },
        stroke: { curve: 'smooth', width: 2 },
        colors: ['#7c3aed', '#ef4444', '#eab308', '#16a34a'],
        markers: { size: 2 },
        xaxis: {
          categories: trend.map((item) => item.trendLabel),
          labels: {
            rotate: -45,
            style: { fontSize: '9px', colors: '#64748b' },
          },
        },
        yaxis: {
          min: 0,
          forceNiceScale: true,
          labels: { style: { fontSize: '10px', colors: '#64748b' } },
        },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
        legend: { position: 'top', horizontalAlign: 'left', fontSize: '10px' },
        tooltip: { theme: 'light' },
      };
    /* ======================================================= CURRENT TREND ======================================================= */ const currentTrendSeries =
      [
        {
          name: 'Critical',
          data: trend.map((item) => item.currentCriticalCount),
        },
        { name: 'High', data: trend.map((item) => item.currentHighCount) },
        { name: 'Medium', data: trend.map((item) => item.currentMediumCount) },
        { name: 'Low', data: trend.map((item) => item.currentLowCount) },
      ];
    /* ======================================================= PREVIOUS TREND ======================================================= */ const previousTrendSeries =
      [
        {
          name: 'Critical',
          data: trend.map((item) => item.previousCriticalCount),
        },
        { name: 'High', data: trend.map((item) => item.previousHighCount) },
        { name: 'Medium', data: trend.map((item) => item.previousMediumCount) },
        { name: 'Low', data: trend.map((item) => item.previousLowCount) },
      ];
    /* ======================================================= RATE CHANGE ======================================================= */ const rateChange =
      summary?.alarmRateChangePercentage ?? 0;
    const rateChangeClass =
      rateChange > 0
        ? 'text-red-500'
        : rateChange < 0
          ? 'text-green-600'
          : 'text-slate-400';
    /* ======================================================= FILTER HANDLERS ======================================================= */ const handleDurationChange =
      (type: DurationType) => {
        if (type === 'DAY') {
          const value = getToday();
          setFilters((prev) => ({
            ...prev,
            durationType: 'DAY',
            startDate: value,
            endDate: value,
          }));
          return;
        }
        if (type === 'WEEK') {
          let startDate = filters.startDate;
          /* * If currently selected start date * would make an incomplete/future week, * move it back to latest completed week. */ if (
            parseDate(startDate) > parseDate(maxWeeklyStartDate)
          ) {
            startDate = maxWeeklyStartDate;
          }
          setFilters((prev) => ({
            ...prev,
            durationType: 'WEEK',
            startDate,
            endDate: addDays(startDate, 7),
          }));
          return;
        }
        /* MONTH */ const current = new Date();
        setFilters((prev) => ({
          ...prev,
          durationType: 'MONTH',
          month: pad(current.getMonth() + 1),
          year: current.getFullYear(),
        }));
      };
    const handleDailyDateChange = (value: string) => {
      setFilters((prev) => ({ ...prev, startDate: value, endDate: value }));
    };
    const handleWeeklyStartChange = (value: string) => {
      let startDate = value;
      /* * Never allow a future/incomplete week. */ if (
        parseDate(startDate) > parseDate(maxWeeklyStartDate)
      ) {
        startDate = maxWeeklyStartDate;
      }
      setFilters((prev) => ({
        ...prev,
        startDate,
        /* * EXACTLY 7 days */ endDate: addDays(startDate, 7),
      }));
    };
    const handleMonthChange = (value: string) => {
      const selectedMonth = Number(value);
      /* * Future month is not allowed. */ if (
        filters.year === currentYear &&
        selectedMonth > currentMonth
      ) {
        return;
      }
      setFilters((prev) => ({ ...prev, month: value }));
    };
    const handleYearChange = (value: number) => {
      if (!Number.isFinite(value)) {
        return;
      }
      let year = value;
      if (year > currentYear) {
        year = currentYear;
      }
      if (year < 2000) {
        year = 2000;
      }
      let month = filters.month;
      /* * If current year selected, * future month automatically becomes * current month. */ if (
        year === currentYear &&
        Number(month) > currentMonth
      ) {
        month = pad(currentMonth);
      }
      setFilters((prev) => ({ ...prev, year, month }));
    };
    /* ======================================================= JSX ======================================================= */ return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-800">
        {' '}
        {/* ================================================= FILTER BAR ================================================= */}{' '}
        {/* ================================================= HEADER + FILTER BAR ================================================= */}
        <div className="mb-3 flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          {/* ================================================= LEFT SIDE - TITLE ================================================= */}
          <div className="min-w-[220px]">
            <div className="text-base font-semibold text-slate-700">
              Rationalization KPI Dashboard
            </div>

            <div className="text-[10px] text-slate-400">
              Alarm KPI Dashboard
            </div>
          </div>

          {/* ================================================= RIGHT SIDE - FILTERS ================================================= */}
          <div className="flex flex-wrap items-center gap-3">
            {/* ================================================= DURATION BUTTONS ================================================= */}
            <div className="flex overflow-hidden rounded border border-slate-200">
              {(['DAY', 'WEEK', 'MONTH'] as DurationType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleDurationChange(type)}
                  className={`
            border-r
            border-slate-200
            px-4
            py-2
            text-xs
            font-medium
            transition
            last:border-r-0
            ${
              filters.durationType === type
                ? 'bg-sky-600 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }
          `}
                >
                  {type === 'DAY'
                    ? 'Daily'
                    : type === 'WEEK'
                      ? 'Weekly'
                      : 'Monthly'}
                </button>
              ))}
            </div>

            {/* ================================================= DAILY ================================================= */}
            {filters.durationType === 'DAY' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Date</label>

                <input
                  type="date"
                  max={getToday()}
                  value={filters.startDate}
                  onChange={(event) =>
                    handleDailyDateChange(event.target.value)
                  }
                  className="
            h-8
            rounded
            border
            border-slate-300
            bg-white
            px-2
            text-xs
            text-slate-700
            outline-none
            transition
            focus:border-sky-500
            focus:ring-1
            focus:ring-sky-200
          "
                />
              </div>
            )}

            {/* ================================================= WEEKLY ================================================= */}
            {filters.durationType === 'WEEK' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Week from</label>

                  <input
                    type="date"
                    min="2000-01-01"
                    max={maxWeeklyStartDate}
                    value={filters.startDate}
                    onChange={(event) =>
                      handleWeeklyStartChange(event.target.value)
                    }
                    className="
              h-8
              rounded
              border
              border-slate-300
              bg-white
              px-2
              text-xs
              text-slate-700
              outline-none
              transition
              focus:border-sky-500
              focus:ring-1
              focus:ring-sky-200
            "
                  />
                </div>

                <span className="text-xs text-slate-400">to</span>

                {/* READ ONLY END DATE */}
                <input
                  type="date"
                  value={filters.endDate}
                  readOnly
                  className="
            h-8
            rounded
            border
            border-slate-300
            bg-slate-50
            px-2
            text-xs
            text-slate-600
            outline-none
          "
                  title="Automatically calculated as Start Date + 7 days"
                />

                <span className="text-[10px] text-slate-400">Fixed 7 days</span>
              </>
            )}

            {/* ================================================= MONTHLY ================================================= */}
            {filters.durationType === 'MONTH' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Month</label>

                  <select
                    value={filters.month}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    className="
              h-8
              rounded
              border
              border-slate-300
              bg-white
              px-2
              text-xs
              text-slate-700
              outline-none
              transition
              focus:border-sky-500
              focus:ring-1
              focus:ring-sky-200
            "
                  >
                    {MONTHS.map((month) => {
                      const future =
                        filters.year > currentYear ||
                        (filters.year === currentYear &&
                          Number(month.value) > currentMonth);

                      return (
                        <option
                          key={month.value}
                          value={month.value}
                          disabled={future}
                        >
                          {month.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Year</label>

                  <input
                    type="number"
                    min={2000}
                    max={currentYear}
                    value={filters.year}
                    onChange={(event) =>
                      handleYearChange(Number(event.target.value))
                    }
                    className="
              h-8
              w-20
              rounded
              border
              border-slate-300
              bg-white
              px-2
              text-xs
              text-slate-700
              outline-none
              transition
              focus:border-sky-500
              focus:ring-1
              focus:ring-sky-200
            "
                  />
                </div>
              </>
            )}

            {/* ================================================= LOADING ================================================= */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span
                  className="
            h-3.5
            w-3.5
            animate-spin
            rounded-full
            border-2
            border-slate-200
            border-t-sky-600
          "
                />
                Loading...
              </div>
            )}
          </div>
        </div>
        {/* ================================================= ERROR ================================================= */}
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}
        {/* ================================================= DASHBOARD GRID ================================================= */}{' '}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12">
          {' '}
          {/* ================================================= ALARM RATE ================================================= */}{' '}
          <DashboardCard className="xl:col-span-3">
            {' '}
            <CardTitle>Alarm Rate (per operator per hour)</CardTitle>{' '}
            <div className="flex min-h-[190px] flex-col items-center justify-center">
              {' '}
              <div className="text-5xl font-medium text-slate-700">
                {' '}
                {Number(summary?.currentAlarmRate ?? 0).toFixed(1)}{' '}
              </div>{' '}
              <div className={`mt-1 text-xs font-medium ${rateChangeClass}`}>
                {' '}
                {rateChange > 0 ? '+' : ''} {rateChange.toFixed(1)}%{' '}
              </div>{' '}
              <div className="mt-8 grid w-full grid-cols-2 text-center">
                {' '}
                <div>
                  {' '}
                  <div className="text-xl font-semibold text-slate-700">
                    {' '}
                    {summary?.currentAlarmCount ?? 0}{' '}
                  </div>{' '}
                  <div className="text-[11px] text-slate-400">
                    {' '}
                    Current period{' '}
                  </div>{' '}
                </div>{' '}
                <div>
                  {' '}
                  <div className="text-xl font-semibold text-slate-700">
                    {' '}
                    {summary?.previousAlarmCount ?? 0}{' '}
                  </div>{' '}
                  <div className="text-[11px] text-slate-400">
                    {' '}
                    Previous period{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= STANDING ALARMS ================================================= */}{' '}
          <DashboardCard className="xl:col-span-3">
            {' '}
            <CardTitle>Standing Alarms</CardTitle>{' '}
            {standingData.length > 0 ? (
              <Chart
                type="bar"
                height={195}
                series={[
                  {
                    name: 'Standing Alarms',
                    data: standingData.map((item) => item.value),
                  },
                ]}
                options={standingOptions}
              />
            ) : (
              <NoData />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= TOP 10 FREQUENT ALARMS ================================================= */}{' '}
          <DashboardCard className="xl:col-span-6">
            {' '}
            <CardTitle>Top 10 Frequent Alarms</CardTitle>{' '}
            {chatteringData.length > 0 ? (
              <Chart
                type="bar"
                height={195}
                series={[
                  {
                    name: 'Frequency',
                    data: chatteringData.map((item) => item.value),
                  },
                ]}
                options={horizontalBarOptions(
                  chatteringData.map((item) => item.name)
                )}
              />
            ) : (
              <NoData />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= CHATTERING ALARM TAGS ================================================= */}{' '}
          <DashboardCard className="xl:col-span-3">
            {' '}
            <CardTitle>Chattering Alarm Tags</CardTitle>{' '}
            {chatteringData.length > 0 ? (
              <Chart
                type="bar"
                height={195}
                series={[
                  {
                    name: 'Count',
                    data: chatteringData.slice(0, 5).map((item) => item.value),
                  },
                ]}
                options={horizontalBarOptions(
                  chatteringData.slice(0, 5).map((item) => item.name)
                )}
              />
            ) : (
              <NoData />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= CURRENT PRIORITY ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle>Alarm Priority Distribution</CardTitle>{' '}
            {hasCurrentPriorityData ? (
              <Chart
                type="donut"
                height={190}
                series={currentPrioritySeries}
                options={donutOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="text-center text-xs text-slate-500">
              {' '}
              Current period{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= PREVIOUS PRIORITY ================================================= */}{' '}
          <DashboardCard className="xl:col-span-5">
            {' '}
            <CardTitle>Alarm Priority Distribution</CardTitle>{' '}
            {hasPreviousPriorityData ? (
              <Chart
                type="donut"
                height={190}
                series={previousPrioritySeries}
                options={donutOptions}
              />
            ) : (
              <NoData />
            )}{' '}
            <div className="mt-1 flex flex-wrap justify-center gap-4">
              {' '}
              <Legend bg="bg-sky-500" label="Low" />{' '}
              <Legend bg="bg-yellow-500" label="Medium" />{' '}
              <Legend bg="bg-red-500" label="High" />{' '}
              <Legend bg="bg-violet-600" label="Critical" />{' '}
            </div>{' '}
            <div className="mt-2 text-center text-xs text-slate-500">
              {' '}
              Previous period{' '}
            </div>{' '}
          </DashboardCard>{' '}
          {/* ================================================= BAD ACTORS ================================================= */}{' '}
          <DashboardCard className="xl:col-span-4">
            {' '}
            <CardTitle>Bad Actors</CardTitle>{' '}
            {badActorData.length > 0 ? (
              <Chart
                type="bar"
                height={220}
                series={[
                  {
                    name: 'Alarms',
                    data: badActorData.map((item) => item.value),
                  },
                ]}
                options={horizontalBarOptions(
                  badActorData.map((item) => item.name)
                )}
              />
            ) : (
              <NoData />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= CURRENT ALARM TREND ================================================= */}{' '}
          <DashboardCard className="xl:col-span-8">
            {' '}
            <CardTitle>Alarm Trend</CardTitle>{' '}
            {trend.length > 0 ? (
              <Chart
                type="line"
                height={240}
                series={currentTrendSeries}
                options={trendOptions}
              />
            ) : (
              <NoData height="h-[220px]" />
            )}{' '}
          </DashboardCard>{' '}
          {/* ================================================= PREVIOUS ALARM TREND ================================================= */}{' '}
          <DashboardCard className="col-span-12">
            {' '}
            <CardTitle>Previous Period Alarm Trend</CardTitle>{' '}
            {trend.length > 0 ? (
              <Chart
                type="line"
                height={240}
                series={previousTrendSeries}
                options={trendOptions}
              />
            ) : (
              <NoData height="h-[220px]" />
            )}{' '}
          </DashboardCard>{' '}
        </div>{' '}
      </div>
    );
  };
export default RationalizationKpiDashboard;
