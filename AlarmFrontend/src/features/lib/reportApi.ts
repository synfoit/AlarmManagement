import { createCrudApi } from '../lib/createCrudApi';

const AlarmReportApi = createCrudApi('AlarmReport');
const CollectorApi = createCrudApi('collector-configs');

/* ================================================================== */
/*  CONNECTOR (COLLECTOR)                                             */
/*  GET collector-configs/data?includeInactive=true -> dropdown data  */
/*  Selected connector's id + name go to EVERY report API as          */
/*  CollectionId + CollectionName.                                    */
/* ================================================================== */

export interface Collector {
  collectorId: number;
  collectorName: string;
}

export interface CollectorFilter {
  collectorId?: number;
  collectorName?: string;
}

function appendCollectorParams(
  params: URLSearchParams,
  filter: CollectorFilter
) {
  if (filter.collectorId !== undefined && filter.collectorId !== null) {
    params.set('CollectionId', String(filter.collectorId));
  }
  if (filter.collectorName) {
    params.set('CollectionName', filter.collectorName);
  }
}

export async function getCollectors(): Promise<Collector[]> {
  const response = await CollectorApi.get<Collector[]>(
    'data?includeInactive=true'
  );
  return response.data ?? [];
}

/* ================================================================== */
/*  PLANT / AREA / CONSOLE                                            */
/*  GET AlarmReport/GetPlantAreaConsole -> dropdown data              */
/*  The list only has NAMES (no ids), so the selected names are sent  */
/*  as plantName / areaName / consoleName query params. If your       */
/*  backend expects ids instead, change ONLY appendLocationParams().  */
/* ================================================================== */

export interface PlantAreaConsole {
  plantName: string;
  areas: { areaName: string; consoles: string[] }[];
}

export interface LocationFilter {
  plantName?: string;
  areaName?: string;
  consoleName?: string;
}

function appendLocationParams(params: URLSearchParams, filter: LocationFilter) {
  if (filter.plantName) {
    params.set('plantName', filter.plantName);
  }
  if (filter.areaName) {
    params.set('areaName', filter.areaName);
  }
  if (filter.consoleName) {
    params.set('consoleName', filter.consoleName);
  }
}

export async function getPlantAreaConsole(): Promise<PlantAreaConsole[]> {
  const response = await AlarmReportApi.get<PlantAreaConsole[]>(
    'GetPlantAreaConsole'
  );
  return response.data ?? [];
}

/* ================================================================== */
/*  SMALL HELPERS                                                     */
/* ================================================================== */

type PeriodKind = 'daily' | 'weekly' | 'monthly' | 'custom';

interface DateRangeQuery {
  periodType: PeriodKind;
  startDate: string;
  endDate: string;
}

/**
 * ONE place for the date params of EVERY report.
 * Daily  -> ONLY StartDate is sent (EndDate is NOT sent).
 * Others -> StartDate + EndDate.
 */
