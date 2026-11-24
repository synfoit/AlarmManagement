// src/pages/ParsingConfig.tsx

import React, { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { createCrudApi } from '../features/lib/createCrudApi';
import { DataTable } from '../components/DataTable';
// adjust this path to wherever your SelectDropdown file lives
import SelectDropdown, { type Option } from '../features/ui/SelectDropdown';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

// Must match the "case" strings in the backend ApplyRule(...)
type RuleType =
  | 'Keep'
  | 'Trim'
  | 'Uppercase'
  | 'Lowercase'
  | 'DefaultIfEmpty'
  | 'ConvertDateTime'
  | 'ConvertInt'
  | 'ConvertBoolean'
  | 'Lookup'
  | 'Concat'
  | 'GMTtoIST';

// Same shape as backend RuleDto { Type, Parameters }
interface Rule {
  type: RuleType;
  parameters: Record<string, string>;
}

interface Collector {
  collectorId: number;
  collectorName: string;
}

interface ApiColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
}

interface TargetField {
  targetFieldId: number;
  targetFieldName: string;
  isActive: boolean;
}

interface LookupDetail {
  id: number;
  sourceValue: string;
  targetValue: string;
}

interface LookupTable {
  id: number;
  lookupName: string;
  description: string;
  isActive: boolean;
  details: LookupDetail[];
}

interface SourceColumn {
  name: string;
  type: string;
  nullable: boolean;
  selected: boolean;
}

// Each source column has exactly ONE rule
interface Mapping {
  id: number;
  source: string;
  target: string;
  rule: Rule;
}

interface LookupRow {
  id: number;
  key: string;
  value: string;
}

// "error" blocks saving, "warn" is only shown
interface ValidationCheck {
  level: 'error' | 'warn';
  ok: boolean;
  pass: string;
  fail: string;
}

/* ---- Saved configuration (GET /api/etl/getConfigurations) ---- */

interface SavedMapping {
  sourceColumn: string;
  targetColumn: string;
  rules: Rule[];
}

interface SavedConfig {
  id: number;
  collectorId: number;
  collectorName: string;
  incrementalLoad: boolean;
  watermarkColumn: string;
  mappings: SavedMapping[];
}

// table row = saved config + computed fields (so DataTable can sort them)
interface SavedConfigRow extends SavedConfig {
  loadType: string;
  mappingCount: number;
  rulesApplied: string;
  actions?: string;
}

// POST /api/EtlExecution/{id}/run response
interface EtlRunResponse {
  success: boolean;
  message: string;
}

// POST /api/etl/preview  body: { configurationId, sampleSize }
// response: { totalRows, rows, errors }
type PreviewRow = Record<string, unknown>;

interface PreviewResponse {
  totalRows: number;
  rows: PreviewRow[];
  errors: unknown[];
}

/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */

const RESOURCE_NAME = 'collector-configs';
const TARGET_FIELD_RESOURCE = 'TargetField';
// createCrudApi prefixes /api, so these resolve to /api/etl/...
const LOOKUP_RESOURCE = 'etl/lookup-tables';
const CONFIG_RESOURCE = 'etl/configurations';
const ETL_RESOURCE = 'etl'; // -> GET /api/etl/getConfigurations
//                              -> POST /api/etl/preview
// -> POST /api/EtlExecution/{id}/run
const ETL_EXECUTION_RESOURCE = 'EtlExecution';

// If your backend has PUT /api/etl/configurations/{id} for updates, set true.
// false = POST /api/etl/configurations with the existing id (upsert style).
const USE_PUT_FOR_UPDATE = false;

const PAGE_SIZE = 10;
const DEFAULT_SAMPLE_SIZE = 10;

const STEPS = [
  'Select Source',
  'Map Columns',
  'Configure Rules',
  'Preview & Validate',
  'Save Configuration',
];

const CURRENT_STEP = 2;

