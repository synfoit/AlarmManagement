// src/pages/rationalizationKpiDashboard.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';

/* ========================================================= */
/* TYPES */
/* ========================================================= */

type DurationType = 'WEEK' | 'MONTH';

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
  currentAlarmRate: number;
  previousCriticalCount: number;
  previousHighCount: number;
  previousMediumCount: number;
  previousLowCount: number;
  previousTotalCount: number;
  previousAlarmRate: number;
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

/* ========================================================= */
/* MONTHS */
/* ========================================================= */

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

/* ========================================================= */
/* COLORS */
/* Same colors used in Alarm KPI Dashboard */
/* ========================================================= */

const PRIORITY_COLORS = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
};

/*
 * Current = full blue
 * Previous = lighter blue
 */
const ALARM_RATE_CURRENT_COLOR = '#2563EB';
const ALARM_RATE_PREVIOUS_COLOR = '#9bb9fa';

/* Tailwind dot classes (used for legends and tooltips) */
const ALARM_RATE_CURRENT_DOT = 'bg-[#2563EB]';
const ALARM_RATE_PREVIOUS_DOT = 'bg-[#9bb9fa]';

/* Same order as Critical, High, Medium, Low */
const PRIORITY_DOT_CLASSES = [
  'bg-[#DC2626]',
  'bg-[#F97316]',
  'bg-[#F59E0B]',
  'bg-[#10B981]',
];

/* ========================================================= */
/* DATE HELPERS */
/* ========================================================= */

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
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

/* ========================================================= */
/* DISPLAY HELPERS */
/* ========================================================= */

/*
 * Extract yyyy-mm-dd from any API date string, e.g.
 *   "Sunday (2025-09-14)"
 *   "2025-09-01"
 *   "2025-09-01T00:00:00"
 */
const extractDate = (value?: string) => {
  if (!value) {
    return '';
  }

  const match = value.match(/(\d{4}-\d{2}-\d{2})/);

  return match?.[1] ?? '';
};

/* "14 Sep 2025" */
const formatFullDate = (value?: string) => {
  const dateValue = extractDate(value);

  if (!dateValue) {
    return value ?? '';
  }

  const date = parseDate(dateValue);

  if (Number.isNaN(date.getTime())) {
    return value ?? '';
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* "07 Sep 2025 – 14 Sep 2025" */
const formatDateRange = (start?: string, end?: string) => {
  if (!start || !end) {
    return '';
  }

  return `${formatFullDate(start)} – ${formatFullDate(end)}`;
};

const formatTrendLabel = (value: string) => {
  /*
   * API week response can be:
   * Sunday (2025-09-14)
   *
   * API month response can be:
   * 2025-09-01
   *
   * Extract yyyy-mm-dd wherever possible.
   */
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);

  const dateValue = match?.[1] ?? value;

  const date = parseDate(dateValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (value.includes('(')) {
    const dayName = value.substring(0, value.indexOf('(')).trim();

    return `${dayName.slice(0, 3)} ${date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    })}`;
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
};

/*
 * Show EVERY date on the x axis (no skipped labels).
 * - hideOverlappingLabels: false -> Apex won't hide labels
 * - rotateAlways: true           -> labels are always rotated so they fit
 * - maxHeight                    -> reserves space for rotated labels
 */
const getXAxisLabelOptions = (): NonNullable<
  ApexOptions['xaxis']
>['labels'] => ({
  rotate: -45,
  rotateAlways: true,
  hideOverlappingLabels: false,
  trim: false,
  maxHeight: 60,
  style: {
    fontSize: '11px',
    colors: '#94A3B8',
  },
});

/* ========================================================= */
/* SECTION CARD (matches Alarm KPI Dashboard) */
/* ========================================================= */

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: JSX.Element;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-700">{title}</h2>

          {subtitle && (
            <div className="mt-0.5 text-[12px] text-slate-400">{subtitle}</div>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

/* ========================================================= */
/* EMPTY STATE (matches Alarm KPI Dashboard) */
/* ========================================================= */

const EMPTY_STATE_MIN_HEIGHT: Record<number, string> = {
  160: 'min-h-[160px]',
  250: 'min-h-[250px]',
};

function EmptyState({
  message = 'Data not available',
  height = 160,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-slate-400 ${
        EMPTY_STATE_MIN_HEIGHT[height] ?? 'min-h-[160px]'
      }`}
    >
      <AlertTriangle size={24} className="text-slate-300" />

      <p className="px-4 text-center text-[14px] font-medium">{message}</p>
    </div>
  );
}

/* ========================================================= */
/* COMPARISON LEGEND */
/* Shows the date range of the Previous / Current period */
/* ========================================================= */

const CurrentPreviousLegend = ({
  previousRange,
  currentRange,
}: {
  previousRange?: string;
  currentRange?: string;
}) => {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px]">
      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${ALARM_RATE_PREVIOUS_DOT}`} />
        Previous
        {previousRange && (
          <span className="text-slate-400">({previousRange})</span>
        )}
      </span>

      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${ALARM_RATE_CURRENT_DOT}`} />
        Current
        {currentRange && (
          <span className="text-slate-400">({currentRange})</span>
        )}
      </span>
    </div>
  );
};

/* ========================================================= */
/* PRIORITY LEGEND */
/* ========================================================= */

const PriorityLegend = () => {
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px]">
      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_CLASSES[0]}`} />
        Critical
      </span>

      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_CLASSES[1]}`} />
        High
      </span>

      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_CLASSES[2]}`} />
        Medium
      </span>

      <span className="flex items-center gap-1.5 text-slate-600">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS.low }}
        />
        Low
      </span>
    </div>
  );
};