function setDateParams(params: URLSearchParams, query: DateRangeQuery) {
  params.set('StartDate', query.startDate);
  if (query.periodType !== 'daily') {
    params.set('EndDate', query.endDate);
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** 2025-09-26T05:28:36.223 -> 26-Sep-2025 05:28:36 */
function formatStamp(iso?: string | null): string {
  if (!iso) {
    return '-';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return `${pad2(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 768.3 hours -> 768:18:00 (hours can exceed 24, so no day rollover) */
function hoursToDuration(hours?: number | null): string {
  const totalSeconds = Math.max(0, Math.round((hours ?? 0) * 3600));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-');
  return y && m && d ? `${d}/${m}/${y}` : key;
}

/** Every date (YYYY-MM-DD) from start to end, inclusive (max 366) */
function listDates(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(sy, (sm || 1) - 1, sd || 1);
  const last = new Date(ey, (em || 1) - 1, ed || 1);
  const out: string[] = [];
  while (cur <= last && out.length < 366) {
    out.push(
      `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Response can be an array, or { data: [...] } */
function unwrapList<T>(body: unknown): T[] {
  if (Array.isArray(body)) {
    return body as T[];
  }
  const inner = (body as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

/* Common query for the range based reports */
export interface ReportRangeQuery extends LocationFilter, CollectorFilter {
  periodType: PeriodKind;
  startDate: string;
  endDate: string;
}

/* ================================================================== */
/*  TOP 10 BAD ACTORS                                                 */
/* ================================================================== */

export interface Top10BadActorsQuery extends CollectorFilter {
  periodType: PeriodKind;
  startDate: string;
  endDate: string;
}

export interface Top10BadActorItem {
  id: number;
  rankNo: number;
  tagName: string;
  priority: number;
  count: number;
  percent: number;
}

interface Top10BadActorsApiRow {
  sourceName: string;
  priority: number;
  alarmCount: number;
  percentOfTotal: number;
  rankNo: number;
  totalAlarms: number;
  top10ContributionPercent: number;
}

interface Top10BadActorsApiResponse {
  startDate: string;
  endDate: string;
  rangeType: string;
  totalAlarms: number;
  top10ContributionPercent: number;
  rows: Top10BadActorsApiRow[];
}

export async function getTop10BadActorsReport(
  query: Top10BadActorsQuery
): Promise<Top10BadActorItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<Top10BadActorsApiResponse>(
    `top-bad-actors?${params.toString()}`
  );

  const rows = response.data?.rows ?? [];
  return rows.map((item) => ({
    id: item.rankNo,
    rankNo: item.rankNo,
    tagName: item.sourceName,
    priority: item.priority,
    count: item.alarmCount,
    percent: item.percentOfTotal,
  }));
}

/* ================================================================== */
/*  ALARM RATE                                                        */
/*  consoleWise/areaWise/plantWise are ignored; only "overall".       */
/* ================================================================== */

export type AlarmRateQuery = ReportRangeQuery;

export interface AlarmRateItem {
  hour: string;
  alarmCount: number;
  alarmRate: number;
  alarmRatePer10Min: number;
}

interface AlarmRateApiRow {
  hourNo: number;
  hourRange: string;
  alarmCount: number;
  alarmRatePerHour: number;
}

interface AlarmRateApiResponse {
  consoleWise: unknown[];
  areaWise: unknown[];
  plantWise: unknown[];
  overall: AlarmRateApiRow[];
}

export async function getAlarmRateReport(
  query: AlarmRateQuery
): Promise<AlarmRateItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<AlarmRateApiResponse>(
    `AlarmRateReport?${params.toString()}`
  );

  const rows = response.data?.overall ?? [];
  return rows.map((item) => ({
    hour: item.hourRange,
    alarmCount: item.alarmCount,
    alarmRate: item.alarmRatePerHour,
    alarmRatePer10Min: Number((item.alarmRatePerHour / 6).toFixed(2)),
  }));
}

/* ================================================================== */
/*  CHATTERING ALARM                                                  */
/*  The raw episode list ("allChatteringAlarms") is grouped by        */
/*  sourceName; chatteringCount = number of chatter episodes.         */
/* ================================================================== */

export type ChatteringAlarmQuery = ReportRangeQuery;

export interface ChatteringAlarmItem {
  sourceName: string;
  chatteringCount: number;
}

interface ChatteringAlarmApiRow {
  sourceName: string;
  conditionName: string;
  chatterStartTime: string;
  chatterEndTime: string;
  durationSeconds: number;
  alarmCount: number;
}

interface ChatteringAlarmApiResponse {
  consoleWise: unknown[];
  areaWise: unknown[];
  plantWise: unknown[];
  allChatteringAlarms: ChatteringAlarmApiRow[];
}

export async function getChatteringAlarmReport(
  query: ChatteringAlarmQuery
): Promise<ChatteringAlarmItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<ChatteringAlarmApiResponse>(
    `GetChatteringAlarmReport?${params.toString()}`
  );

  const rows = response.data?.allChatteringAlarms ?? [];

  // sourceName -> number of chatter episodes
  const countBySource = new Map<string, number>();
  rows.forEach((row) => {
    countBySource.set(
      row.sourceName,
      (countBySource.get(row.sourceName) ?? 0) + 1
    );
  });

  return Array.from(countBySource.entries())
    .map(([sourceName, chatteringCount]) => ({ sourceName, chatteringCount }))
    .sort((a, b) => b.chatteringCount - a.chatteringCount);
}

/* ================================================================== */
/*  STANDING (STALE) ALARM                                            */
/*  Response: { success, message, data: { summary, allStaleAlarms } } */
/*  No "priority" field -> '-', stale status goes into "comment".     */
/* ================================================================== */

export type StandingAlarmQuery = ReportRangeQuery;

export interface StandingAlarmItem {
  eventstamp: string;
  tagName: string;
  comment: string;
  alarmType: string;
  priority: string;
  duration: string;
}

interface StaleAlarmApiRow {
  eventID: string;
  sourceName: string;
  conditionName: string;
  subConditionName: string;
  alarmStartTime: string;
  alarmClearTime: string | null;
  stillActive: boolean;
  hoursActive: number;
  staleStatus: string;
}

interface StaleAlarmApiPayload {
  consoleWise?: unknown[];
  areaWise?: unknown[];
  plantWise?: unknown[];
  summary?: unknown;
  allStaleAlarms?: StaleAlarmApiRow[];
}

interface StaleAlarmApiResponse extends StaleAlarmApiPayload {
  success?: boolean;
  message?: string;
  data?: StaleAlarmApiPayload;
}

export async function getStandingAlarmReport(
  query: StandingAlarmQuery
): Promise<StandingAlarmItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<StaleAlarmApiResponse>(
    `GetStadingAlarmReport?${params.toString()}`
  );

  const body = response.data;
  // response can be { data: {...} } or the payload directly
  const payload: StaleAlarmApiPayload = body?.data ?? body ?? {};
  const rows = payload.allStaleAlarms ?? [];

  return rows.map((item) => ({
    eventstamp: formatStamp(item.alarmStartTime),
    tagName: item.sourceName,
    comment: item.staleStatus ?? '',
    alarmType: item.conditionName ?? item.subConditionName ?? '',
    priority: '-',
    duration: hoursToDuration(item.hoursActive),
  }));
}

/* ================================================================== */
/*  ALARM FLOOD                                                       */
/*  Each flood EVENT becomes one "block" row:                         */
/*    gdsOp = floodAlarmCount, sruOp = peakAlarmCount                 */
/* ================================================================== */

export type AlarmFloodQuery = ReportRangeQuery;

export interface AlarmFloodBlock {
  blockTime: string;
  gdsOp: number;
  sruOp: number;
  // extra real-API fields (optional, page may ignore them)
  floodEventId?: number;
  floodStart?: string;
  floodEnd?: string;
  durationMinutes?: number;
  floodedBuckets?: number;
  floodAlarmCount?: number;
  peakAlarmCount?: number;
  peakAlarmRatePerHour?: number;
  floodConditionPercentage?: number;
}

export interface AlarmFloodData {
  percentTimeInDuration: number;
  peakAlarmRate: number;
  averageAlarmRate: number;
  blocks: AlarmFloodBlock[];
}

interface FloodApiRow {
  floodEventID: number;
  floodStart: string;
  floodEnd: string;
  durationMinutes: number;
  floodedBuckets: number;
  floodAlarmCount: number;
  peakAlarmCount: number;
  peakAlarmRatePerHour: number;
  floodConditionPercentage: number;
}

interface FloodApiPayload {
  hierarchy?: unknown[];
  overall?: FloodApiRow[];
}

interface FloodApiResponse extends FloodApiPayload {
  success?: boolean;
  message?: string;
  data?: FloodApiPayload;
}

export async function getAlarmFloodReport(
  query: AlarmFloodQuery
): Promise<AlarmFloodData> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<FloodApiResponse>(
    `GetFloodAlarmreport?${params.toString()}`
  );

  const body = response.data;
  // response can be top-level or wrapped in { data: {...} }
  const payload: FloodApiPayload = body?.overall ? body : (body?.data ?? {});
  const events = payload.overall ?? [];

  const totalPercent = events.reduce(
    (sum, e) => sum + (e.floodConditionPercentage ?? 0),
    0
  );
  const peakAlarmRate = events.reduce(
    (max, e) => Math.max(max, e.peakAlarmRatePerHour ?? 0),
    0
  );
  const totalAlarms = events.reduce(
    (sum, e) => sum + (e.floodAlarmCount ?? 0),
    0
  );
  const totalMinutes = events.reduce(
    (sum, e) => sum + (e.durationMinutes ?? 0),
    0
  );

  // average alarm rate (per hour) while the system was in flood
  const averageAlarmRate = totalMinutes
    ? Number((totalAlarms / (totalMinutes / 60)).toFixed(2))
    : 0;

  const blocks: AlarmFloodBlock[] = events.map((e) => ({
    blockTime: formatStamp(e.floodStart),
    gdsOp: e.floodAlarmCount ?? 0,
    sruOp: e.peakAlarmCount ?? 0,
    floodEventId: e.floodEventID,
    floodStart: e.floodStart,
    floodEnd: e.floodEnd,
    durationMinutes: e.durationMinutes,
    floodedBuckets: e.floodedBuckets,
    floodAlarmCount: e.floodAlarmCount,
    peakAlarmCount: e.peakAlarmCount,
    peakAlarmRatePerHour: e.peakAlarmRatePerHour,
    floodConditionPercentage: e.floodConditionPercentage,
  }));

  return {
    percentTimeInDuration: Number(totalPercent.toFixed(2)),
    peakAlarmRate,
    averageAlarmRate,
    blocks,
  };
}

/* ================================================================== */
/*  ALARM PRIORITY DISTRIBUTION                                       */
/*  Same events come back 4 times (Overall / Plant / Area / Console)  */
/*  so only ONE level is used:                                        */
/*    nothing selected -> Overall                                     */
/*    plant selected   -> Plant   (name = plantName)                  */
/*    area selected    -> Area    (name = areaName)                   */
/*    console selected -> Console (name = consoleName)                */
/*  Grouping: daily -> 24 hourly rows, otherwise one row per date.    */
/*  Priority: 1 Critical, 2 High, 3 Medium, 4 Low                     */
/* ================================================================== */

export type AlarmPriorityQuery = ReportRangeQuery;

export interface AlarmPriorityItem {
  slot: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  criticalPct: number;
  highPct: number;
  mediumPct: number;
  lowPct: number;
}

interface PriorityApiRow {
  reportLevel?: string;
  name?: string;
  priority?: number;
  priorityName?: string;
  sourceName?: string;
  eventTimeStamp: string;
}

type PriorityKey = 'critical' | 'high' | 'medium' | 'low';

function toPriorityKey(row: PriorityApiRow): PriorityKey | null {
  switch (row.priority) {
    case 1:
      return 'critical';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
      return 'low';
    default:
      break;
  }
  const name = (row.priorityName ?? '').toLowerCase();
  if (name === 'critical' || name === 'high' || name === 'medium') {
    return name;
  }
  return name === 'low' ? 'low' : null;
}

function pickLevel(filter: LocationFilter): { level: string; name?: string } {
  if (filter.consoleName) {
    return { level: 'Console', name: filter.consoleName };
  }
  if (filter.areaName) {
    return { level: 'Area', name: filter.areaName };
  }
  if (filter.plantName) {
    return { level: 'Plant', name: filter.plantName };
  }
  return { level: 'Overall' };
}

export async function getAlarmPriorityReport(
  query: AlarmPriorityQuery
): Promise<AlarmPriorityItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<unknown>(
    `PriorityReport?${params.toString()}`
  );

  const allRows = unwrapList<PriorityApiRow>(response.data);
  const { level, name } = pickLevel(query);
  const rows = allRows.filter(
    (r) =>
      !r.reportLevel || (r.reportLevel === level && (!name || r.name === name))
  );

  const hourly =
    query.periodType === 'daily' || query.startDate === query.endDate;

  // bucket key -> counts
  const buckets = new Map<string, Record<PriorityKey, number>>();
  const emptyBucket = (): Record<PriorityKey, number> => ({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });

  // pre-fill so empty hours / days also appear on the chart
  if (hourly) {
    for (let h = 0; h < 24; h++) {
      buckets.set(pad2(h), emptyBucket());
    }
  } else {
    listDates(query.startDate, query.endDate).forEach((d) =>
      buckets.set(d, emptyBucket())
    );
  }

  rows.forEach((row) => {
    const key = toPriorityKey(row);
    if (!key || !row.eventTimeStamp) {
      return;
    }
    // "2026-09-26T19:09:11.57" -> hour "19" | date "2026-09-26"
    const bucketKey = hourly
      ? row.eventTimeStamp.slice(11, 13)
      : row.eventTimeStamp.slice(0, 10);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, emptyBucket());
    }
    const bucket = buckets.get(bucketKey);
    if (bucket) {
      bucket[key] += 1;
    }
  });

  const pct = (part: number, total: number) =>
    total ? Number(((part / total) * 100).toFixed(2)) : 0;

  return Array.from(buckets.keys())
    .sort()
    .map((bucketKey) => {
      const b = buckets.get(bucketKey) ?? emptyBucket();
      const total = b.critical + b.high + b.medium + b.low;
      return {
        slot: hourly ? `${bucketKey}:00` : formatDateKey(bucketKey),
        critical: b.critical,
        high: b.high,
        medium: b.medium,
        low: b.low,
        total,
        criticalPct: pct(b.critical, total),
        highPct: pct(b.high, total),
        mediumPct: pct(b.medium, total),
        lowPct: pct(b.low, total),
      };
    });
}

