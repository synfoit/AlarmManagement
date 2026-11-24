import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Swal from 'sweetalert2';
import Select, {
  type MultiValue,
  type SingleValue,
  type StylesConfig,
} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import {
  BiCheck,
  BiChevronDown,
  BiEdit,
  BiSearch,
  BiSolidTrash,
  BiX,
} from 'react-icons/bi';

import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';

// ============================================================
// TYPES
// ============================================================

type SelectOption = {
  value: string | number;
  label: string;
};

// Ek report ek collector sathe bandhelo hoy chhe (same reportId alag collector ma pan hoy shake)
type SelectedReport = {
  collectorId: number;
  reportId: number;
  reportName: string;
};

type ReportOption = {
  value: string; // `${collectorId}-${reportId}`
  label: string; // reportName
  collectorId: number;
  collectorName: string;
  reportId: number;
  reportName: string;
};

type ReportGroup = {
  collectorId: number;
  collectorName: string;
  options: ReportOption[];
};

type EmailConfiguration = {
  id: number;

  fromEmail: string;
  password: string;

  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];

  subject: string;
  body: string;

  collectorId: number;
  reports: SelectedReport[];
  reportFormat: string;

  lastSendDateTime: string;
  shouldSendNow: boolean;
};

// Table row (extra display fields)
type EmailConfigurationRow = EmailConfiguration & {
  toEmailText: string;
  reportNames: string[];
  actions?: string;
};

type FieldErrorKey =
  | 'fromEmail'
  | 'password'
  | 'toEmails'
  | 'ccEmails'
  | 'bccEmails'
  | 'subject'
  | 'body'
  | 'reports'
  | 'reportFormat';

type FieldErrors = Partial<Record<FieldErrorKey, string>>;

type EmailListKey = 'toEmails' | 'ccEmails' | 'bccEmails';

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 10;

/*
 * Backend GetById ma password base64 (MTIz = 123) avto hoy chhe.
 * - Edit time e form ma decode kri ne batavie chhie.
 * - Save time e backend jo pote encode kri ne store kre chhe to false rakho.
 * - Jo backend ne base64 j joie to true kri do.
 */
const ENCODE_PASSWORD_BASE64 = true;

const REPORT_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'PDF', label: 'PDF' },
  // { value: 'Excel', label: 'Excel' },
];

const EMPTY_FORM: EmailConfiguration = {
  id: 0,

  fromEmail: '',
  password: '',

  toEmails: [],
  ccEmails: [],
  bccEmails: [],

  subject: '',
  body: '',

  collectorId: 0,
  reports: [],
  reportFormat: String(REPORT_FORMAT_OPTIONS[0].value),

  lastSendDateTime: '',
  shouldSendNow: false,
};

// ============================================================
// HELPERS
// ============================================================

const isValidEmail = (value: string): boolean => {
  const email = value.trim();

  if (!email) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const decodePassword = (value?: string | null): string => {
  if (!value) return '';

  try {
    return atob(value);
  } catch {
    return value;
  }
};

const encodePassword = (value: string): string => {
  if (!ENCODE_PASSWORD_BASE64) return value;

  try {
    return btoa(value);
  } catch {
    return value;
  }
};

const reportKey = (collectorId: number, reportId: number): string =>
  `${collectorId}-${reportId}`;

// API response -> form model
const mapApiToConfig = (item: any): EmailConfiguration => ({
  id: item?.id ?? 0,

  fromEmail: String(item?.fromEmail ?? '').trim(),
  password: decodePassword(item?.fromPassword),

  toEmails: (item?.toMailL ?? []).map((x: any) => x?.tomail).filter(Boolean),

  ccEmails: (item?.ccMailL ?? []).map((x: any) => x?.ccEmail).filter(Boolean),

  bccEmails: (item?.bccMailL ?? [])
    .map((x: any) => x?.bcceMail)
    .filter(Boolean),

  subject: item?.subject ?? '',
  body: item?.body ?? '',

  collectorId: Number(item?.collectorId ?? 0),

  reports: (item?.reportList ?? [])
    .map((x: any) => ({
      collectorId: Number(x?.collectorId),
      reportId: Number(x?.reportId),
      reportName: String(x?.reportName ?? ''),
    }))
    .filter(
      (x: SelectedReport) =>
        !Number.isNaN(x.collectorId) && !Number.isNaN(x.reportId)
    ),

  reportFormat: item?.reportFormat ?? '',

  lastSendDateTime: item?.lastSendDateTime ?? '',
  shouldSendNow: Boolean(item?.shouldSendNow),
});

// ============================================================
// SELECT STYLES
// ============================================================

const selectStyles: StylesConfig<any, boolean> = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderRadius: '6px',
    borderColor: state.isFocused ? '#0284c7' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #0284c7' : 'none',
    '&:hover': { borderColor: '#0284c7' },
    fontSize: '14px',
  }),

  menu: (base) => ({
    ...base,
    zIndex: 9999,
    fontSize: '14px',
  }),

  groupHeading: (base) => ({
    ...base,
    color: '#0369a1',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'none',
    backgroundColor: '#f0f9ff',
    padding: '6px 12px',
    margin: 0,
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#0284c7'
      : state.isFocused
        ? '#e0f2fe'
        : 'white',
    color: state.isSelected ? 'white' : '#374151',
    cursor: 'pointer',
  }),

  multiValue: (base) => ({
    ...base,
    backgroundColor: '#e0f2fe',
    borderRadius: '4px',
  }),

  multiValueLabel: (base) => ({
    ...base,
    color: '#0369a1',
    fontSize: '12px',
    fontWeight: 500,
  }),

  multiValueRemove: (base) => ({
    ...base,
    color: '#0369a1',
    ':hover': {
      backgroundColor: '#bae6fd',
      color: '#075985',
    },
  }),
};