/* ========================================================= */
/* MAIN COMPONENT */
/* ========================================================= */

const RationalizationKpiDashboard = (): JSX.Element => {
  const Api = useMemo(() => createCrudApi('AlarmKPI'), []);
  const [searchParams] = useSearchParams();

  const collectorId = searchParams.get('collectorId');
  const collectorName = searchParams.get('collectorName');

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  /*
   * Latest completed 7-day period
   */
  const latestWeeklyStartDate = addDays(getToday(), -6);

  const [filters, setFilters] = useState<Filters>({
    durationType: 'WEEK',
    startDate: latestWeeklyStartDate,
    endDate: getToday(),
    month: pad(currentMonth),
    year: currentYear,
  });

  const [data, setData] = useState<DashboardResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  /* ======================================================= */
  /* MAX WEEKLY START DATE */
  /* ======================================================= */

  const maxWeeklyStartDate = addDays(getToday(), -6);

  /* ======================================================= */
  /* BUILD API QUERY */
  /* ======================================================= */

  const buildApiQuery = useCallback(() => {
    const params = new URLSearchParams();

    if (collectorId && collectorName) {
      params.set('CollectorId', collectorId);
      params.set('CollectorName', collectorName);
    }

    params.set('DurationType', filters.durationType);

    /* ---------------- WEEK ---------------- */

    if (filters.durationType === 'WEEK') {
      let startDate = filters.startDate;

      if (parseDate(startDate) > parseDate(maxWeeklyStartDate)) {
        startDate = maxWeeklyStartDate;
      }

      params.set('StartDate', startDate);
      params.set('EndDate', addDays(startDate, 6));
    }

    /* ---------------- MONTH ---------------- */

    if (filters.durationType === 'MONTH') {
      params.set('StartDate', getMonthStart(filters.year, filters.month));
      params.set('EndDate', getMonthEnd(filters.year, filters.month));
    }

    return params;
  }, [filters, maxWeeklyStartDate, collectorId, collectorName]);

  /* ======================================================= */
  /* API CALL */
  /* ======================================================= */

  const loadDashboard = useCallback(async () => {
    if (!collectorId || !collectorName) {
      setData(null);
      setError(
        'Collector is not selected. Please open the dashboard from the collector list.'
      );
      return;
    }

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
  }, [Api, buildApiQuery, collectorId, collectorName]);

  /* ======================================================= */
  /* LOAD ON FILTER CHANGE */
  /* ======================================================= */

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* ======================================================= */
  /* API DATA */
  /* ======================================================= */

  const hasData = !!data;

  const trend = data?.alarmTrend ?? [];

  const summary = data?.summary;

  /*
   * Wrapper around the Alarm Trend chart. We use this to reach into the
   * chart's own rendered SVG and draw the "total" labels ourselves —
   * see the BUGFIX note above syncTrendTotalLabels for why.
   */
  const trendChartWrapperRef = useRef<HTMLDivElement | null>(null);

  /*
   * BUGFIX (labels misplaced after Week <-> Month switch):
   * Always keep the LATEST trend data in a ref. The chart's
   * "mounted" / "updated" event handlers can be captured from an
   * older render (stale closure), so they must not read `trend`
   * directly — they read trendRef.current instead.
   */
  const trendRef = useRef<AlarmTrend[]>(trend);
  trendRef.current = trend;

  /* Pending timers used to re-sync labels after the chart settles */
  const syncTimersRef = useRef<number[]>([]);

  /* ======================================================= */
  /* PERIOD RANGE LABELS + PER-POINT DATES */
  /*
   * X axis only shows the CURRENT period dates (keeps the chart
   * clean). The PREVIOUS period dates are surfaced in:
   *   1) the legend  -> full date range of Previous / Current
   *   2) the tooltip -> exact Previous date & Current date
   * ======================================================= */

  const currentRangeLabel = summary
    ? formatDateRange(summary.currentStartDate, summary.currentEndDate)
    : '';

  const previousRangeLabel = summary
    ? formatDateRange(summary.previousStartDate, summary.previousEndDate)
    : '';

  const getCurrentPointDate = (index: number) => {
    return formatFullDate(trend[index]?.trendLabel);
  };

  /*
   * Previous date for the N-th point = previousStartDate + N days.
   * Returns '' if it falls outside the previous period
   * (e.g. day 31 compared against a 30-day previous month).
   */
  const getPreviousPointDate = (index: number) => {
    if (!summary) {
      return '';
    }

    const start = extractDate(summary.previousStartDate);

    if (!start) {
      return '';
    }

    const pointDate = addDays(start, index);
    const end = extractDate(summary.previousEndDate);

    if (end && parseDate(pointDate) > parseDate(end)) {
      return '';
    }

    return formatFullDate(pointDate);
  };

  /* ======================================================= */
  /* BAD ACTORS */
  /* ======================================================= */

  const badActorData = useMemo(() => {
    return [...(data?.badActors ?? [])]
      .map((item) => ({
        name: item.sourceName,
        value: Number(item.currentAlarmCount ?? 0),
        previousValue: Number(item.previousAlarmCount ?? 0),
        change: Number(item.changePercentage ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  /* ======================================================= */
  /* CHATTERING */
  /* ======================================================= */

  const chatteringData = useMemo(() => {
    return [...(data?.chatteringAlarms ?? [])]
      .map((item) => ({
        name: item.sourceName,
        value: Number(item.currentChatteringCount ?? 0),
        previousValue: Number(item.previousChatteringCount ?? 0),
        change: Number(item.countChange ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  /* ======================================================= */
  /* STALE ALARMS */
  /* ======================================================= */

  const staleAlarmData = useMemo(() => {
    return [...(data?.standingAlarms ?? [])]
      .map((item) => ({
        name: item.sourceName,
        value: Number(item.currentStandingHours ?? 0),
        previousValue: Number(item.previousStandingHours ?? 0),
        change: Number(item.durationChangeHours ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  /* ======================================================= */
  /* COMMON HORIZONTAL BAR OPTIONS */
  /* ======================================================= */

  const createHorizontalBarOptions = (
    categories: string[],
    tooltipLabel: string
  ): ApexOptions => {
    return {
      chart: {
        type: 'bar',

        toolbar: {
          show: false,
        },

        fontFamily: 'inherit',

        animations: {
          enabled: true,
          speed: 500,
        },
      },

      states: {
        hover: {
          filter: {
            type: 'none',
          },
        },
        active: {
          filter: {
            type: 'none',
          },
        },
      },

      colors: ['#2563EB'],

      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 2,
          barHeight: '55%',
        },
      },

      dataLabels: {
        enabled: true,

        style: {
          colors: ['#e7e7e7'],
          fontSize: '13px',
          fontWeight: 500,
        },

        offsetX: -2,
      },

      grid: {
        borderColor: '#E2E8F0',
        strokeDashArray: 3,
      },

      xaxis: {
        categories,

        labels: {
          style: {
            colors: '#94A3B8',
            fontSize: '13px',
          },
        },

        axisBorder: {
          show: false,
        },

        axisTicks: {
          show: false,
        },
      },

      yaxis: {
        labels: {
          style: {
            colors: '#475569',
            fontSize: '13px',
          },
        },
      },

      tooltip: {
        theme: 'light',

        y: {
          formatter: (value: number) => `${value} ${tooltipLabel}`,
        },
      },
    };
  };

  /* ======================================================= */
  /* BAD ACTOR OPTIONS */
  /* ======================================================= */

  const badActorOptions = createHorizontalBarOptions(
    badActorData.map((item) => item.name),
    'alarms'
  );

  const badActorSeries = [
    {
      name: 'Alarm Count',
      data: badActorData.map((item) => item.value),
    },
  ];

  /* ======================================================= */
  /* CHATTERING OPTIONS */
  /* ======================================================= */

  const chatteringOptions = createHorizontalBarOptions(
    chatteringData.map((item) => item.name),
    'times'
  );

  const chatteringSeries = [
    {
      name: 'Chattering Count',
      data: chatteringData.map((item) => item.value),
    },
  ];

  /* ======================================================= */
  /* PRIORITY TREND */
  /*
   * IMPORTANT:
   * Each date gets TWO bars:
   * Current: Critical High Medium Low
   * Previous: Critical High Medium Low
   *
   * group = current / previous makes two independent
   * stacks appear side-by-side.
   *
   * BUGFIX:
   * ApexCharts' built-in plotOptions.bar.dataLabels.total
   * option does not reliably render a total label for BOTH
   * groups in a grouped + stacked bar chart (only one group's
   * total ends up visible). Instead we manually compute the
   * stack total ourselves and draw it above each stack.
   */
  /* ======================================================= */

  /* ======================================================= */
  /* PRIORITY TREND — Y AXIS HEADROOM */
  /*
   * forceNiceScale was rounding the max up to a big round number
   * (e.g. 2500 when the tallest bar was ~2043), which is what was
   * showing up as a large empty gap above the bars. We compute a
   * tighter max instead — just enough headroom for the total label.
   * ======================================================= */

  const priorityTrendMaxValue = useMemo(() => {
    const peak = Math.max(
      0,
      ...trend.map((item) => Number(item.previousTotalCount ?? 0)),
      ...trend.map((item) => Number(item.currentTotalCount ?? 0))
    );

    if (peak === 0) {
      return 100;
    }

    return Math.ceil((peak * 1.18) / 100) * 100;
  }, [trend]);

  /* ======================================================= */
  /* PRIORITY TREND — TOTAL LABELS */
  /*
   * BUGFIX 1:
   * ApexCharts' own dataLabels are unreliable on a grouped +
   * stacked bar chart, so we read the ACTUAL rendered bar geometry
   * from the chart's SVG and draw our own <text> labels above each
   * Previous/Current stack.
   *
   * BUGFIX 2 (labels misplaced after Week <-> Month switch):
   * - Chart animation is now disabled, so bar geometry is final as
   *   soon as Apex renders (before, we measured bars mid-animation).
   * - Latest data is read from trendRef (no stale closure).
   * - The sync is re-run a few times shortly after render and
   *   whenever the chart's container is resized (Week/Month changes
   *   the grid layout and therefore the chart width).
   * ======================================================= */

  const drawTrendTotalLabels = () => {
    const wrapper = trendChartWrapperRef.current;

    if (!wrapper) {
      return;
    }

    const svg = wrapper.querySelector(
      'svg.apexcharts-svg'
    ) as SVGSVGElement | null;

    if (!svg) {
      return;
    }

    const currentTrend = trendRef.current;

    const seriesGroups = svg.querySelectorAll('g.apexcharts-series');

    // A dedicated layer for our own labels, cleared and redrawn on
    // every sync so it always matches the latest render.
    let layer = svg.querySelector(
      'g.trend-total-labels-layer'
    ) as SVGGElement | null;

    if (!layer) {
      layer = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      ) as SVGGElement;

      layer.setAttribute('class', 'trend-total-labels-layer');
      layer.setAttribute('pointer-events', 'none');
      svg.appendChild(layer);
    }

    while (layer.firstChild) {
      layer.removeChild(layer.firstChild);
    }

    // Nothing to draw (or chart not fully rendered yet)
    if (currentTrend.length === 0 || seriesGroups.length < 8) {
      return;
    }

    const getBarRect = (seriesIdx: number, dataPointIndex: number) => {
      const group = seriesGroups[seriesIdx] as SVGGElement | undefined;

      if (!group) {
        return null;
      }

      const bars = group.querySelectorAll(
        'path.apexcharts-bar-area, rect.apexcharts-bar-area'
      );

      const bar = bars[dataPointIndex] as SVGGraphicsElement | undefined;

      return bar ? bar.getBoundingClientRect() : null;
    };

    // The top of a Previous/Current stack is simply whichever of its
    // 4 segments has the smallest (highest on screen) top position —
    // true regardless of which individual segments are zero.
    const getGroupTopRect = (groupStart: number, dataPointIndex: number) => {
      let top: DOMRect | null = null;

      for (let i = 0; i < 4; i += 1) {
        const rect = getBarRect(groupStart + i, dataPointIndex);

        if (rect && (!top || rect.top < top.top)) {
          top = rect;
        }
      }

      return top;
    };

    const toSvgPoint = (clientX: number, clientY: number) => {
      const point = svg.createSVGPoint();

      point.x = clientX;
      point.y = clientY;

      const ctm = svg.getScreenCTM();

      if (!ctm) {
        return { x: clientX, y: clientY };
      }

      const transformed = point.matrixTransform(ctm.inverse());

      return { x: transformed.x, y: transformed.y };
    };

    const addLabel = (rect: DOMRect | null, value: number) => {
      if (!rect || value <= 0 || !layer) {
        return;
      }

      const { x, y } = toSvgPoint(rect.left + rect.width / 2, rect.top);

      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );

      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y - 6));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', '600');
      text.setAttribute('fill', '#334155');
      text.textContent = String(Math.round(value));

      layer.appendChild(text);
    };

    currentTrend.forEach((item, dataPointIndex) => {
      const previousTop = getGroupTopRect(0, dataPointIndex);
      const currentTop = getGroupTopRect(4, dataPointIndex);

      addLabel(previousTop, Number(item.previousTotalCount ?? 0));
      addLabel(currentTop, Number(item.currentTotalCount ?? 0));
    });
  };

  const syncTrendTotalLabels = () => {
    // cancel anything still pending from an earlier render
    syncTimersRef.current.forEach((id) => window.clearTimeout(id));
    syncTimersRef.current = [];

    // Draw right after the next paint, then re-check a few times so
    // that late layout / resize changes are also picked up.
    [0, 80, 250, 600].forEach((delay) => {
      const id = window.setTimeout(() => {
        requestAnimationFrame(drawTrendTotalLabels);
      }, delay);

      syncTimersRef.current.push(id);
    });
  };

  // Re-draw the total labels whenever the underlying trend data changes
  useEffect(() => {
    syncTrendTotalLabels();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend, filters.durationType]);

  // Re-draw when the chart container changes size
  // (Week <-> Month switches the grid between 2 columns and 1 column)
  useEffect(() => {
    const wrapper = trendChartWrapperRef.current;

    if (!wrapper || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      syncTrendTotalLabels();
    });

    observer.observe(wrapper);

    return () => {
      observer.disconnect();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend.length, filters.durationType]);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      syncTimersRef.current.forEach((id) => window.clearTimeout(id));
      syncTimersRef.current = [];
    };
  }, []);

  const priorityTrendOptions: ApexOptions = {
    chart: {
      type: 'bar',
      stacked: true,

      toolbar: {
        show: false,
      },

      fontFamily: 'inherit',

      /*
       * Animations are OFF for this chart on purpose: our custom total
       * labels are positioned from the real bar geometry, which is only
       * final once the bars stop animating.
       */
      animations: {
        enabled: false,
      },

      // Draw our own total labels every time Apex (re)renders this
      // chart — see drawTrendTotalLabels for why.
      events: {
        mounted: () => syncTrendTotalLabels(),
        updated: () => syncTrendTotalLabels(),
        animationEnd: () => syncTrendTotalLabels(),
      },
    },

    /*
     * Same priority colors are preserved so Critical / High /
     * Medium / Low remain immediately recognizable.
     * Previous uses a controlled opacity instead of a very pale color.
     * Series order is Previous first, then Current.
     */
    colors: [
      PRIORITY_COLORS.critical,
      PRIORITY_COLORS.high,
      PRIORITY_COLORS.medium,
      PRIORITY_COLORS.low,
      PRIORITY_COLORS.critical,
      PRIORITY_COLORS.high,
      PRIORITY_COLORS.medium,
      PRIORITY_COLORS.low,
    ],

    fill: {
      opacity: [0.62, 0.62, 0.62, 0.62, 1, 1, 1, 1],
    },

    states: {
      hover: {
        filter: {
          type: 'none',
        },
      },
      active: {
        filter: {
          type: 'none',
        },
      },
    },

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '58%',
        borderRadius: 2,
      },
    },

    dataLabels: {
      enabled: false,
    },

    xaxis: {
      type: 'category',
      categories: trend.map((item) => formatTrendLabel(item.trendLabel)),
      tickAmount: trend.length,

      labels: getXAxisLabelOptions(),

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },
    },

    yaxis: {
      min: 0,
      max: priorityTrendMaxValue,
      tickAmount: 5,
      forceNiceScale: false,

      labels: {
        style: {
          fontSize: '13px',
          colors: '#94A3B8',
        },

        formatter: (value: number) => Math.round(value).toString(),
      },
    },

    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,

      padding: {
        top: 6,
      },
    },

    legend: {
      show: false,
    },

    tooltip: {
      shared: false,
      intersect: true,

      custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
        const seriesName: string = w?.config?.series?.[seriesIndex]?.name ?? '';

        const isPrevious = seriesName.startsWith('Previous');
        const groupLabel = isPrevious ? 'Previous' : 'Current';
        const priorityLabel = seriesName.replace(/^(Previous|Current) - /, '');

        const value = Number(series?.[seriesIndex]?.[dataPointIndex] ?? 0);

        const point = trend[dataPointIndex];

        const total = isPrevious
          ? Number(point?.previousTotalCount ?? 0)
          : Number(point?.currentTotalCount ?? 0);

        const color = w?.config?.colors?.[seriesIndex] ?? '#2563EB';

        // Both dates, hovered group is highlighted
        const previousDate = getPreviousPointDate(dataPointIndex) || '—';
        const currentDate = getCurrentPointDate(dataPointIndex) || '—';

        const previousDateStyle = isPrevious
          ? 'color:#334155; font-weight:600;'
          : 'color:#94A3B8;';

        const currentDateStyle = !isPrevious
          ? 'color:#334155; font-weight:600;'
          : 'color:#94A3B8;';

        return `
          <div style="padding:8px 10px; font-family:inherit; min-width:190px;">
            <div style="font-size:13px; margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid #E2E8F0;">
              <div style="display:flex; justify-content:space-between; gap:12px; ${previousDateStyle}">
                <span>Previous</span>
                <span>${previousDate}</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:12px; margin-top:3px; ${currentDateStyle}">
                <span>Current</span>
                <span>${currentDate}</span>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#475569;">
              <span style="width:8px; height:8px; border-radius:9999px; background:${color}; display:inline-block; flex-shrink:0;"></span>
              <span>${groupLabel} - ${priorityLabel}:</span>
              <span style="font-weight:600; color:#334155; margin-left:auto;">${value}</span>
            </div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #E2E8F0; display:flex; align-items:center; justify-content:space-between; font-size:13px; color:#334155; font-weight:600;">
              <span>Total (${groupLabel})</span>
              <span>${total}</span>
            </div>
          </div>
        `;
      },
    },
  };

  const priorityTrendSeries = [
    /* ========================= PREVIOUS STACK ========================= */
    {
      name: 'Previous - Critical',
      group: 'previous',
      data: trend.map((item) => Number(item.previousCriticalCount ?? 0)),
    },
    {
      name: 'Previous - High',
      group: 'previous',
      data: trend.map((item) => Number(item.previousHighCount ?? 0)),
    },
    {
      name: 'Previous - Medium',
      group: 'previous',
      data: trend.map((item) => Number(item.previousMediumCount ?? 0)),
    },
    {
      name: 'Previous - Low',
      group: 'previous',
      data: trend.map((item) => Number(item.previousLowCount ?? 0)),
    },

    /* ========================= CURRENT STACK ========================= */
    {
      name: 'Current - Critical',
      group: 'current',
      data: trend.map((item) => Number(item.currentCriticalCount ?? 0)),
    },
    {
      name: 'Current - High',
      group: 'current',
      data: trend.map((item) => Number(item.currentHighCount ?? 0)),
    },
    {
      name: 'Current - Medium',
      group: 'current',
      data: trend.map((item) => Number(item.currentMediumCount ?? 0)),
    },
    {
      name: 'Current - Low',
      group: 'current',
      data: trend.map((item) => Number(item.currentLowCount ?? 0)),
    },
  ];

  /* ======================================================= */
  /* PRIORITY TREND LEGEND */
  /* Previous / Current now show their date range */
  /* ======================================================= */

  const PriorityTrendLegend = () => {
    return (
      <div className="mt-2.5 space-y-2">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: PRIORITY_COLORS.high,
                opacity: 0.62,
              }}
            />
            Previous
            {previousRangeLabel && (
              <span className="text-slate-400">({previousRangeLabel})</span>
            )}
          </span>

          <span className="flex items-center gap-1.5 text-slate-600">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS.high }}
            />
            Current
            {currentRangeLabel && (
              <span className="text-slate-400">({currentRangeLabel})</span>
            )}
          </span>
        </div>

        <PriorityLegend />
      </div>
    );
  };

  /* ======================================================= */
  /* ALARM RATE TREND */
  /* Previous vs Current — SAME DATE SIDE-BY-SIDE BARS */
  /* ======================================================= */

  const alarmRateComparisonOptions: ApexOptions = {
    chart: {
      type: 'bar',

      toolbar: {
        show: false,
      },

      fontFamily: 'inherit',

      animations: {
        enabled: true,
        speed: 500,
      },
    },

    states: {
      hover: {
        filter: {
          type: 'none',
        },
      },
      active: {
        filter: {
          type: 'none',
        },
      },
    },

    colors: [ALARM_RATE_PREVIOUS_COLOR, ALARM_RATE_CURRENT_COLOR],

    fill: {
      opacity: [1, 1],
    },

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 2,

        dataLabels: {
          position: 'top',
        },
      },
    },

    dataLabels: {
      enabled: true,

      // Push the label clearly ABOVE the bar so it never touches the bar top
      offsetY: -22,

      style: {
        colors: ['#334155'],
        fontSize: '11px',
        fontWeight: 600,
      },

      background: {
        enabled: false,
      },

      formatter: (value: number) => Number(value).toFixed(0),
    },

    grid: {
      borderColor: '#E2E8F0',
      strokeDashArray: 3,

      padding: {
        top: 24,
        right: 8,
        left: 4,
      },
    },

    xaxis: {
      type: 'category',
      categories: trend.map((item) => formatTrendLabel(item.trendLabel)),
      tickAmount: trend.length,

      labels: getXAxisLabelOptions(),

      axisBorder: {
        show: false,
      },

      axisTicks: {
        show: false,
      },
    },

    yaxis: {
      min: 0,
      forceNiceScale: true,

      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '13px',
        },

        formatter: (v: number) => Math.round(v).toString(),
      },
    },

    legend: {
      show: false,
    },

    tooltip: {
      theme: 'light',
      shared: true,
      intersect: false,

      // Shows BOTH the Previous date and the Current date with values
      custom: ({ series, dataPointIndex }: any) => {
        const previousValue = Number(series?.[0]?.[dataPointIndex] ?? 0);
        const currentValue = Number(series?.[1]?.[dataPointIndex] ?? 0);

        const previousDate = getPreviousPointDate(dataPointIndex) || '—';
        const currentDate = getCurrentPointDate(dataPointIndex) || '—';

        return `
          <div style="padding:8px 10px; font-family:inherit; min-width:210px;">
            <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#475569;">
              <span style="width:8px; height:8px; border-radius:9999px; background:${ALARM_RATE_PREVIOUS_COLOR}; display:inline-block; flex-shrink:0;"></span>
              <span>Previous (${previousDate})</span>
              <span style="font-weight:600; color:#334155; margin-left:auto;">${previousValue.toFixed(0)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#475569; margin-top:5px;">
              <span style="width:8px; height:8px; border-radius:9999px; background:${ALARM_RATE_CURRENT_COLOR}; display:inline-block; flex-shrink:0;"></span>
              <span>Current (${currentDate})</span>
              <span style="font-weight:600; color:#334155; margin-left:auto;">${currentValue.toFixed(0)}</span>
            </div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #E2E8F0; font-size:12px; color:#94A3B8;">
              alarms/hour per operator
            </div>
          </div>
        `;
      },
    },
  };

  const alarmRateComparisonSeries = [
    {
      name: 'Previous',
      data: trend.map((item) => Number(item.previousAlarmRate ?? 0)),
    },
    {
      name: 'Current',
      data: trend.map((item) => Number(item.currentAlarmRate ?? 0)),
    },
  ];

  /* ======================================================= */
  /* FILTER HANDLERS */
  /* ======================================================= */

  const handleDurationChange = (type: DurationType) => {
    if (type === 'WEEK') {
      let startDate = filters.startDate;

      if (parseDate(startDate) > parseDate(maxWeeklyStartDate)) {
        startDate = maxWeeklyStartDate;
      }

      setFilters((prev) => ({
        ...prev,
        durationType: 'WEEK',
        startDate,
        endDate: addDays(startDate, 6),
      }));

      return;
    }

    /* MONTH */

    let month = filters.month;
    let year = filters.year;

    if (year > currentYear) {
      year = currentYear;
    }

    if (year === currentYear && Number(month) > currentMonth) {
      month = pad(currentMonth);
    }

    setFilters((prev) => ({
      ...prev,
      durationType: 'MONTH',
      year,
      month,
    }));
  };

  const handleWeeklyStartChange = (value: string) => {
    let startDate = value;

    if (parseDate(startDate) > parseDate(maxWeeklyStartDate)) {
      startDate = maxWeeklyStartDate;
    }

    setFilters((prev) => ({
      ...prev,
      startDate,
      endDate: addDays(startDate, 6),
    }));
  };

  const handleMonthChange = (value: string) => {
    const selectedMonth = Number(value);

    if (filters.year === currentYear && selectedMonth > currentMonth) {
      return;
    }

    setFilters((prev) => ({
      ...prev,
      month: value,
    }));
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

    if (year === currentYear && Number(month) > currentMonth) {
      month = pad(currentMonth);
    }

    setFilters((prev) => ({
      ...prev,
      year,
      month,
    }));
  };

  /* ======================================================= */
  /* RESPONSIVE LAYOUT */
  /* WEEK  -> Alarm Rate & Alarm Trend sit side-by-side */
  /* MONTH -> Alarm Rate & Alarm Trend each take full width */
  /* ======================================================= */

  const trendRowLayout =
    filters.durationType === 'WEEK' ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  /* ======================================================= */
  /* JSX */
  /* ======================================================= */

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      {/* ======================================================== */}
      {/* HEADER */}
      {/* ======================================================== */}

      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {/* LEFT */}
        <div className="flex min-w-[220px] items-center gap-2">
          <div>
            <div className="text-[18px] font-semibold text-slate-700">
              Rationalization KPI Dashboard
            </div>

            <div className="text-[12px] text-slate-400">
              Alarm Management System
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap items-center gap-3">
          {/* WEEK / MONTH TOGGLE */}
          <div className="flex h-9 overflow-hidden rounded border border-slate-300">
            {(['WEEK', 'MONTH'] as DurationType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleDurationChange(type)}
                className={`h-full border-r border-slate-300 px-3 text-[14px] font-medium transition last:border-r-0 ${
                  filters.durationType === type
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {type === 'WEEK' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* WEEK FILTER */}
          {filters.durationType === 'WEEK' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[14px] text-slate-500">Week from</label>

                <input
                  type="date"
                  min="2000-01-01"
                  max={maxWeeklyStartDate}
                  value={filters.startDate}
                  onChange={(event) =>
                    handleWeeklyStartChange(event.target.value)
                  }
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
                />
              </div>

              <span className="text-[14px] text-slate-400">to</span>

              <input
                type="date"
                value={filters.endDate}
                readOnly
                className="h-9 rounded border border-slate-300 bg-slate-50 px-2 text-[14px] text-slate-600 outline-none"
              />
            </>
          )}

          {/* MONTH FILTER */}
          {filters.durationType === 'MONTH' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[14px] text-slate-500">Month</label>

                <select
                  value={filters.month}
                  onChange={(event) => handleMonthChange(event.target.value)}
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
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
                <label className="text-[14px] text-slate-500">Year</label>

                <input
                  type="number"
                  min={2000}
                  max={currentYear}
                  value={filters.year}
                  onChange={(event) =>
                    handleYearChange(Number(event.target.value))
                  }
                  className="h-9 w-24 rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded bg-sky-600 px-3 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* ERROR */}
      {/* ======================================================== */}

      {error && (
        <div className="mt-3 border-b border-red-200 bg-red-50 px-5 py-2 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {!error && loading && !hasData && (
        <div className="mt-3 border-b border-blue-200 bg-blue-50 px-5 py-2 text-[14px] text-blue-700">
          Loading rationalization data…
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN */}
      {/* ======================================================== */}

      <main className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {/* ====================================================== */}
        {/* ROW 1 */}
        {/* BAD ACTORS | CHATTERING | STALE ALARMS */}
        {/* ====================================================== */}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
          {/* ---------------------------------------------------- */}
          {/* Bad Actors */}
          {/* ---------------------------------------------------- */}

          <SectionCard
            title="Bad Actors"
            subtitle="Top 10 alarms by source"
            className="lg:col-span-5"
          >
            {badActorData.length > 0 ? (
              <Chart
                options={badActorOptions}
                series={badActorSeries}
                type="bar"
                height={Math.max(240, badActorData.length * 28)}
              />
            ) : (
              <EmptyState message="No alarm data available" height={250} />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Chattering Alarm Tags */}
          {/* ---------------------------------------------------- */}

          <SectionCard
            title="Chattering Alarm Tags"
            subtitle="Most frequently chattering tags"
            className="lg:col-span-5"
          >
            {chatteringData.length > 0 ? (
              <Chart
                options={chatteringOptions}
                series={chatteringSeries}
                type="bar"
                height={Math.max(240, chatteringData.length * 28)}
              />
            ) : (
              <EmptyState
                message="No chattering alarms in range"
                height={250}
              />
            )}
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Stale Alarms */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Stale Alarms" className="lg:col-span-2">
            {staleAlarmData.length > 0 ? (
              <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed text-left text-[13px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="py-2.5 pr-3 font-medium">Alarm</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {staleAlarmData.map((item, index) => (
                      <tr
                        key={`${item.name}-${index}`}
                        className="text-slate-700 transition hover:bg-slate-50/70"
                      >
                        <td
                          className="truncate py-2.5 pr-3 font-medium text-[13px] text-slate-700"
                          title={item.name}
                        >
                          {item.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No stale alarms available" height={250} />
            )}
          </SectionCard>
        </div>

        {/* ====================================================== */}
        {/* ROW 2 */}
        {/* ALARM RATE | ALARM TREND */}
        {/* ====================================================== */}

        <div className={`grid grid-cols-1 gap-2 ${trendRowLayout}`}>
          {/* ---------------------------------------------------- */}
          {/* Alarm Rate */}
          {/* ---------------------------------------------------- */}

          <SectionCard title="Alarm Rate" subtitle="Previous vs Current">
            {trend.length > 0 ? (
              <Chart
                options={alarmRateComparisonOptions}
                series={alarmRateComparisonSeries}
                type="bar"
                height={280}
              />
            ) : (
              <EmptyState
                message="No alarm rate trend data available"
                height={250}
              />
            )}

            <CurrentPreviousLegend
              previousRange={previousRangeLabel}
              currentRange={currentRangeLabel}
            />
          </SectionCard>

          {/* ---------------------------------------------------- */}
          {/* Alarm Trend */}
          {/* ---------------------------------------------------- */}

          <SectionCard
            title="Alarm Trend"
            subtitle="Priority distribution - Current vs Previous"
          >
            {trend.length > 0 ? (
              <>
                <div ref={trendChartWrapperRef}>
                  {/*
                    key forces a clean re-mount when switching
                    Week <-> Month (or when the number of days changes),
                    so the custom total labels are always drawn on a
                    freshly rendered chart.
                  */}
                  <Chart
                    key={`${filters.durationType}-${trend.length}`}
                    options={priorityTrendOptions}
                    series={priorityTrendSeries}
                    type="bar"
                    height={280}
                  />
                </div>

                <PriorityTrendLegend />
              </>
            ) : (
              <EmptyState
                message="No priority trend data available"
                height={250}
              />
            )}
          </SectionCard>
        </div>
      </main>
    </div>
  );
};

export default RationalizationKpiDashboard;