/* ================================================================== */
/*  ALL TAG REPORT  (TABLE ONLY, no chart)                            */
/*  Endpoint: GET AlarmReport/AllTagReport                            */
/*  Response: { success, count, data: [ alarm EVENTS ] }              */
/*  Every event = one table row (no grouping). Columns:               */
/*    Plant, Area, Console, Source Name, Priority, Message,           */
/*    Active, Ack.                                                    */
/* ================================================================== */

export type AllTagQuery = ReportRangeQuery;

export interface AllTagItem {
  plantName: string;
  areaName: string;
  consoleName: string;
  sourceName: string;
  priority: string;
  message: string;
  active: string;
  acked: string;
}

interface AllTagApiRow {
  plantName?: string;
  areaName?: string;
  consoleName?: string;
  sourceName?: string;
  priority?: number | string;
  message?: string;
  active?: boolean;
  acked?: boolean;
  eventTimeStamp?: string;
}

const yesNo = (v?: boolean) => (v ? 'Yes' : 'No');

export async function getAllTagReport(
  query: AllTagQuery
): Promise<AllTagItem[]> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendLocationParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<unknown>(
    `AllTagReport?${params.toString()}`
  );

  return unwrapList<AllTagApiRow>(response.data)
    .filter(
      (r) =>
        (!query.plantName || !r.plantName || r.plantName === query.plantName) &&
        (!query.areaName || !r.areaName || r.areaName === query.areaName) &&
        (!query.consoleName ||
          !r.consoleName ||
          r.consoleName === query.consoleName)
    )
    .map((r) => ({
      plantName: r.plantName ?? '-',
      areaName: r.areaName ?? '-',
      consoleName: r.consoleName ?? '-',
      sourceName: r.sourceName ?? '-',
      priority: r.priority !== undefined ? String(r.priority) : '-',
      message: r.message ?? '-',
      active: yesNo(r.active),
      acked: yesNo(r.acked),
    }));
}