const RULE_META: Record<RuleType, { label: string; classes: string }> = {
  Keep: {
    label: 'Keep value',
    classes: 'border-slate-200 bg-slate-50 text-slate-500',
  },
  Trim: {
    label: 'Trim',
    classes: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  Uppercase: {
    label: 'Uppercase',
    classes: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  Lowercase: {
    label: 'Lowercase',
    classes: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  DefaultIfEmpty: {
    label: 'Default if empty',
    classes: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  ConvertDateTime: {
    label: 'Convert to DateTime',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  ConvertInt: {
    label: 'Convert to Integer',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  ConvertBoolean: {
    label: 'Convert to Boolean',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  Lookup: {
    label: 'Lookup (Mapping)',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  Concat: {
    label: 'Concat',
    classes: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  GMTtoIST: {
    label: 'Convert GMT to IST',
    classes: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const RULE_TYPES = Object.keys(RULE_META) as RuleType[];

const KEEP_RULE: Rule = { type: 'Keep', parameters: {} };

/* ------------------------------------------------------------------ */
/* Rule Engine (client-side mirror of backend ApplyRule, for preview) */
/* ------------------------------------------------------------------ */

function isNullish(v: unknown) {
  return v === null || v === undefined;
}

function bankersRound(n: number) {
  const f = Math.floor(n);
  const diff = n - f;

  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;

  return f % 2 === 0 ? f : f + 1;
}

function applyRule(value: unknown, rule: Rule): unknown {
  const parameters = rule.parameters ?? {};

  switch (rule.type) {
    case 'Keep':
      return value;

    case 'Trim':
      return typeof value === 'string' ? value.trim() : value;

    case 'Uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;

    case 'Lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;

    case 'DefaultIfEmpty':
      return isNullish(value) || String(value).trim() === ''
        ? (parameters.value ?? null)
        : value;

    case 'ConvertDateTime': {
      if (isNullish(value)) return null;
      if (value instanceof Date) return value;

      const parsed = new Date(String(value));

      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Cannot convert '${value}' to DateTime.`);
      }

      return parsed;
    }

    case 'ConvertInt': {
      if (isNullish(value)) return null;

      let result: number;

      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          throw new Error(`Cannot convert '${value}' to Int32.`);
        }

        result = bankersRound(value);
      } else if (typeof value === 'boolean') {
        result = value ? 1 : 0;
      } else {
        const text = String(value).trim();

        if (!/^[+-]?\d+$/.test(text)) {
          throw new Error(`Cannot convert '${value}' to Int32.`);
        }

        result = parseInt(text, 10);
      }

      if (result < -2147483648 || result > 2147483647) {
        throw new Error(`Value '${value}' is out of range for Int32.`);
      }

      return result;
    }

    case 'ConvertBoolean': {
      if (isNullish(value)) return null;
      if (typeof value === 'boolean') return value;

      const text = String(value).trim().toLowerCase();

      if (text === '1' || text === 'true' || text === 'yes') return true;
      if (text === '0' || text === 'false' || text === 'no') return false;

      throw new Error(`Cannot convert '${value}' to Boolean.`);
    }

    case 'Lookup': {
      const key = isNullish(value) ? '' : String(value);

      if (Object.prototype.hasOwnProperty.call(parameters, key)) {
        return parameters[key];
      }

      throw new Error(`No lookup mapping exists for '${key}'.`);
    }

    case 'Concat':
      return `${isNullish(value) ? '' : String(value)}${parameters.suffix ?? ''}`;

    default:
      throw new Error(
        `Parsing rule '${(rule as Rule).type}' is not supported.`
      );
  }
}

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

let idCounter = 1000;
const uid = () => ++idCounter;

const inputClass =
  'h-9 w-full rounded border border-slate-300 bg-white px-2 text-[14px] text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60';

// pulls the most useful message out of an axios-style or plain error
function errorMessage(err: unknown, fallback: string): string {
  const e = err as {
    message?: string;
    response?: { data?: unknown };
  };

  const data = e?.response?.data;

  if (typeof data === 'string' && data) return data;

  if (data && typeof data === 'object') {
    const d = data as { message?: string; title?: string };

    return d.message ?? d.title ?? e.message ?? fallback;
  }

  return e?.message ?? fallback;
}

// accepts both a plain array and a { data: [...] } wrapper
function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const inner = (payload as { data?: unknown } | null | undefined)?.data;

  return Array.isArray(inner) ? (inner as T[]) : [];
}

// getConfigurations can return: [..], { data: [..] }, { data: {..} } or a
// single {..} object. All of them are turned into an array of configs.
function asConfigList(payload: unknown): Partial<SavedConfig>[] {
  if (Array.isArray(payload)) return payload as Partial<SavedConfig>[];

  if (!payload || typeof payload !== 'object') return [];

  const obj = payload as Record<string, unknown>;

  for (const key of ['data', 'items', 'result', 'results', 'configurations']) {
    const inner = obj[key];

    if (Array.isArray(inner)) return inner as Partial<SavedConfig>[];

    if (inner && typeof inner === 'object') {
      return [inner as Partial<SavedConfig>];
    }
  }

  // the payload itself is one configuration
  if ('mappings' in obj || 'collectorId' in obj) {
    return [obj as Partial<SavedConfig>];
  }

  return [];
}

// pulls the saved configuration's id out of the save response.
// Supports: { id }, { data: { id } }, { data: [{ id }] }, [{ id }]
function extractConfigId(payload: unknown): number | null {
  if (!payload) return null;

  const first = Array.isArray(payload) ? payload[0] : payload;

  if (!first || typeof first !== 'object') return null;

  const obj = first as Record<string, unknown>;

  if (obj.id !== undefined && obj.id !== null && Number(obj.id) > 0) {
    return Number(obj.id);
  }

  if (obj.data !== undefined && obj.data !== payload) {
    return extractConfigId(obj.data);
  }

  return null;
}

// normalises the preview response: { totalRows, rows, errors }
// (also tolerates a { data: {...} } wrapper or a bare array of rows)
function normalizePreview(payload: unknown): PreviewResponse {
  if (Array.isArray(payload)) {
    return {
      totalRows: payload.length,
      rows: payload as PreviewRow[],
      errors: [],
    };
  }

  if (!payload || typeof payload !== 'object') {
    return { totalRows: 0, rows: [], errors: [] };
  }

  const obj = payload as Record<string, unknown>;

  if (
    !('rows' in obj) &&
    obj.data &&
    typeof obj.data === 'object' &&
    !Array.isArray(obj.data)
  ) {
    return normalizePreview(obj.data);
  }

  const rows = Array.isArray(obj.rows) ? (obj.rows as PreviewRow[]) : [];

  return {
    totalRows: Number(obj.totalRows ?? rows.length),
    rows,
    errors: Array.isArray(obj.errors) ? obj.errors : [],
  };
}

// every column that appears in any preview row, in first-seen order
function previewColumnKeys(rows: PreviewRow[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    });
  });

  return keys;
}

function isOriginalKey(key: string) {
  return key.startsWith('Original_');
}

function errorText(e: unknown): string {
  if (typeof e === 'string') return e;

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// one preview cell (whitespace is kept visible so Trim results are obvious)
function PreviewCellValue({ value }: { value: unknown }): JSX.Element {
  if (value === null || value === undefined) {
    return <span className="text-slate-300">—</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          value
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {value ? 'Yes' : 'No'}
      </span>
    );
  }

  if (typeof value === 'object') {
    return <span className="whitespace-pre">{errorText(value)}</span>;
  }

  return <span className="whitespace-pre">{String(value)}</span>;
}

function ruleLabel(rule: Rule) {
  const base = RULE_META[rule.type].label;

  if (rule.type === 'DefaultIfEmpty') {
    return `${base}: "${rule.parameters.value ?? ''}"`;
  }

  if (rule.type === 'Concat') {
    return `${base}: "${rule.parameters.suffix ?? ''}"`;
  }

  if (rule.type === 'Lookup') {
    return `${base} (${Object.keys(rule.parameters).length})`;
  }

  return base;
}

// backend rule -> client Rule (case-insensitive type, null-safe parameters)
function normalizeRule(raw?: Partial<Rule> | null): Rule {
  const rawType = String(raw?.type ?? '').toLowerCase();

  const type = RULE_TYPES.find((t) => t.toLowerCase() === rawType);

  if (!type) return { ...KEEP_RULE, parameters: {} };

  const parameters: Record<string, string> = {};

  Object.entries(raw?.parameters ?? {}).forEach(([k, v]) => {
    parameters[k] = v === null || v === undefined ? '' : String(v);
  });

  return { type, parameters };
}

// makes sure every saved config coming from the API has safe arrays
function normalizeConfig(raw: Partial<SavedConfig>): SavedConfig {
  return {
    id: Number(raw.id ?? 0),
    collectorId: Number(raw.collectorId ?? 0),
    collectorName: raw.collectorName ?? '',
    incrementalLoad: Boolean(raw.incrementalLoad),
    watermarkColumn: raw.watermarkColumn ?? '',
    mappings: (raw.mappings ?? []).map((m) => ({
      sourceColumn: m.sourceColumn ?? '',
      targetColumn: m.targetColumn ?? '',
      rules: (m.rules ?? []).map((r) => normalizeRule(r)),
    })),
  };
}

// non-Keep rule types used in a saved config, with counts
function ruleSummary(cfg: SavedConfig): { type: RuleType; count: number }[] {
  const counts = new Map<RuleType, number>();

  cfg.mappings.forEach((m) => {
    const r = m.rules[0];

    if (r && r.type !== 'Keep') {
      counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    }
  });

  return Array.from(counts.entries()).map(([type, count]) => ({
    type,
    count,
  }));
}

// Sample values (4 rows) generated from the SQL data type, used for validation
function sampleFor(dataType: string, nullable: boolean): unknown[] {
  const t = dataType.toLowerCase();

  let values: unknown[];

  if (['int', 'smallint', 'tinyint', 'bigint'].includes(t)) {
    values = [3, 1, 2, 0];
  } else if (['float', 'real', 'decimal', 'numeric', 'money'].includes(t)) {
    values = [12.5, 7.25, 30, 0.5];
  } else if (t === 'bit') {
    values = [true, false, true, false];
  } else if (t.includes('date') || t.includes('time')) {
    values = [
      '2025-05-21T10:15:32',
      '2025-05-21T10:18:05',
      '2025-05-21T10:20:18',
      '2025-05-21T10:25:40',
    ];
  } else {
    values = [
      ' Motor Overload ',
      'Low Pressure ',
      ' Temperature High',
      'Device Fault',
    ];
  }

  if (nullable) values[3] = null;

  return values;
}

// rows of an existing saved Lookup rule (empty when creating a new rule)
function lookupRowsFromRule(rule?: Rule): LookupRow[] {
  if (!rule) return [];

  return Object.entries(rule.parameters).map(([key, value]) => ({
    id: uid(),
    key,
    value,
  }));
}

// rows coming from a lookup table returned by the API
function rowsFromTable(table: LookupTable): LookupRow[] {
  return table.details.map((d) => ({
    id: uid(),
    key: d.sourceValue,
    value: d.targetValue,
  }));
}

// find the lookup table whose details exactly match an existing rule
function matchTableId(tables: LookupTable[], rule?: Rule): string {
  if (!rule || rule.type !== 'Lookup') return '';

  const entries = Object.entries(rule.parameters);

  const match = tables.find(
    (t) =>
      t.details.length === entries.length &&
      t.details.every((d) => rule.parameters[d.sourceValue] === d.targetValue)
  );

  return match ? String(match.id) : '';
}

/* ------------------------------------------------------------------ */
/* Small Building Blocks */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: JSX.Element;
  action?: JSX.Element;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-slate-700">
          {icon}
          {title}
        </h2>

        {action}
      </div>

      {children}
    </div>
  );
}

// Thin adapter: string value in / string value out, rendered with your SelectDropdown
function SelectBox({
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  options: (string | Option)[];
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const opts: Option[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const selected: Option | null =
    value === ''
      ? null
      : (opts.find((o) => String(o.value) === value) ?? {
          value,
          label: value,
        });

  return (
    // the label is already rendered by <Field>, so hide SelectDropdown's own
    <div className="w-full min-w-0 [&_label]:hidden">
      <SelectDropdown<false>
        label=""
        options={opts}
        value={selected}
        onChange={(opt) => onChange?.(opt ? String(opt.value) : '')}
        isDisabled={disabled}
        isClearable={false}
        placeholder={placeholder ?? 'Select'}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: JSX.Element;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[13px] text-slate-500">{label}</label>

        {action}
      </div>

      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
        checked
          ? 'border-sky-600 bg-sky-600 text-white'
          : 'border-slate-300 bg-white'
      }`}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component */
/* ------------------------------------------------------------------ */

// shared column template so header + rows always line up
const MAP_GRID =
  'grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_minmax(0,1fr)_56px]';
const LOOKUP_GRID = 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px]';

export default function ParsingConfig(): JSX.Element {
  const Api = useMemo(() => createCrudApi(RESOURCE_NAME), []);
  const TargetFieldApi = useMemo(
    () => createCrudApi(TARGET_FIELD_RESOURCE),
    []
  );
  const LookupApi = useMemo(() => createCrudApi(LOOKUP_RESOURCE), []);
  const ConfigApi = useMemo(() => createCrudApi(CONFIG_RESOURCE), []);
  const EtlApi = useMemo(() => createCrudApi(ETL_RESOURCE), []);
  const EtlExecutionApi = useMemo(
    () => createCrudApi(ETL_EXECUTION_RESOURCE),
    []
  );

  const topRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // set when "Edit" is clicked; consumed by the columns loader once the
  // source schema of that collector arrives
  const pendingEditRef = useRef<SavedConfig | null>(null);

  /* -------------------------------------------------------------- */
  /* State : Source */
  /* -------------------------------------------------------------- */

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [collectorId, setCollectorId] = useState('');
  const [loadingCollectors, setLoadingCollectors] = useState(false);
  const [collectorsReload, setCollectorsReload] = useState(0);

  const [columns, setColumns] = useState<SourceColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [schemaReload, setSchemaReload] = useState(0);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [columnSearch, setColumnSearch] = useState('');

  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [lookupTables, setLookupTables] = useState<LookupTable[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupReload, setLookupReload] = useState(0);

  /* -------------------------------------------------------------- */
  /* State : Mapping + Rule Builder */
  /* -------------------------------------------------------------- */

  const [mappings, setMappings] = useState<Mapping[]>([]);

  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);

  const [draftType, setDraftType] = useState<RuleType>('Lookup');
  const [draftDefault, setDraftDefault] = useState('');
  const [draftSuffix, setDraftSuffix] = useState('');
  const [draftLookupTableId, setDraftLookupTableId] = useState('');
  const [draftLookup, setDraftLookup] = useState<LookupRow[]>(() =>
    lookupRowsFromRule()
  );

  /* -------------------------------------------------------------- */
  /* State : Incremental / Save / Run */
  /* -------------------------------------------------------------- */

  const [incremental, setIncremental] = useState(true);
  const [trackBy, setTrackBy] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ETL run that is triggered right after a successful save
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // id of the saved configuration being edited (null = creating a new one)
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [editingConfigName, setEditingConfigName] = useState('');

  /* -------------------------------------------------------------- */
  /* State : Preview (POST /api/etl/preview)                         */
  /* body: { configurationId, sampleSize }                           */
  /* -------------------------------------------------------------- */

  const [apiPreview, setApiPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewApiError, setPreviewApiError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // which saved configuration is being previewed
  const [previewConfigId, setPreviewConfigId] = useState<number | null>(null);
  const [previewConfigName, setPreviewConfigName] = useState('');
  const [sampleSize, setSampleSize] = useState(String(DEFAULT_SAMPLE_SIZE));

  /* -------------------------------------------------------------- */
  /* State : Saved configurations list */
  /* -------------------------------------------------------------- */

  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [configsError, setConfigsError] = useState<string | null>(null);
  const [configsReload, setConfigsReload] = useState(0);

  const [listSearch, setListSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listSortKey, setListSortKey] =
    useState<keyof SavedConfigRow>('collectorName');
  const [listSortOrder, setListSortOrder] = useState<'asc' | 'desc'>('asc');

  const [viewConfig, setViewConfig] = useState<SavedConfig | null>(null);

  /* -------------------------------------------------------------- */
  /* Derived */
  /* -------------------------------------------------------------- */

  const selectedNames = useMemo(
    () => columns.filter((c) => c.selected).map((c) => c.name),
    [columns]
  );

  const selectedKey = selectedNames.join('|');
  const selectedCount = selectedNames.length;

  const filteredColumns = useMemo(
    () =>
      columns.filter((c) =>
        c.name.toLowerCase().includes(columnSearch.toLowerCase())
      ),
    [columns, columnSearch]
  );

  const usedTargets = useMemo(
    () => new Set(mappings.map((m) => m.target).filter(Boolean)),
    [mappings]
  );

  // only mappings that have a target field are saved
  const mappedMappings = useMemo(
    () => mappings.filter((m) => m.target.trim() !== ''),
    [mappings]
  );

  const editingMapping =
    mappings.find((m) => m.id === editingMappingId) ?? null;

  const isEditingConfig = editingConfigId !== null;

  // the config the "Run Preview" button works on:
  // the one picked from the table, otherwise the one being edited
  const previewTargetId = previewConfigId ?? editingConfigId;

  const previewTargetName =
    previewConfigId !== null
      ? previewConfigName
      : editingConfigId !== null
        ? editingConfigName
        : '';

  // preview table columns (original = Original_*, transformed = the rest)
  const previewAllKeys = useMemo(
    () => previewColumnKeys(apiPreview?.rows ?? []),
    [apiPreview]
  );

  const previewOriginalCount = useMemo(
    () => previewAllKeys.filter(isOriginalKey).length,
    [previewAllKeys]
  );

  const previewVisibleKeys = useMemo(
    () =>
      showOriginal
        ? previewAllKeys
        : previewAllKeys.filter((k) => !isOriginalKey(k)),
    [previewAllKeys, showOriginal]
  );

  /* -------------------------------------------------------------- */
  /* Collectors API */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadCollectors() {
      setLoadingCollectors(true);
      setSourceError(null);

      try {
        const res = await Api.get<Collector[]>('?includeInactive=false');
        const list = res?.data ?? [];

        if (cancelled) return;

        setCollectors(list);

        setCollectorId((prev) => {
          // keep whatever is selected (e.g. the collector of the config
          // being edited), otherwise fall back to the first collector
          if (prev) return prev;

          return list[0] ? String(list[0].collectorId) : '';
        });
      } catch (err) {
        if (cancelled) return;

        console.error('Collector fetch failed:', err);
        setCollectors([]);
        setSourceError(errorMessage(err, 'Failed to load collectors'));
      } finally {
        if (!cancelled) setLoadingCollectors(false);
      }
    }

    loadCollectors();

    return () => {
      cancelled = true;
    };
  }, [Api, collectorsReload]);

  /* -------------------------------------------------------------- */
  /* Row Table Columns API (runs when collector changes)             */
  /* If a saved config is pending (Edit clicked), its mappings are   */
  /* applied on top of the loaded schema.                            */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!collectorId) {
      setColumns([]);
      setMappings([]);
      return;
    }

    let cancelled = false;

    async function loadColumns() {
      setLoadingColumns(true);
      setSourceError(null);

      try {
        const res = await Api.get<ApiColumn[]>(
          `${collectorId}/rowtable-columns`
        );
        const list = res?.data ?? [];

        if (cancelled) return;

        // consume the pending edit only after the cancelled check, so React
        // strict-mode double effects can't swallow it
        const pending =
          pendingEditRef.current &&
          String(pendingEditRef.current.collectorId) === collectorId
            ? pendingEditRef.current
            : null;

        if (pending) pendingEditRef.current = null;

        const savedSources = new Set(
          pending?.mappings.map((m) => m.sourceColumn) ?? []
        );

        const cols: SourceColumn[] = list.map((c) => ({
          name: c.columnName,
          type: c.dataType,
          nullable: c.isNullable,
          // edit mode: only the columns that were saved stay ticked
          selected: pending ? savedSources.has(c.columnName) : true,
        }));

        setColumns(cols);

        if (pending) {
          setMappings(
            pending.mappings.map((m) => ({
              id: uid(),
              source: m.sourceColumn,
              target: m.targetColumn,
              rule: m.rules[0] ?? { ...KEEP_RULE },
            }))
          );

          setIncremental(pending.incrementalLoad);

          setTrackBy(
            pending.watermarkColumn ||
              cols.find((c) => c.type.toLowerCase().includes('datetime'))
                ?.name ||
              cols[0]?.name ||
              ''
          );
        } else {
          setMappings(
            cols.map((c) => ({
              id: uid(),
              source: c.name,
              target: '', // auto-filled from the TargetField list below
              rule: { ...KEEP_RULE },
            }))
          );

          setTrackBy(
            cols.find((c) => c.type.toLowerCase().includes('datetime'))?.name ??
              cols[0]?.name ??
              ''
          );
        }

        setEditingMappingId(null);
      } catch (err) {
        if (cancelled) return;

        console.error('Columns fetch failed:', err);
        setColumns([]);
        setMappings([]);
        setSourceError(errorMessage(err, 'Failed to load source columns'));
      } finally {
        if (!cancelled) setLoadingColumns(false);
      }
    }

    loadColumns();

    return () => {
      cancelled = true;
    };
  }, [Api, collectorId, schemaReload]);

  /* -------------------------------------------------------------- */
  /* Target Fields API */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadTargetFields() {
      setLoadingTargets(true);
      setTargetError(null);

      try {
        const res = await TargetFieldApi.get<TargetField[]>('');
        const list = res?.data ?? [];

        if (cancelled) return;

        setTargetFields(
          list.filter((t) => t.isActive).map((t) => t.targetFieldName)
        );
      } catch (err) {
        if (cancelled) return;

        console.error('TargetField fetch failed:', err);
        setTargetFields([]);
        setTargetError(errorMessage(err, 'Failed to load target fields'));
      } finally {
        if (!cancelled) setLoadingTargets(false);
      }
    }

    loadTargetFields();

    return () => {
      cancelled = true;
    };
  }, [TargetFieldApi]);

  /* -------------------------------------------------------------- */
  /* Lookup Tables API  (GET /api/etl/lookup-tables) */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadLookupTables() {
      setLoadingLookups(true);
      setLookupError(null);

      try {
        const res = await LookupApi.get<LookupTable[]>('');
        const list = asList<LookupTable>(res?.data);

        if (cancelled) return;

        setLookupTables(
          list
            .filter((t) => t.isActive)
            .map((t) => ({ ...t, details: t.details ?? [] }))
        );
      } catch (err) {
        if (cancelled) return;

        console.error('Lookup tables fetch failed:', err);
        setLookupTables([]);
        setLookupError(errorMessage(err, 'Failed to load lookup tables'));
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    }

    loadLookupTables();

    return () => {
      cancelled = true;
    };
  }, [LookupApi, lookupReload]);

  /* -------------------------------------------------------------- */
  /* Saved Configurations API  (GET /api/etl/getConfigurations) */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadConfigs() {
      setLoadingConfigs(true);
      setConfigsError(null);

      try {
        const res = await EtlApi.get<unknown>('getConfigurations');
        const list = asConfigList(res?.data);

        if (cancelled) return;

        setConfigs(list.map(normalizeConfig));
      } catch (err) {
        if (cancelled) return;

        console.error('Configurations fetch failed:', err);
        setConfigs([]);
        setConfigsError(errorMessage(err, 'Failed to load configurations'));
      } finally {
        if (!cancelled) setLoadingConfigs(false);
      }
    }

    loadConfigs();

    return () => {
      cancelled = true;
    };
  }, [EtlApi, configsReload]);

  // pre-select the target whose name matches the source column (case-insensitive)
  useEffect(() => {
    if (targetFields.length === 0) return;

    setMappings((prev) => {
      const used = new Set(prev.map((m) => m.target).filter(Boolean));

      return prev.map((m) => {
        if (m.target) return m;

        const match = targetFields.find(
          (t) => t.toLowerCase() === m.source.toLowerCase() && !used.has(t)
        );

        if (match) used.add(match);

        return match ? { ...m, target: match } : m;
      });
    });
  }, [targetFields, columns]);

  // drop mappings whose source column was unchecked
  useEffect(() => {
    setMappings((prev) => {
      const next = prev.filter((m) => selectedNames.includes(m.source));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  /* -------------------------------------------------------------- */
  /* Client-side sample check (sample data -> rule -> result)        */
  /* used by validation                                              */
  /* -------------------------------------------------------------- */

  const previewErrors = useMemo(() => {
    const samples: Record<string, unknown[]> = {};

    columns.forEach((c) => {
      samples[c.name] = sampleFor(c.type, c.nullable);
    });

    const errors: string[] = [];

    [0, 1, 2, 3].forEach((i) => {
      mappings.forEach((m) => {
        const original = samples[m.source]?.[i];

        try {
          applyRule(original, m.rule);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Rule failed';

          errors.push(`Row ${i + 1} · ${m.target || m.source}: ${message}`);
        }
      });
    });

    return errors;
  }, [columns, mappings]);

  /* -------------------------------------------------------------- */
  /* Validation (errors block saving, warnings do not) */
  /* -------------------------------------------------------------- */

  const checks = useMemo<ValidationCheck[]>(() => {
    const targetNames = mappedMappings.map((m) =>
      m.target.trim().toLowerCase()
    );

    const duplicateTargets = targetNames.length - new Set(targetNames).size;

    const skipped = mappings.length - mappedMappings.length;

    const badRules = mappedMappings
      .filter(
        (m) =>
          (m.rule.type === 'Lookup' &&
            Object.keys(m.rule.parameters).length === 0) ||
          (m.rule.type === 'DefaultIfEmpty' && !('value' in m.rule.parameters))
      )
      .map(
        (m) =>
          `${m.target}: "${RULE_META[m.rule.type].label}" is missing its value.`
      );

    return [
      {
        level: 'error',
        ok: mappedMappings.length > 0,
        pass: `${mappedMappings.length} mapping(s) will be saved.`,
        fail: 'Map at least one source column to a target field.',
      },
      {
        level: 'error',
        ok: duplicateTargets === 0,
        pass: 'No duplicate target fields.',
        fail: `${duplicateTargets} duplicate target field(s) found.`,
      },
      {
        level: 'error',
        ok: badRules.length === 0,
        pass: 'Parsing rules are valid.',
        fail: badRules.join(' '),
      },
      {
        level: 'warn',
        ok: skipped === 0,
        pass: 'Every mapping has a target field.',
        fail: `${skipped} mapping(s) have no target field and will not be saved.`,
      },
      {
        level: 'warn',
        ok: previewErrors.length === 0,
        pass: 'Sample data transforms without errors.',
        fail: `${previewErrors.length} sample row error(s) (validation uses generated sample values).`,
      },
    ];
  }, [mappings, mappedMappings, previewErrors.length]);

  const allValid = checks.every((c) => c.level === 'warn' || c.ok);
  const hasWarnings = checks.some((c) => c.level === 'warn' && !c.ok);

  const summaryTone = !allValid
    ? {
        box: 'border-red-200 bg-red-50',
        title: 'text-red-700',
        text: 'Validation Failed',
      }
    : hasWarnings
      ? {
          box: 'border-amber-200 bg-amber-50',
          title: 'text-amber-700',
          text: 'Ready to save (with warnings)',
        }
      : {
          box: 'border-emerald-200 bg-emerald-50',
          title: 'text-emerald-700',
          text: 'Validation Passed',
        };

  /* -------------------------------------------------------------- */
  /* Mapping Handlers */
  /* -------------------------------------------------------------- */

  const toggleColumn = (name: string) =>
    setColumns((prev) =>
      prev.map((c) => (c.name === name ? { ...c, selected: !c.selected } : c))
    );

  const updateMapping = (id: number, patch: Partial<Mapping>) =>
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );

  const removeMapping = (id: number) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));

    if (editingMappingId === id) cancelRuleEdit();
  };

  const addMapping = () =>
    setMappings((prev) => [
      ...prev,
      {
        id: uid(),
        source: selectedNames[0] ?? '',
        target: '',
        rule: { ...KEEP_RULE },
      },
    ]);

  /* -------------------------------------------------------------- */
  /* Rule Builder Handlers (one rule per mapping) */
  /* -------------------------------------------------------------- */

  const loadDraft = (rule?: Rule) => {
    setDraftType(rule?.type ?? 'Lookup');
    setDraftDefault(
      rule?.type === 'DefaultIfEmpty' ? (rule.parameters.value ?? '') : ''
    );
    setDraftSuffix(
      rule?.type === 'Concat' ? (rule.parameters.suffix ?? '') : ''
    );
    setDraftLookup(
      lookupRowsFromRule(rule?.type === 'Lookup' ? rule : undefined)
    );
    setDraftLookupTableId(matchTableId(lookupTables, rule));
  };

  const startRuleEdit = (mappingId: number) => {
    const mapping = mappings.find((m) => m.id === mappingId);

    setEditingMappingId(mappingId);

    // a mapping that still has the placeholder "Keep" rule opens as a
    // Lookup, so the lookup table dropdown (e.g. PriorityMap) shows at once
    loadDraft(
      mapping && mapping.rule.type !== 'Keep' ? mapping.rule : undefined
    );
  };

  function cancelRuleEdit() {
    setEditingMappingId(null);
    loadDraft();
  }

  const buildDraftRule = (): Rule => {
    const parameters: Record<string, string> = {};

    if (draftType === 'DefaultIfEmpty') {
      parameters.value = draftDefault;
    }

    if (draftType === 'Concat') {
      parameters.suffix = draftSuffix;
    }

    if (draftType === 'Lookup') {
      draftLookup.forEach((r) => {
        if (r.key !== '') parameters[r.key] = r.value;
      });
    }

    return { type: draftType, parameters };
  };

  // replaces the mapping's single rule
  const saveRule = () => {
    if (!editingMapping) return;

    updateMapping(editingMapping.id, { rule: buildDraftRule() });
    cancelRuleEdit();
  };

  // picking a lookup table fills the rows from its details
  const selectLookupTable = (id: string) => {
    setDraftLookupTableId(id);

    const table = lookupTables.find((t) => String(t.id) === id);

    setDraftLookup(table ? rowsFromTable(table) : []);
  };

  // any manual row change means the rows no longer match the selected table
  const updateLookupRow = (id: number, patch: Partial<LookupRow>) => {
    setDraftLookupTableId('');
    setDraftLookup((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const removeLookupRow = (id: number) => {
    setDraftLookupTableId('');
    setDraftLookup((prev) => prev.filter((r) => r.id !== id));
  };

  const addLookupRow = () => {
    setDraftLookupTableId('');
    setDraftLookup((prev) => [...prev, { id: uid(), key: '', value: '' }]);
  };

  /* -------------------------------------------------------------- */
  /* Edit a saved configuration -> fill the whole wizard             */
  /* -------------------------------------------------------------- */

  const handleEditConfig = (cfg: SavedConfig) => {
    pendingEditRef.current = cfg;

    setEditingConfigId(cfg.id);
    setEditingConfigName(cfg.collectorName);
    setSaveMessage(null);
    setSaveError(null);
    setRunMessage(null);
    setRunError(null);

    // preview now follows the config being edited
    setPreviewConfigId(null);
    setPreviewConfigName('');
    setApiPreview(null);
    setPreviewApiError(null);

    setIncremental(cfg.incrementalLoad);
    setTrackBy(cfg.watermarkColumn);

    cancelRuleEdit();
    setColumnSearch('');

    // the collector select + the bumped schemaReload re-run the columns
    // loader (even when the collector is unchanged), which applies `cfg`
    setCollectorId(String(cfg.collectorId));
    setSchemaReload((n) => n + 1);

    setViewConfig(null);

    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const exitEditMode = () => {
    pendingEditRef.current = null;

    setEditingConfigId(null);
    setEditingConfigName('');
    setIncremental(true);

    cancelRuleEdit();

    // reload the schema so the wizard goes back to a fresh, default state
    setSchemaReload((n) => n + 1);
  };

  /* -------------------------------------------------------------- */
  /* Payload for SAVE                                                */
  /* -------------------------------------------------------------- */

  const buildPayload = () => {
    const collector = collectors.find(
      (c) => String(c.collectorId) === collectorId
    );

    return {
      id: editingConfigId ?? 0,
      collectorId: Number(collectorId),
      collectorName:
        collector?.collectorName ?? (isEditingConfig ? editingConfigName : ''),
      incrementalLoad: incremental,
      watermarkColumn: incremental ? trackBy : '',
      mappings: mappedMappings.map((m) => ({
        sourceColumn: m.source,
        targetColumn: m.target.trim(),
        rules: [
          {
            type: m.rule.type,
            parameters: m.rule.parameters,
          },
        ],
      })),
    };
  };

  /* -------------------------------------------------------------- */
  /* Preview  (POST /api/etl/preview)                                */
  /* Body:     { configurationId, sampleSize }                       */
  /* Response: { totalRows, rows: [...], errors: [...] }             */
  /* -------------------------------------------------------------- */

  const handlePreview = async (configId: number, name?: string) => {
    const parsedSize = Math.floor(Number(sampleSize));

    const payload = {
      configurationId: configId,
      sampleSize:
        Number.isFinite(parsedSize) && parsedSize > 0
          ? parsedSize
          : DEFAULT_SAMPLE_SIZE,
    };

    // remember which config is shown (name is looked up when not passed)
    setPreviewConfigId(configId);
    setPreviewConfigName(
      name ??
        configs.find((c) => c.id === configId)?.collectorName ??
        (configId === editingConfigId ? editingConfigName : '')
    );

    setLoadingPreview(true);
    setPreviewApiError(null);

    try {
      const res = await EtlApi.post<unknown>('preview', payload);

      setApiPreview(normalizePreview(res?.data));
    } catch (err) {
      console.error('Preview failed:', err, payload);

      setApiPreview(null);
      setPreviewApiError(errorMessage(err, 'Failed to load preview'));
    } finally {
      setLoadingPreview(false);
    }
  };

  // preview button inside the saved configurations table
  const handlePreviewRow = (cfg: SavedConfig) => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    handlePreview(cfg.id, cfg.collectorName);
  };

  /* -------------------------------------------------------------- */
  /* Run ETL  (POST /api/EtlExecution/{id}/run)                      */
  /* -------------------------------------------------------------- */

  const runEtl = async (configId: number) => {
    setRunning(true);
    setRunMessage(null);
    setRunError(null);

    try {
      // if your backend expects GET for this endpoint, use:
      // const res = await EtlExecutionApi.get<EtlRunResponse>(`${configId}/run`);
      const res = await EtlExecutionApi.post<EtlRunResponse>(
        `${configId}/run`,
        {}
      );

      const data = res?.data as Partial<EtlRunResponse> | undefined;

      if (data && data.success === false) {
        setRunError(data.message ?? 'ETL execution failed.');
      } else {
        setRunMessage(data?.message ?? 'ETL execution completed successfully.');
      }
    } catch (err) {
      console.error('ETL run failed:', err);

      setRunError(errorMessage(err, 'ETL execution failed'));
    } finally {
      setRunning(false);
    }
  };

  /* -------------------------------------------------------------- */
  /* Save  (create: POST /api/etl/configurations, update: with id)   */
  /* After a successful save the ETL is run with the saved id.       */
  /* -------------------------------------------------------------- */

  const handleSave = async () => {
    const payload = buildPayload();

    const wasEditing = isEditingConfig;
    const previousId = editingConfigId;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    setRunMessage(null);
    setRunError(null);

    let savedId: number | null = null;

    try {
      let res;

      if (wasEditing && USE_PUT_FOR_UPDATE) {
        res = await ConfigApi.put(`${editingConfigId}`, payload);
      } else {
        res = await ConfigApi.post('', payload);
      }

      // id comes from the save response; when editing fall back to the old id
      savedId = extractConfigId(res?.data) ?? (wasEditing ? previousId : null);

      setSaveMessage(
        wasEditing
          ? 'Configuration updated successfully.'
          : 'Configuration saved successfully.'
      );

      // refresh the table below
      setConfigsReload((n) => n + 1);

      if (wasEditing) exitEditMode();
    } catch (err) {
      console.error('Save configuration failed:', err, payload);

      setSaveError(errorMessage(err, 'Failed to save configuration'));
    } finally {
      setSaving(false);
    }

    // run the ETL only when the save succeeded
    // if (savedId !== null) {
    //   await runEtl(savedId);
    // }
  };

  /* -------------------------------------------------------------- */
  /* Saved configurations table : rows / search / sort / pagination  */
  /* -------------------------------------------------------------- */

  const configRows = useMemo<SavedConfigRow[]>(
    () =>
      configs.map((c) => ({
        ...c,
        loadType: c.incrementalLoad ? 'Incremental' : 'Full',
        mappingCount: c.mappings.length,
        rulesApplied: ruleSummary(c)
          .map((r) => r.type)
          .join(', '),
      })),
    [configs]
  );

  const filteredRows = useMemo(() => {
    const term = listSearch.trim().toLowerCase();

    if (!term) return configRows;

    return configRows.filter(
      (c) =>
        c.collectorName.toLowerCase().includes(term) ||
        c.watermarkColumn.toLowerCase().includes(term) ||
        c.loadType.toLowerCase().includes(term) ||
        c.rulesApplied.toLowerCase().includes(term) ||
        c.mappings.some(
          (m) =>
            m.sourceColumn.toLowerCase().includes(term) ||
            m.targetColumn.toLowerCase().includes(term)
        )
    );
  }, [configRows, listSearch]);

  const sortedRows = useMemo(() => {
    const result = [...filteredRows];

    result.sort((a, b) => {
      const av = a[listSortKey] ?? '';
      const bv = b[listSortKey] ?? '';

      if (typeof av === 'number' && typeof bv === 'number') {
        return listSortOrder === 'asc' ? av - bv : bv - av;
      }

      return (
        String(av).toLowerCase().localeCompare(String(bv).toLowerCase()) *
        (listSortOrder === 'asc' ? 1 : -1)
      );
    });

    return result;
  }, [filteredRows, listSortKey, listSortOrder]);

  const listTotalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (listPage - 1) * PAGE_SIZE;

    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, listPage]);

  useEffect(() => {
    if (listPage > listTotalPages) setListPage(listTotalPages);
  }, [listPage, listTotalPages]);

  const handleListSort = (key: keyof SavedConfigRow) => {
    if (listSortKey === key) {
      setListSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setListSortKey(key);
      setListSortOrder('asc');
    }

    setListPage(1);
  };

  /* ============================================================ */
  /* UI */
  /* ============================================================ */

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
      <div ref={topRef} />

      {/* ======================================================== */}
      {/* HEADER */}
      {/* ======================================================== */}

      <header className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-[18px] font-semibold text-slate-700">
            {isEditingConfig ? 'Edit Parsing' : 'Create Parsing'}

            {isEditingConfig && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-700">
                Editing: {editingConfigName} (ID {editingConfigId})
              </span>
            )}
          </div>

          <div className="text-[12px] text-slate-400">ETL / Transformation</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {saveMessage && (
            <span className="text-[13px] text-emerald-700">{saveMessage}</span>
          )}

          {saveError && (
            <span
              className="max-w-[360px] truncate text-[13px] text-red-600"
              title={saveError}
            >
              {saveError}
            </span>
          )}

          {/* ETL run status (after save) */}
          {running && (
            <span className="flex items-center gap-1.5 text-[13px] text-sky-700">
              <RefreshCw size={14} className="animate-spin" />
              Running ETL…
            </span>
          )}

          {runMessage && (
            <span
              className="flex max-w-[420px] items-center gap-1.5 truncate text-[13px] font-medium text-emerald-700"
              title={runMessage}
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span className="truncate">{runMessage}</span>
            </span>
          )}

          {runError && (
            <span
              className="flex max-w-[420px] items-center gap-1.5 truncate text-[13px] font-medium text-red-600"
              title={runError}
            >
              <XCircle size={15} className="shrink-0" />
              <span className="truncate">{runError}</span>
            </span>
          )}

          {isEditingConfig && (
            <button
              type="button"
              onClick={exitEditMode}
              disabled={saving || running}
              className="h-9 rounded border border-slate-300 bg-white px-4 text-[14px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel Edit
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={
              !collectorId || !allValid || saving || running || loadingColumns
            }
            className="h-9 rounded bg-sky-600 px-4 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? isEditingConfig
                ? 'Updating…'
                : 'Saving…'
              : running
                ? 'Running ETL…'
                : isEditingConfig
                  ? 'Update Configuration'
                  : 'Save Configuration'}
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* STEPPER */}
      {/* ======================================================== */}

      <div className="mt-3 flex items-center gap-3 overflow-x-auto rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < CURRENT_STEP;
          const active = n === CURRENT_STEP;

          return (
            <React.Fragment key={label}>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold ${
                    done || active
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : n}
                </span>

                <span
                  className={`text-[14px] ${
                    active
                      ? 'font-semibold text-slate-700'
                      : 'font-medium text-slate-500'
                  }`}
                >
                  {label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="h-px min-w-[24px] flex-1 bg-slate-200" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* MAIN */}
      {/* ======================================================== */}

      <main className="mt-3 flex-1 space-y-2 overflow-y-auto pb-4">
        {/* items-stretch => all three columns end at the same height */}
        <div className="grid grid-cols-1 items-stretch gap-2 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          {/* ==================================================== */}
          {/* LEFT : SELECT SOURCE */}
          {/* ==================================================== */}

          <SectionCard
            title="1. Select Source"
            className="flex h-full flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <Field label="Collector">
                <div className="space-y-2">
                  <SelectBox
                    value={collectorId}
                    onChange={setCollectorId}
                    // collector is locked while editing a saved configuration
                    disabled={
                      loadingCollectors ||
                      collectors.length === 0 ||
                      isEditingConfig
                    }
                    placeholder={
                      loadingCollectors
                        ? 'Loading collectors…'
                        : collectors.length === 0
                          ? 'No collectors found'
                          : 'Select collector'
                    }
                    options={collectors.map((c) => ({
                      value: String(c.collectorId),
                      label: c.collectorName,
                    }))}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Reload collectors"
                      onClick={() => setCollectorsReload((n) => n + 1)}
                      disabled={loadingCollectors}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 text-sky-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw
                        size={16}
                        className={loadingCollectors ? 'animate-spin' : ''}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSchemaReload((n) => n + 1)}
                      disabled={!collectorId || loadingColumns}
                      className="h-9 flex-1 rounded bg-sky-600 px-3 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Load Schema
                    </button>
                  </div>
                </div>
              </Field>

              {sourceError && (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[13px] text-red-700">
                  {sourceError}
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-3">
                <h3 className="mb-2 text-[14px] font-semibold text-slate-700">
                  Available Source Columns
                </h3>

                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    placeholder="Search columns..."
                    className={`${inputClass} pl-7`}
                  />
                </div>

                <div className="min-h-[240px] max-h-[560px] flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {loadingColumns && (
                    <p className="py-6 text-center text-[13px] text-slate-400">
                      Loading columns…
                    </p>
                  )}

                  {!loadingColumns && filteredColumns.length === 0 && (
                    <p className="py-6 text-center text-[13px] text-slate-400">
                      Data not available
                    </p>
                  )}

                  {!loadingColumns &&
                    filteredColumns.map((c) => (
                      <div
                        key={c.name}
                        title={c.nullable ? 'Nullable' : 'Required'}
                        className="flex items-center justify-between gap-2 py-2 pr-2 text-[13px]"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <Checkbox
                            checked={c.selected}
                            onChange={() => toggleColumn(c.name)}
                          />

                          <span className="truncate">{c.name}</span>
                        </span>

                        <span className="shrink-0 text-[12px] text-slate-400">
                          {c.type}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[13px]">
                  <span className="text-slate-500">
                    {selectedCount} of {columns.length} selected
                  </span>

                  <button
                    type="button"
                    className="font-medium text-sky-600 hover:text-sky-700"
                  >
                    View Schema
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ==================================================== */}
          {/* MIDDLE : MAP COLUMNS */}
          {/* ==================================================== */}

          <div className="flex min-w-0 flex-col gap-2">
            <SectionCard title="2. Map Columns" className="flex-1">
              {targetError && (
                <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[13px] text-red-700">
                  {targetError}
                </div>
              )}

              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div
                    className={`mb-2 grid ${MAP_GRID} gap-3 text-[13px] font-medium text-slate-400`}
                  >
                    <span>Source Column</span>
                    <span />
                    <span>Target Field</span>
                    <span>Rule</span>
                    <span />
                  </div>

                  <div className="space-y-2">
                    {mappings.length === 0 && (
                      <p className="py-6 text-center text-[13px] text-slate-400">
                        Select a collector and tick source columns to map.
                      </p>
                    )}

                    {mappings.map((m) => (
                      <div
                        key={m.id}
                        className={`grid ${MAP_GRID} items-center gap-3 rounded ${
                          editingMappingId === m.id
                            ? 'bg-sky-50/60 ring-1 ring-sky-200'
                            : ''
                        }`}
                      >
                        <SelectBox
                          value={m.source}
                          options={selectedNames}
                          onChange={(v) => updateMapping(m.id, { source: v })}
                        />

                        <span className="text-center text-slate-400">→</span>

                        <SelectBox
                          value={m.target}
                          placeholder={
                            loadingTargets ? 'Loading…' : 'Select target field'
                          }
                          options={targetFields.filter(
                            (t) => t === m.target || !usedTargets.has(t)
                          )}
                          onChange={(v) => updateMapping(m.id, { target: v })}
                        />

                        <button
                          type="button"
                          title="Edit rule"
                          onClick={() => startRuleEdit(m.id)}
                          className={`flex h-9 w-full min-w-0 items-center rounded border px-3 text-left text-[13px] font-medium ${
                            RULE_META[m.rule.type].classes
                          }`}
                        >
                          <span className="truncate">{ruleLabel(m.rule)}</span>
                        </button>

                        <div className="flex items-center justify-end gap-3 text-slate-400">
                          <button
                            type="button"
                            title="Edit rule"
                            onClick={() => startRuleEdit(m.id)}
                            className="transition hover:text-sky-600"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            title="Remove mapping"
                            onClick={() => removeMapping(m.id)}
                            className="transition hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={addMapping}
                disabled={selectedNames.length === 0}
                className="mt-3 flex h-9 items-center gap-1.5 rounded border border-sky-300 bg-white px-3 text-[13px] font-medium text-sky-600 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={14} />
                Add Mapping
              </button>
            </SectionCard>
          </div>

          {/* ==================================================== */}
          {/* RIGHT : RULE BUILDER / VALIDATION */}
          {/* ==================================================== */}

          <div className="flex min-w-0 flex-col gap-2">
            <SectionCard title="Rule Builder">
              <div className="space-y-3">
                {editingMapping ? (
                  <div className="rounded bg-sky-50 px-2 py-1.5 text-[13px] text-sky-700">
                    Editing: <b>{editingMapping.source}</b> →{' '}
                    <b>{editingMapping.target || '—'}</b>
                  </div>
                ) : (
                  <div className="rounded bg-slate-50 px-2 py-1.5 text-[13px] text-slate-500">
                    Click the edit icon on a mapping to set its rule.
                  </div>
                )}

                <Field label="Select Rule Type">
                  <SelectBox
                    value={draftType}
                    disabled={!editingMapping}
                    onChange={(v) => setDraftType(v as RuleType)}
                    options={RULE_TYPES.map((t) => ({
                      value: t,
                      label: RULE_META[t].label,
                    }))}
                  />
                </Field>

                {draftType === 'DefaultIfEmpty' && (
                  <Field label="Default value">
                    <input
                      value={draftDefault}
                      disabled={!editingMapping}
                      onChange={(e) => setDraftDefault(e.target.value)}
                      placeholder="Value used when empty"
                      className={inputClass}
                    />
                  </Field>
                )}

                {draftType === 'Concat' && (
                  <Field label="Suffix">
                    <input
                      value={draftSuffix}
                      disabled={!editingMapping}
                      onChange={(e) => setDraftSuffix(e.target.value)}
                      placeholder="Text added at the end"
                      className={inputClass}
                    />
                  </Field>
                )}

                {draftType === 'Lookup' && (
                  <div className="space-y-3">
                    <Field
                      label="Lookup Table"
                      action={
                        <button
                          type="button"
                          title="Reload lookup tables"
                          onClick={() => setLookupReload((n) => n + 1)}
                          disabled={loadingLookups}
                          className="text-sky-600 transition hover:text-sky-700 disabled:opacity-60"
                        >
                          <RefreshCw
                            size={13}
                            className={loadingLookups ? 'animate-spin' : ''}
                          />
                        </button>
                      }
                    >
                      <SelectBox
                        value={draftLookupTableId}
                        disabled={!editingMapping || loadingLookups}
                        placeholder={
                          loadingLookups
                            ? 'Loading lookup tables…'
                            : lookupTables.length === 0
                              ? 'No lookup tables found'
                              : draftLookup.length > 0
                                ? 'Custom values'
                                : 'Select lookup table'
                        }
                        onChange={selectLookupTable}
                        options={lookupTables.map((t) => ({
                          value: String(t.id),
                          label: t.lookupName,
                        }))}
                      />
                    </Field>

                    {lookupError && (
                      <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[13px] text-red-700">
                        {lookupError}
                      </div>
                    )}

                    <div>
                      <h3 className="mb-2 text-[14px] font-semibold text-slate-700">
                        Lookup Values
                      </h3>

                      <div className="rounded border border-slate-200 p-2">
                        <div
                          className={`mb-1.5 grid ${LOOKUP_GRID} gap-2 text-[13px] font-medium text-slate-400`}
                        >
                          <span>Source Value</span>
                          <span>Target Value</span>
                          <span />
                        </div>

                        <div className="space-y-1.5">
                          {draftLookup.length === 0 && (
                            <p className="py-3 text-center text-[13px] text-slate-400">
                              Select a lookup table or add rows manually.
                            </p>
                          )}

                          {draftLookup.map((r) => (
                            <div
                              key={r.id}
                              className={`grid ${LOOKUP_GRID} items-center gap-2`}
                            >
                              <input
                                value={r.key}
                                disabled={!editingMapping}
                                onChange={(e) =>
                                  updateLookupRow(r.id, { key: e.target.value })
                                }
                                className={inputClass}
                              />

                              <input
                                value={r.value}
                                disabled={!editingMapping}
                                onChange={(e) =>
                                  updateLookupRow(r.id, {
                                    value: e.target.value,
                                  })
                                }
                                className={inputClass}
                              />

                              <button
                                type="button"
                                title="Remove row"
                                onClick={() => removeLookupRow(r.id)}
                                disabled={!editingMapping}
                                className="flex h-9 w-7 items-center justify-center rounded text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={addLookupRow}
                          disabled={!editingMapping}
                          className="mt-2 flex h-8 items-center gap-1.5 rounded border border-sky-300 bg-white px-2.5 text-[13px] font-medium text-sky-600 transition hover:bg-sky-50 disabled:opacity-40"
                        >
                          <Plus size={14} />
                          Add Row
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelRuleEdit}
                    disabled={!editingMapping}
                    className="h-9 rounded border border-sky-300 bg-white px-4 text-[14px] font-medium text-sky-600 transition hover:bg-sky-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveRule}
                    disabled={!editingMapping}
                    className="h-9 rounded bg-sky-600 px-4 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Validation summary */}
            <div
              className={`rounded-md border p-4 shadow-sm ${summaryTone.box}`}
            >
              <h2
                className={`mb-2 flex items-center gap-2 text-[16px] font-semibold ${summaryTone.title}`}
              >
                {!allValid ? (
                  <XCircle size={20} />
                ) : hasWarnings ? (
                  <AlertTriangle size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                {summaryTone.text}
              </h2>

              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li
                    key={c.pass}
                    className="flex items-start gap-2 text-[13px] text-slate-600"
                  >
                    {c.ok ? (
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-500"
                      />
                    ) : c.level === 'warn' ? (
                      <AlertTriangle
                        size={15}
                        className="mt-0.5 shrink-0 text-amber-500"
                      />
                    ) : (
                      <XCircle
                        size={15}
                        className="mt-0.5 shrink-0 text-red-500"
                      />
                    )}

                    {c.ok ? c.pass : c.fail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ====================================================== */}
        {/* PREVIEW (POST /api/etl/preview) -> table                */}
        {/* body: { configurationId, sampleSize }                   */}
        {/* ====================================================== */}

        <div ref={previewRef}>
          <SectionCard
            title="4. Preview"
            action={
              <div className="flex flex-wrap items-center gap-3">
                {previewTargetId !== null && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[12px] font-semibold text-sky-700">
                    Previewing: {previewTargetName || 'Configuration'} (ID{' '}
                    {previewTargetId})
                  </span>
                )}

                {apiPreview && (
                  <span className="text-[13px] text-slate-500">
                    Total rows:{' '}
                    <b className="text-slate-700">{apiPreview.totalRows}</b>
                  </span>
                )}

                {apiPreview && previewOriginalCount > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
                    <Checkbox
                      checked={showOriginal}
                      onChange={() => setShowOriginal((v) => !v)}
                    />
                    Show original columns
                  </label>
                )}

                <label className="flex items-center gap-2 text-[13px] text-slate-500">
                  Sample size
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(e.target.value)}
                    className={`${inputClass} w-20`}
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    previewTargetId !== null &&
                    handlePreview(previewTargetId, previewTargetName)
                  }
                  disabled={previewTargetId === null || loadingPreview}
                  title={
                    previewTargetId === null
                      ? 'Click the ▶ icon on a saved configuration first'
                      : 'Run preview'
                  }
                  className="flex h-9 items-center gap-1.5 rounded bg-sky-600 px-4 text-[14px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingPreview ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  {loadingPreview ? 'Loading…' : 'Run Preview'}
                </button>
              </div>
            }
          >
            {isEditingConfig && previewConfigId === null && (
              <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[13px] text-amber-700">
                Preview uses the <b>saved</b> version of this configuration.
                Click <b>Update Configuration</b> first if you changed anything.
              </div>
            )}

            {previewApiError && (
              <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[13px] text-red-700">
                {previewApiError}
              </div>
            )}
            {/* 
            {apiPreview && apiPreview.errors.length > 0 && (
              <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <XCircle size={15} />
                  {apiPreview.errors.length} error(s)
                </div>

                <ul className="list-disc space-y-0.5 pl-5">
                  {apiPreview.errors.map((e, i) => (
                    <li key={i}>{errorText(e)}</li>
                  ))}
                </ul>
              </div>
            )} */}

            {!apiPreview && !previewApiError && !loadingPreview && (
              <p className="py-6 text-center text-[13px] text-slate-400">
                Click the <b>▶</b> icon on a saved configuration below (or{' '}
                <b>Run Preview</b> while editing) to see the transformed data.
              </p>
            )}

            {loadingPreview && (
              <div className="py-8 text-center text-sm text-slate-500">
                Loading preview…
              </div>
            )}

            {!loadingPreview && apiPreview && apiPreview.rows.length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-400">
                No rows returned.
              </p>
            )}

            {!loadingPreview && apiPreview && apiPreview.rows.length > 0 && (
              <div className="max-h-[480px] overflow-auto rounded border border-slate-200">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2 text-center font-semibold text-slate-500">
                        #
                      </th>

                      {previewVisibleKeys.map((key) => (
                        <th
                          key={key}
                          className={`whitespace-nowrap border-b px-3 py-2 font-semibold ${
                            isOriginalKey(key)
                              ? 'border-slate-200 bg-slate-100 text-slate-500'
                              : 'border-sky-200 bg-sky-50 text-sky-800'
                          }`}
                        >
                          {isOriginalKey(key)
                            ? key.replace(/^Original_/, '') + ' (original)'
                            : key}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {apiPreview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-center text-slate-400">
                          {i + 1}
                        </td>

                        {previewVisibleKeys.map((key) => (
                          <td
                            key={key}
                            className={`whitespace-nowrap px-3 py-2 ${
                              isOriginalKey(key)
                                ? 'bg-slate-50/60 text-slate-500'
                                : 'text-slate-700'
                            }`}
                          >
                            <PreviewCellValue value={row[key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ====================================================== */}
        {/* SAVED CONFIGURATIONS (full width, below the wizard) */}
        {/* ====================================================== */}

        <SectionCard
          title="Saved Configurations"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={listSearch}
                  onChange={(e) => {
                    setListSearch(e.target.value);
                    setListPage(1);
                  }}
                  placeholder="Search collector, column, rule..."
                  className={`${inputClass} w-72 pl-7`}
                />
              </div>

              {listSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setListSearch('');
                    setListPage(1);
                  }}
                  className="h-9 rounded bg-slate-500 px-3 text-[13px] font-medium text-white transition hover:bg-slate-600"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                title="Refresh list"
                onClick={() => setConfigsReload((n) => n + 1)}
                disabled={loadingConfigs}
                className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-sky-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={loadingConfigs ? 'animate-spin' : ''}
                />
              </button>
            </div>
          }
        >
          {configsError && (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[13px] text-red-700">
              {configsError}
            </div>
          )}

          {loadingConfigs ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading configurations…
            </div>
          ) : (
            <DataTable<SavedConfigRow>
              columns={[
                {
                  label: 'Collector',
                  accessor: 'collectorName',
                  sortable: true,
                },
                {
                  label: 'Load Type',
                  accessor: 'loadType',
                  sortable: true,
                  render: (row: SavedConfigRow) => (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.incrementalLoad
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.loadType}
                    </span>
                  ),
                },
                {
                  label: 'Watermark Column',
                  accessor: 'watermarkColumn',
                  sortable: true,
                  render: (row: SavedConfigRow) =>
                    row.incrementalLoad && row.watermarkColumn
                      ? row.watermarkColumn
                      : '—',
                },
                {
                  label: 'Mappings',
                  accessor: 'mappingCount',
                  sortable: true,
                },
                {
                  label: 'Rules Applied',
                  accessor: 'rulesApplied',
                  render: (row: SavedConfigRow) => {
                    const summary = ruleSummary(row);

                    if (summary.length === 0) {
                      return (
                        <span className="text-xs text-slate-400">
                          Keep only
                        </span>
                      );
                    }

                    return (
                      <div className="flex flex-wrap justify-center gap-1">
                        {summary.map((r) => (
                          <span
                            key={r.type}
                            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${RULE_META[r.type].classes}`}
                          >
                            {RULE_META[r.type].label} × {r.count}
                          </span>
                        ))}
                      </div>
                    );
                  },
                },
                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: SavedConfigRow) => (
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        title="View mappings"
                        onClick={() => setViewConfig(row)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        type="button"
                        title="Preview data"
                        onClick={() => handlePreviewRow(row)}
                        disabled={loadingPreview}
                        className={`hover:text-emerald-700 disabled:text-slate-400 ${
                          previewConfigId === row.id
                            ? 'text-emerald-700'
                            : 'text-emerald-600'
                        }`}
                      >
                        <Play size={18} />
                      </button>

                      <button
                        type="button"
                        title="Edit configuration"
                        onClick={() => handleEditConfig(row)}
                        disabled={saving || running}
                        className={`hover:text-sky-700 disabled:text-slate-400 ${
                          editingConfigId === row.id
                            ? 'text-amber-600'
                            : 'text-sky-600'
                        }`}
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedRows}
              search={listSearch}
              setSearch={setListSearch}
              sortKey={listSortKey}
              sortOrder={listSortOrder}
              handleSort={handleListSort}
              page={listPage}
              setPage={setListPage}
              totalPages={listTotalPages}
            />
          )}
        </SectionCard>
      </main>

      {/* ======================================================== */}
      {/* VIEW MODAL */}
      {/* ======================================================== */}

      {viewConfig && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setViewConfig(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-700">
                  {viewConfig.collectorName}
                </h3>

                <p className="text-[12px] text-slate-400">
                  {viewConfig.incrementalLoad
                    ? `Incremental · watermark: ${viewConfig.watermarkColumn || '—'}`
                    : 'Full load'}{' '}
                  · {viewConfig.mappings.length} mapping(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewConfig(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="py-2 pr-2 font-medium">Source Column</th>
                    <th className="py-2 pr-2 font-medium">Target Field</th>
                    <th className="py-2 font-medium">Rule</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {viewConfig.mappings.map((m, i) => {
                    const rule = m.rules[0] ?? KEEP_RULE;

                    return (
                      <tr key={`${m.sourceColumn}-${i}`}>
                        <td className="py-2 pr-2 text-slate-700">
                          {m.sourceColumn}
                        </td>
                        <td className="py-2 pr-2 text-slate-700">
                          {m.targetColumn}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-[12px] font-medium ${RULE_META[rule.type].classes}`}
                          >
                            {ruleLabel(rule)}
                          </span>

                          {rule.type === 'Lookup' && (
                            <div className="mt-1 text-[11px] text-slate-400">
                              {Object.entries(rule.parameters)
                                .map(([k, v]) => `${k} → ${v}`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setViewConfig(null)}
                className="h-9 rounded border border-slate-300 bg-white px-4 text-[14px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const cfg = viewConfig;
                  setViewConfig(null);
                  handlePreviewRow(cfg);
                }}
                className="h-9 rounded border border-emerald-300 bg-white px-4 text-[14px] font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                Preview
              </button>

              <button
                type="button"
                onClick={() => handleEditConfig(viewConfig)}
                className="h-9 rounded bg-sky-600 px-4 text-[14px] font-medium text-white transition hover:bg-sky-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