// ============================================================
// MULTI EMAIL INPUT (chips)
// Type kro -> Enter / comma / space / Tab / blur -> chip bani jase
// ============================================================

type MultiEmailInputProps = {
  value: string[];
  onChange: (emails: string[]) => void;
  onError: (message: string) => void;
  placeholder: string;
  disabled?: boolean;
};

const MultiEmailInput: React.FC<MultiEmailInputProps> = ({
  value,
  onChange,
  onError,
  placeholder,
  disabled,
}) => {
  const [inputValue, setInputValue] = useState('');

  const commit = (raw: string) => {
    const tokens = raw
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (!tokens.length) return;

    const existing = new Set(value.map((x) => x.toLowerCase()));

    const valid: string[] = [];
    const invalid: string[] = [];

    tokens.forEach((token) => {
      if (!isValidEmail(token)) {
        invalid.push(token);
        return;
      }

      const key = token.toLowerCase();

      if (!existing.has(key)) {
        existing.add(key);
        valid.push(token);
      }
    });

    if (valid.length) {
      onChange([...value, ...valid]);
    }

    // Invalid text input ma rehva do jethi user sudhari shake
    setInputValue(invalid.join(', '));

    if (invalid.length) {
      onError(`Invalid email address: ${invalid.join(', ')}`);
    }
  };

  return (
    <CreatableSelect<SelectOption, true>
      isMulti
      isClearable
      menuIsOpen={false}
      components={{
        DropdownIndicator: null,
      }}
      inputValue={inputValue}
      value={value.map((email) => ({ value: email, label: email }))}
      placeholder={placeholder}
      isDisabled={disabled}
      styles={selectStyles as StylesConfig<SelectOption, true>}
      onChange={(selected: MultiValue<SelectOption>) => {
        onChange(selected.map((item) => String(item.value)));
      }}
      onInputChange={(text, meta) => {
        if (meta.action !== 'input-change') return;

        // comma / semicolon / space / paste -> turant chips
        if (/[,;\s]/.test(text)) {
          commit(text);
        } else {
          setInputValue(text);
        }
      }}
      onKeyDown={(e) => {
        if (!inputValue.trim()) return;

        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          commit(inputValue);
        }
      }}
      onBlur={() => {
        if (inputValue.trim()) {
          commit(inputValue);
        }
      }}
    />
  );
};

// ============================================================
// REPORT MULTI SELECT (checkbox + search, grouped by collector)
// ============================================================

// ============================================================
// TRUNCATED TABLE CELL
// Width thi vadhare hoy to "..." batave, hover par full content tooltip ma
// ============================================================

type TruncatedCellProps = {
  text: string;
  lines?: string[]; // tooltip ma alag-alag line batavva mate (report list)
  widthClass?: string;
};