/* ================================================================== */
/*  KPI REPORT                                                        */
/*  Response: kpi, top10BadActors, chatteringAlarms,                  */
/*            standingStaleAlarms, alarmRate                          */
/*  No plant/area/console filter for this one (connector only).       */
/* ================================================================== */

export interface KpiQuery extends CollectorFilter {
  periodType: PeriodKind;
  startDate: string;
  endDate: string;
}

export interface KpiSummaryItem {
  kpi: string;
  target: string;
  asFound: number;
  evaluation: 'Critical' | 'Acceptable' | 'Manageable' | string;
}

export interface KpiTopActorItem {
  rankNo: number;
  tagName: string;
  alarmCount: number;
}

export interface KpiChatteringItem {
  tagName: string;
  chatteringCount: number;
}

export interface KpiStandingItem {
  tagName: string;
  startTime: string;
  clearTime: string;
  duration: string;
  tier: string;
}

export interface KpiAlarmRateItem {
  hour: string;
  alarmCount: number;
}

export interface KpiReportData {
  kpi: KpiSummaryItem[];
  topActors: KpiTopActorItem[];
  chattering: KpiChatteringItem[];
  standing: KpiStandingItem[];
  alarmRate: KpiAlarmRateItem[];
}

interface KpiApiRow {
  kpi: string;
  target: string;
  asFound: number;
  evaluation: string;
}

interface KpiApiPayload {
  kpi?: KpiApiRow[];
  top10BadActors?: { sourceName: string; alarmCount: number }[];
  chatteringAlarms?: { sourceName: string; chatteringCount: number }[];
  standingStaleAlarms?: {
    sourceName: string;
    alarmStartTime: string;
    alarmClearTime: string | null;
    hoursActive: number;
    tier?: string;
  }[];
  alarmRate?: { hourStart: string; hourEnd: string; alarmCount: number }[];
}

interface KpiApiResponse extends KpiApiPayload {
  data?: KpiApiPayload;
}

export async function getAlarmKpiReport(
  query: KpiQuery
): Promise<KpiReportData> {
  const params = new URLSearchParams();
  setDateParams(params, query);
  appendCollectorParams(params, query);

  const response = await AlarmReportApi.get<KpiApiResponse>(
    `GetAlarmKPIReport?${params.toString()}`
  );

  const body = response.data;
  // response can be top-level or wrapped in { data: {...} }
  const payload: KpiApiPayload = body?.kpi ? body : (body?.data ?? {});

  return {
    kpi: (payload.kpi ?? []).map((item) => ({
      kpi: item.kpi,
      target: item.target,
      asFound: Number(item.asFound ?? 0),
      evaluation: item.evaluation,
    })),
    topActors: (payload.top10BadActors ?? []).map((item, i) => ({
      rankNo: i + 1,
      tagName: item.sourceName,
      alarmCount: item.alarmCount,
    })),
    chattering: (payload.chatteringAlarms ?? []).map((item) => ({
      tagName: item.sourceName,
      chatteringCount: item.chatteringCount,
    })),
    standing: (payload.standingStaleAlarms ?? []).map((item) => ({
      tagName: item.sourceName,
      startTime: formatStamp(item.alarmStartTime),
      clearTime: formatStamp(item.alarmClearTime),
      duration: hoursToDuration(item.hoursActive),
      tier: item.tier ?? '-',
    })),
    // "2025-09-29T05:00:00" -> "05:00 - 06:00"
    alarmRate: (payload.alarmRate ?? []).map((item) => ({
      hour: `${item.hourStart.slice(11, 16)} - ${item.hourEnd.slice(11, 16)}`,
      alarmCount: item.alarmCount,
    })),
  };
}