const TruncatedCell: React.FC<TruncatedCellProps> = ({
  text,
  lines,
  widthClass = 'max-w-[220px]',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const tooltipLines = lines && lines.length ? lines : [text];

  const showTip = () => {
    const el = ref.current;

    // Content puru fit thay chhe to tooltip nathi joitu
    if (!el || el.scrollWidth <= el.clientWidth) return;

    const rect = el.getBoundingClientRect();

    setTip({
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
      y: rect.bottom + 6,
    });
  };

  return (
    <>
      <div
        ref={ref}
        className={`truncate text-left ${widthClass}`}
        onMouseEnter={showTip}
        onMouseLeave={() => setTip(null)}
      >
        {text || '-'}
      </div>

      {tip && (
        <div
          style={{ position: 'fixed', left: tip.x, top: tip.y }}
          className="pointer-events-none z-[9999] max-w-sm break-words rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-xl"
        >
          {tooltipLines.map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      )}
    </>
  );
};

type ReportMultiSelectProps = {
  groups: ReportGroup[];
  selected: SelectedReport[];
  onChange: (reports: SelectedReport[]) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
};

const ReportMultiSelect: React.FC<ReportMultiSelectProps> = ({
  groups,
  selected,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Select Reports',
}) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // CLICK OUTSIDE
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearchText('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedKeys = useMemo(
    () => new Set(selected.map((r) => reportKey(r.collectorId, r.reportId))),
    [selected]
  );

  const collectorNameMap = useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((g) => map.set(g.collectorId, g.collectorName));
    return map;
  }, [groups]);

  const chipLabel = (r: SelectedReport) =>
    `${collectorNameMap.get(r.collectorId) ?? `#${r.collectorId}`}: ${r.reportName}`;

  // SEARCH (collector name ya report name bane par chale)
  const filteredGroups = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    if (!text) return groups;

    return groups
      .map((group) => {
        const collectorMatched = group.collectorName
          .toLowerCase()
          .includes(text);

        return {
          ...group,
          options: collectorMatched
            ? group.options
            : group.options.filter((o) =>
                o.reportName.toLowerCase().includes(text)
              ),
        };
      })
      .filter((group) => group.options.length > 0);
  }, [groups, searchText]);

  const toSelected = (o: ReportOption): SelectedReport => ({
    collectorId: o.collectorId,
    reportId: o.reportId,
    reportName: o.reportName,
  });

  const toggle = (option: ReportOption) => {
    if (selectedKeys.has(option.value)) {
      onChange(
        selected.filter(
          (r) => reportKey(r.collectorId, r.reportId) !== option.value
        )
      );
    } else {
      onChange([...selected, toSelected(option)]);
    }
  };

  const removeSelected = (item: SelectedReport) => {
    onChange(
      selected.filter(
        (r) =>
          !(r.collectorId === item.collectorId && r.reportId === item.reportId)
      )
    );
  };

  // Group-wise Select All / Clear
  const selectGroup = (group: ReportGroup) => {
    const toAdd = group.options
      .filter((o) => !selectedKeys.has(o.value))
      .map(toSelected);

    onChange([...selected, ...toAdd]);
  };

  const clearGroup = (group: ReportGroup) => {
    onChange(selected.filter((r) => r.collectorId !== group.collectorId));
  };

  const handleOpen = () => {
    if (disabled) return;

    setOpen((prev) => !prev);

    if (!open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* SELECT BUTTON */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`
          flex min-h-[38px] w-full items-center justify-between
          rounded border bg-white px-3 py-2 text-left text-sm
          outline-none transition
          ${open ? 'border-sky-500 ring-1 ring-sky-200' : 'border-gray-300'}
          ${
            disabled
              ? 'cursor-not-allowed bg-gray-100 text-gray-500'
              : 'hover:border-gray-400'
          }
        `}
      >
        <div className="min-w-0 flex-1">
          {loading ? (
            <span className="text-gray-400">Loading reports...</span>
          ) : selected.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                {selected.length} selected
              </span>

              <span className="truncate text-gray-600">
                {selected
                  .slice(0, 2)
                  .map((r) => r.reportName)
                  .join(', ')}

                {selected.length > 2 && ` +${selected.length - 2} more`}
              </span>
            </div>
          )}
        </div>

        <BiChevronDown
          className={`ml-2 shrink-0 text-xl text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* DROPDOWN PANEL */}
      {open && !disabled && (
        <div className="absolute z-[100] mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          {/* SEARCH */}
          <div className="border-b border-gray-200 p-2">
            <div className="relative">
              <BiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-gray-400" />

              <input
                ref={searchInputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search collector or report..."
                className="w-full rounded border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs text-gray-700 outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>
          </div>

          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-gray-500">
              {selected.length} selected
            </span>

            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              Clear All
            </button>
          </div>

          {/* GROUPS + OPTIONS */}
          <div className="max-h-72 overflow-y-auto pb-1">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-gray-400">
                No report found.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const allChecked = group.options.every((o) =>
                  selectedKeys.has(o.value)
                );
                const noneChecked = group.options.every(
                  (o) => !selectedKeys.has(o.value)
                );

                return (
                  <div key={group.collectorId}>
                    {/* COLLECTOR TITLE */}
                    <div className="sticky top-0 z-10 flex items-center justify-between border-y border-sky-100 bg-sky-50 px-3 py-1.5">
                      <span className="truncate text-xs font-semibold text-sky-800">
                        {group.collectorName}
                      </span>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => selectGroup(group)}
                          disabled={allChecked}
                          className="text-[11px] font-medium text-sky-600 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          Select All
                        </button>

                        <button
                          type="button"
                          onClick={() => clearGroup(group)}
                          disabled={noneChecked}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* REPORTS OF THIS COLLECTOR */}
                    {group.options.map((option) => {
                      const checked = selectedKeys.has(option.value);

                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${
                            checked ? 'bg-sky-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(option)}
                            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-sky-600"
                          />

                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${
                              checked
                                ? 'font-medium text-sky-700'
                                : 'text-gray-700'
                            }`}
                          >
                            {option.reportName}
                          </span>

                          {checked && (
                            <BiCheck className="shrink-0 text-xl text-sky-600" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* SELECTED CHIPS */}
          {selected.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {selected.map((item) => (
                  <span
                    key={reportKey(item.collectorId, item.reportId)}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-100 bg-white px-2 py-1 text-[11px] text-gray-600"
                  >
                    <span className="max-w-[220px] truncate">
                      {chipLabel(item)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeSelected(item)}
                      className="text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      <BiX className="text-sm" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPONENT
// ============================================================

const EmailConfigurationPage: React.FC = () => {
  // ============================================================
  // API
  // ============================================================

  // Base: /api/Automail
  const emailApi = useMemo(() => createCrudApi('Automail'), []);

  // ============================================================
  // STATE
  // ============================================================

  const [emailConfigurations, setEmailConfigurations] = useState<
    EmailConfiguration[]
  >([]);

  // Collector -> reports (grouped dropdown)
  const [reportGroups, setReportGroups] = useState<ReportGroup[]>([]);

  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<EmailConfiguration>(EMPTY_FORM);

  const [errors, setErrors] = useState<FieldErrors>({});

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] =
    useState<keyof EmailConfigurationRow>('fromEmail');

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ============================================================
  // BACKEND MESSAGE
  // ============================================================

  const getBackendMessage = (err: any, fallback: string): string => {
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (typeof err?.response?.data === 'string' ? err.response.data : null) ||
      err?.message ||
      fallback
    );
  };

  const setFieldError = (key: FieldErrorKey, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }));
  };

  // ============================================================
  // GET ALL EMAIL CONFIGURATIONS
  // GET /api/Automail/GetAllAutoMailCofig
  // ============================================================

  const fetchEmailConfigurations = async () => {
    setListLoading(true);

    try {
      const res = await emailApi.get<any>('GetAllAutoMailCofig');

      const responseData = res?.data;

      const rawList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      setEmailConfigurations(rawList.map(mapApiToConfig));
    } catch (err: any) {
      console.error('Failed to load email configurations:', err);

      setEmailConfigurations([]);

      Swal.fire(
        'Warning',
        getBackendMessage(
          err,
          'Something went wrong while fetching email configurations.'
        ),
        'warning'
      );
    } finally {
      setListLoading(false);
    }
  };

  // ============================================================
  // GET COLLECTOR + REPORT LIST
  // GET /api/Automail/GetCollectorReportList
  // ============================================================

  const fetchReports = async () => {
    setReportLoading(true);

    try {
      const res = await emailApi.get<any>('GetCollectorReportList');

      const responseData = res?.data;

      const rawCollectors = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const groups: ReportGroup[] = rawCollectors
        .filter(
          (collector: any) =>
            collector?.collectorId !== undefined &&
            collector?.collectorId !== null
        )
        .map((collector: any) => {
          const collectorId = Number(collector.collectorId);
          const collectorName = String(collector.collectorName ?? '');

          const options: ReportOption[] = (collector.reports ?? [])
            .filter(
              (report: any) =>
                report?.reportId !== undefined &&
                report?.reportId !== null &&
                report?.reportName
            )
            .map((report: any) => ({
              value: reportKey(collectorId, Number(report.reportId)),
              label: String(report.reportName),
              collectorId,
              collectorName,
              reportId: Number(report.reportId),
              reportName: String(report.reportName),
            }));

          return { collectorId, collectorName, options };
        })
        .filter((group: ReportGroup) => group.options.length > 0);

      setReportGroups(groups);
    } catch (err: any) {
      console.error('Failed to load reports:', err);

      setReportGroups([]);

      Swal.fire(
        'Warning',
        getBackendMessage(err, 'Failed to load reports.'),
        'warning'
      );
    } finally {
      setReportLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchEmailConfigurations();
    fetchReports();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // VALIDATIONS
  // ============================================================

  const validateFromEmail = (value: string): string => {
    const email = value.trim();

    if (!email) return 'From Email cannot be blank';

    if (!isValidEmail(email)) return 'Enter a valid from email';

    return '';
  };

  const validateAll = (): boolean => {
    const newErrors: FieldErrors = {};

    const fromEmailError = validateFromEmail(formData.fromEmail);
    if (fromEmailError) newErrors.fromEmail = fromEmailError;

    if (!formData.password.trim()) {
      newErrors.password = 'Password cannot be blank';
    }

    if (!formData.toEmails.length) {
      newErrors.toEmails = 'Please add at least one To Email';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject cannot be blank';
    }

    if (!formData.body.trim()) {
      newErrors.body = 'Body Message cannot be blank';
    }

    if (!formData.reports.length) {
      newErrors.reports = 'Please select at least one report';
    }

    if (!formData.reportFormat.trim()) {
      newErrors.reportFormat = 'Please select report format';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // INPUT CHANGE
  // ============================================================

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'fromEmail') {
      setFieldError('fromEmail', value.trim() ? validateFromEmail(value) : '');
    } else if (name === 'password') {
      setFieldError('password', value.trim() ? '' : 'Password cannot be blank');
    } else if (name === 'subject') {
      setFieldError('subject', value.trim() ? '' : 'Subject cannot be blank');
    } else if (name === 'body') {
      setFieldError('body', value.trim() ? '' : 'Body Message cannot be blank');
    }
  };

  // ============================================================
  // EMAIL LISTS (TO / CC / BCC)
  // ============================================================

  const handleEmailListChange = (key: EmailListKey, emails: string[]) => {
    setFormData((prev) => ({ ...prev, [key]: emails }));

    if (key === 'toEmails') {
      setFieldError(
        'toEmails',
        emails.length ? '' : 'Please add at least one To Email'
      );
    } else {
      setFieldError(key, '');
    }
  };

  // ============================================================
  // REPORT MULTI SELECT (grouped by collector)
  // ============================================================

  // collectorId + reportId nu composite key => same report alag collector ma pan select thai shake
  const allReportOptions = useMemo(
    () => reportGroups.flatMap((group) => [...group.options]),
    [reportGroups]
  );

  const handleReportChange = (reports: SelectedReport[]) => {
    setFormData((prev) => ({
      ...prev,
      reports,
      // top-level collectorId = pehla select kareli report no collector
      collectorId: reports.length ? reports[0].collectorId : 0,
    }));

    setFieldError(
      'reports',
      reports.length ? '' : 'Please select at least one report'
    );
  };

  // ============================================================
  // REPORT FORMAT
  // ============================================================

  const selectedFormat =
    REPORT_FORMAT_OPTIONS.find(
      (item) => String(item.value) === String(formData.reportFormat)
    ) ?? null;

  const handleFormatChange = (selected: SingleValue<SelectOption>) => {
    setFormData((prev) => ({
      ...prev,
      reportFormat: selected ? String(selected.value) : '',
    }));

    setFieldError(
      'reportFormat',
      selected ? '' : 'Please select report format'
    );
  };

  // ============================================================
  // RESET FORM
  // ============================================================

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setIsEdit(false);
    setEditingId(null);
  };

  // ============================================================
  // EDIT - GET BY ID
  // GET /api/Automail/GetAutoMailConfigById?id=2
  // ============================================================

  const handleEdit = async (id: number) => {
    try {
      setLoading(true);

      const res = await emailApi.get<any>(
        `GetAutoMailConfigById?id=${encodeURIComponent(String(id))}`
      );

      const config = res?.data?.data ?? res?.data ?? null;

      if (!config) {
        Swal.fire('Error', 'Email configuration details not found.', 'error');
        return;
      }

      const mapped = mapApiToConfig(config);

      setFormData({ ...mapped, id: mapped.id || id });

      setErrors({});
      setIsEdit(true);
      setEditingId(mapped.id || id);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to load email configuration:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to load email configuration details.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ADD / UPDATE
  // Update : PUT  /api/Automail/{id}
  // Add    : POST /api/Automail/AddAutoMailConfig
  // ============================================================

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateAll()) return;

    const payload = {
      id: isEdit && editingId ? editingId : 0,

      fromEmail: formData.fromEmail.trim(),
      fromPassword: encodePassword(formData.password),

      subject: formData.subject.trim(),
      body: formData.body.trim(),

      lastSendDateTime: formData.lastSendDateTime || new Date().toISOString(),

      collectorId: formData.reports.length
        ? formData.reports[0].collectorId
        : 0,

      reportFormat: formData.reportFormat,

      shouldSendNow: formData.shouldSendNow,

      ccMailL: formData.ccEmails.map((email) => ({ ccEmail: email })),

      bccMailL: formData.bccEmails.map((email) => ({ bcceMail: email })),

      toMailL: formData.toEmails.map((email) => ({ tomail: email })),

      reportList: formData.reports.map((report) => ({
        reportName: report.reportName,
        reportId: report.reportId,
        collectorId: report.collectorId,
      })),
    };

    try {
      setLoading(true);

      if (isEdit && editingId) {
        await emailApi.put(String(editingId), payload);
      } else {
        await emailApi.post('AddAutoMailConfig', payload);
      }

      await Swal.fire(
        isEdit
          ? 'Email Configuration Updated!'
          : 'Email Configuration Created!',
        isEdit
          ? 'Email configuration updated successfully.'
          : 'Email configuration added successfully.',
        'success'
      );

      resetForm();

      await fetchEmailConfigurations();
    } catch (err: any) {
      console.error('Save email configuration failed:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to save email configuration.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DELETE
  // DELETE /api/Automail/DeleteConfiguration/{id}
  // ============================================================

  const handleDelete = async (id: number, fromEmail: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',

      html: `
        You want to delete email configuration for:
        <strong>${fromEmail}</strong>
      `,

      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel',

      customClass: {
        confirmButton:
          'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded',
        cancelButton:
          'ms-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded',
      },
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);

      await emailApi.delete(`DeleteConfiguration/${id}`);

      await Swal.fire(
        'Deleted',
        'Email configuration has been deleted successfully.',
        'success'
      );

      if (editingId === id) resetForm();

      await fetchEmailConfigurations();
    } catch (err: any) {
      console.error('Delete email configuration failed:', err);

      Swal.fire('Error', getBackendMessage(err, 'Delete failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TABLE ROWS (collector: report names + joined emails)
  // ============================================================

  const rows = useMemo<EmailConfigurationRow[]>(() => {
    const collectorNameMap = new Map<number, string>();

    allReportOptions.forEach((o) =>
      collectorNameMap.set(o.collectorId, o.collectorName)
    );

    return emailConfigurations.map((item) => ({
      ...item,

      toEmailText: item.toEmails.join(', '),

      reportNames: item.reports.map((r) => {
        const collectorName = collectorNameMap.get(r.collectorId);

        return collectorName
          ? `${collectorName}: ${r.reportName}`
          : r.reportName;
      }),
    }));
  }, [emailConfigurations, allReportOptions]);

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredConfigurations = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) return rows;

    return rows.filter(
      (item) =>
        item.fromEmail.toLowerCase().includes(searchTerm) ||
        item.toEmails.join(', ').toLowerCase().includes(searchTerm) ||
        item.ccEmails.join(', ').toLowerCase().includes(searchTerm) ||
        item.bccEmails.join(', ').toLowerCase().includes(searchTerm) ||
        item.subject.toLowerCase().includes(searchTerm) ||
        item.reportNames.join(', ').toLowerCase().includes(searchTerm) ||
        item.reportFormat.toLowerCase().includes(searchTerm)
    );
  }, [rows, search]);

  // ============================================================
  // SORT
  // ============================================================

  const sortedConfigurations = useMemo(() => {
    const result = [...filteredConfigurations];

    result.sort((a, b) => {
      const aValue = a[sortKey] ?? '';
      const bValue = b[sortKey] ?? '';

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return (
        String(aValue)
          .toLowerCase()
          .localeCompare(String(bValue).toLowerCase()) *
        (sortOrder === 'asc' ? 1 : -1)
      );
    });

    return result;
  }, [filteredConfigurations, sortKey, sortOrder]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(sortedConfigurations.length / PAGE_SIZE)
  );

  const paginatedConfigurations = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;

    return sortedConfigurations.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedConfigurations, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Edit time e API collectorId 0 / wrong aape to groups mathi sacho collectorId shodhi ne fix kare
  useEffect(() => {
    if (!allReportOptions.length || !formData.reports.length) return;

    const seen = new Set<string>();
    const normalized: SelectedReport[] = [];

    formData.reports.forEach((r) => {
      const match =
        allReportOptions.find(
          (o) => o.collectorId === r.collectorId && o.reportId === r.reportId
        ) ??
        allReportOptions.find(
          (o) => o.reportId === r.reportId && o.reportName === r.reportName
        ) ??
        allReportOptions.find((o) => o.reportName === r.reportName);

      const fixed: SelectedReport = match
        ? {
            collectorId: match.collectorId,
            reportId: match.reportId,
            reportName: match.reportName,
          }
        : r;

      const key = reportKey(fixed.collectorId, fixed.reportId);

      if (seen.has(key)) return; // duplicate remove

      seen.add(key);
      normalized.push(fixed);
    });

    const changed =
      normalized.length !== formData.reports.length ||
      normalized.some(
        (n, i) =>
          n.collectorId !== formData.reports[i].collectorId ||
          n.reportId !== formData.reports[i].reportId
      );

    if (changed) {
      setFormData((prev) => ({
        ...prev,
        reports: normalized,
        collectorId: normalized[0].collectorId,
      }));
    }
  }, [allReportOptions, formData.reports]);

  // ============================================================
  // SEARCH / SORT HANDLERS
  // ============================================================

  const handleSearch = () => setPage(1);

  const handleClear = () => {
    setSearch('');
    setPage(1);
  };

  const handleSort = (key: keyof EmailConfigurationRow) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }

    setPage(1);
  };

  // ============================================================
  // UI
  // ============================================================

  const inputClass =
    'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none disabled:bg-gray-100';

  const labelClass = 'block font-medium text-sm mb-1 text-gray-500';

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Email Configuration Master
      </h1>

      <div className="p-4">
        {/* ====================================================== */}
        {/* ADD / EDIT FORM */}
        {/* ====================================================== */}

        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-lg shadow-lg"
        >
          {/* HEADER */}
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-semibold text-gray-700">
              {isEdit ? 'Edit Mail Configuration' : 'New Mail Configuration'}
            </h2>

            {isEdit && (
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="px-4 py-2 text-sm rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>

          {/* ROW 1 : FROM + PASSWORD + SUBJECT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>From Email *</label>

              <input
                type="email"
                name="fromEmail"
                value={formData.fromEmail}
                onChange={handleChange}
                placeholder="Enter From Email"
                disabled={loading}
                className={inputClass}
              />

              {errors.fromEmail && (
                <p className="text-red-600 text-xs mt-1">{errors.fromEmail}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Password *</label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter From Password"
                disabled={loading}
                autoComplete="new-password"
                className={inputClass}
              />

              {errors.password && (
                <p className="text-red-600 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Subject *</label>

              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Enter Subject"
                disabled={loading}
                className={inputClass}
              />

              {errors.subject && (
                <p className="text-red-600 text-xs mt-1">{errors.subject}</p>
              )}
            </div>
          </div>

          {/* ROW 2 : TO + CC + BCC (multiple emails) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className={labelClass}>To Email *</label>

              <MultiEmailInput
                value={formData.toEmails}
                onChange={(emails) => handleEmailListChange('toEmails', emails)}
                onError={(msg) => setFieldError('toEmails', msg)}
                placeholder="Type email & press Enter"
                disabled={loading}
              />

              {errors.toEmails && (
                <p className="text-red-600 text-xs mt-1">{errors.toEmails}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>CC Email ID</label>

              <MultiEmailInput
                value={formData.ccEmails}
                onChange={(emails) => handleEmailListChange('ccEmails', emails)}
                onError={(msg) => setFieldError('ccEmails', msg)}
                placeholder="Type email & press Enter"
                disabled={loading}
              />

              {errors.ccEmails && (
                <p className="text-red-600 text-xs mt-1">{errors.ccEmails}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>BCC Email ID</label>

              <MultiEmailInput
                value={formData.bccEmails}
                onChange={(emails) =>
                  handleEmailListChange('bccEmails', emails)
                }
                onError={(msg) => setFieldError('bccEmails', msg)}
                placeholder="Type email & press Enter"
                disabled={loading}
              />

              {errors.bccEmails && (
                <p className="text-red-600 text-xs mt-1">{errors.bccEmails}</p>
              )}
            </div>
          </div>

          {/* ROW 3 : BODY */}
          <div className="mt-4">
            <label className={labelClass}>Body *</label>

            <textarea
              name="body"
              value={formData.body}
              onChange={handleChange}
              placeholder="Enter Body Message"
              rows={4}
              disabled={loading}
              className={`${inputClass} resize-y`}
            />

            {errors.body && (
              <p className="text-red-600 text-xs mt-1">{errors.body}</p>
            )}
          </div>

          {/* ROW 4 : REPORT NAME (grouped by collector) + REPORT FORMAT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelClass}>Collector / Report Name *</label>

              <ReportMultiSelect
                groups={reportGroups}
                selected={formData.reports}
                onChange={handleReportChange}
                disabled={loading}
                loading={reportLoading}
                placeholder="Select Reports"
              />

              {errors.reports && (
                <p className="text-red-600 text-xs mt-1">{errors.reports}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Report Format *</label>

              <Select<SelectOption, false>
                isClearable
                isSearchable={false}
                options={REPORT_FORMAT_OPTIONS}
                value={selectedFormat}
                onChange={handleFormatChange}
                isDisabled={loading}
                placeholder="Select Report Format"
                styles={selectStyles as StylesConfig<SelectOption, false>}
              />

              {errors.reportFormat && (
                <p className="text-red-600 text-xs mt-1">
                  {errors.reportFormat}
                </p>
              )}
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isEdit
                  ? 'Updating...'
                  : 'Saving...'
                : isEdit
                  ? 'Update'
                  : 'Submit'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="px-6 py-2 text-sm rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* ====================================================== */}
        {/* EMAIL CONFIGURATION LIST */}
        {/* ====================================================== */}

        <div className="mt-5 bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-700">
              Email Configuration List
            </h2>

            <div className="flex items-center gap-2">
              <input
                placeholder="Search email configuration..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="w-80 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
              />

              <button
                type="button"
                onClick={handleSearch}
                className="px-4 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none"
              >
                Search
              </button>

              {search && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2 text-sm rounded bg-gray-500 text-white hover:bg-gray-600 focus:outline-none"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {listLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading email configurations...
            </div>
          ) : (
            <DataTable<EmailConfigurationRow>
              columns={[
                {
                  label: 'From Email',
                  accessor: 'fromEmail',
                  sortable: true,

                  render: (row: EmailConfigurationRow) => (
                    <TruncatedCell text={row.fromEmail} />
                  ),
                },

                {
                  label: 'To Email',
                  accessor: 'toEmailText',
                  sortable: true,

                  render: (row: EmailConfigurationRow) => (
                    <TruncatedCell
                      text={row.toEmailText}
                      lines={row.toEmails}
                    />
                  ),
                },

                {
                  label: 'Subject',
                  accessor: 'subject',
                  sortable: true,

                  render: (row: EmailConfigurationRow) => (
                    <TruncatedCell text={row.subject} />
                  ),
                },

                {
                  label: 'Report Name',
                  accessor: 'reportNames',
                  sortable: false,

                  render: (row: EmailConfigurationRow) => (
                    <TruncatedCell
                      text={row.reportNames.join(', ')}
                      lines={row.reportNames}
                      widthClass="max-w-[260px]"
                    />
                  ),
                },

                {
                  label: 'Report Format',
                  accessor: 'reportFormat',
                  sortable: true,

                  render: (row: EmailConfigurationRow) => (
                    <TruncatedCell
                      text={row.reportFormat}
                      widthClass="max-w-[120px]"
                    />
                  ),
                },

                {
                  label: 'Actions',
                  accessor: 'actions',

                  render: (row: EmailConfigurationRow) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.id)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit email configuration"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(row.id, row.fromEmail)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete email configuration"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedConfigurations}
              search={search}
              setSearch={setSearch}
              sortKey={sortKey}
              sortOrder={sortOrder}
              handleSort={handleSort}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default EmailConfigurationPage;
