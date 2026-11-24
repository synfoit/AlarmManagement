// src/pages/SourceMaster.tsx

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Swal from 'sweetalert2';
import {
  BiCheck,
  BiChevronDown,
  BiEdit,
  BiSearch,
  BiTrash,
  BiX,
} from 'react-icons/bi';
import { createCrudApi } from '../features/lib/createCrudApi';
import SelectDropdown from '../features/ui/SelectDropdown';

/* ================================================================
   TYPES
   ================================================================ */

type SourceItem = {
  sourceMappingId: number;
  sourceName: string;
};

type SourceMappingGroup = {
  consoleId: number;
  collectorId: number;
  sourceName: SourceItem[];
};

type ConsoleItem = {
  consoleId: number;
  areaId?: number;
  consoleName: string;
  isActive?: boolean;
};

type CollectorItem = {
  collectorId: number;
  collectorName: string;
  consoleId?: number; // optional: if API returns it, collectors get filtered by console
};

type SelectOption = {
  value: number;
  label: string;
};

type FieldErrors = {
  consoleId?: string;
  collectorId?: string;
  sourceNames?: string;
};

type SortKey = 'console' | 'collector' | 'count';

const PAGE_SIZE = 10;

// Table chips
const PREVIEW_CHIPS = 8;
const EXPANDED_CHIPS_LIMIT = 200;

// Virtual list
const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 288;
const OVERSCAN = 6;
const MAX_CHIPS_IN_PANEL = 8;

const groupKey = (consoleId: number, collectorId: number) =>
  `${consoleId}-${collectorId}`;

/* ================================================================
   SOURCE MULTI SELECT (VIRTUALIZED)
   ================================================================ */

type SourceMultiSelectProps = {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLButtonElement | null>;
};

const SourceMultiSelect: React.FC<SourceMultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Select source name(s)',
  inputRef,
}) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const indexedOptions = useMemo(
    () => options.map((value) => ({ value, lower: value.toLowerCase() })),
    [options]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText), 200);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    const result: string[] = [];

    for (const item of indexedOptions) {
      if (selectedOnly && !selectedSet.has(item.value)) {
        continue;
      }

      if (term && !item.lower.includes(term)) {
        continue;
      }

      result.push(item.value);
    }

    return result;
  }, [indexedOptions, debouncedSearch, selectedOnly, selectedSet]);

  const selectedInFiltered = useMemo(() => {
    let count = 0;

    for (const value of filtered) {
      if (selectedSet.has(value)) {
        count++;
      }
    }

    return count;
  }, [filtered, selectedSet]);

  useEffect(() => {
    setScrollTop(0);

    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [debouncedSearch, selectedOnly, open]);

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectAll = () => {
    onChange(Array.from(new Set([...selectedValues, ...filtered])));
  };

  const clearFiltered = () => {
    if (!debouncedSearch.trim() && !selectedOnly) {
      onChange([]);

      return;
    }

    const filteredSet = new Set(filtered);

    onChange(selectedValues.filter((value) => !filteredSet.has(value)));
  };

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    setOpen((prev) => !prev);

    if (!open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const total = filtered.length;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);

  const endIndex = Math.min(
    total,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
  );

  const visibleItems = filtered.slice(startIndex, endIndex);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* SELECT BUTTON */}
      <button
        ref={inputRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`
          flex min-h-[40px] w-full items-center justify-between
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
            <span className="flex items-center gap-2 text-gray-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              Loading sources...
            </span>
          ) : selectedValues.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                {selectedValues.length.toLocaleString()} selected
              </span>

              <span className="truncate text-gray-600">
                {selectedValues.slice(0, 2).join(', ')}

                {selectedValues.length > 2 &&
                  ` +${(selectedValues.length - 2).toLocaleString()} more`}
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
                placeholder={`Search in ${options.length.toLocaleString()} sources...`}
                className="w-full rounded border border-gray-200 bg-gray-50 py-2 pl-8 pr-8 text-xs text-gray-700 outline-none focus:border-sky-400 focus:bg-white"
              />

              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <BiX className="text-lg" />
                </button>
              )}
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-gray-600">
                {selectedValues.length.toLocaleString()} selected
              </span>

              <span className="text-[10px] text-gray-400">
                Showing {total.toLocaleString()} of{' '}
                {options.length.toLocaleString()}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1 text-[11px] text-gray-500">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(e) => setSelectedOnly(e.target.checked)}
                  className="h-3 w-3 accent-sky-600"
                />
                Selected only
              </label>

              <button
                type="button"
                onClick={selectAll}
                disabled={total === 0 || selectedInFiltered === total}
                className="text-[11px] font-medium text-sky-600 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={clearFiltered}
                disabled={total === 0 || selectedInFiltered === 0}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>

          {/* VIRTUAL OPTIONS */}
          {total === 0 ? (
            <div
              className="flex items-center justify-center text-xs text-gray-400"
              style={{ height: VIEWPORT_HEIGHT }}
            >
              {options.length === 0
                ? 'No sources available.'
                : 'No source found.'}
            </div>
          ) : (
            <div
              ref={listRef}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              className="overflow-y-auto"
              style={{ height: Math.min(VIEWPORT_HEIGHT, total * ROW_HEIGHT) }}
            >
              <div style={{ height: total * ROW_HEIGHT, position: 'relative' }}>
                <div
                  style={{
                    transform: `translateY(${startIndex * ROW_HEIGHT}px)`,
                  }}
                >
                  {visibleItems.map((value) => {
                    const checked = selectedSet.has(value);

                    return (
                      <label
                        key={value}
                        style={{ height: ROW_HEIGHT }}
                        className={`flex cursor-pointer items-center gap-3 px-3 transition ${
                          checked ? 'bg-sky-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(value)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-sky-600"
                        />

                        <span
                          title={value}
                          className={`min-w-0 flex-1 truncate text-sm ${
                            checked
                              ? 'font-medium text-sky-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {value}
                        </span>

                        {checked && (
                          <BiCheck className="shrink-0 text-xl text-sky-600" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SELECTED PREVIEW (capped) */}
          {selectedValues.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedValues.slice(0, MAX_CHIPS_IN_PANEL).map((value) => (
                  <span
                    key={value}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-100 bg-white px-2 py-1 text-[11px] text-gray-600"
                  >
                    <span className="max-w-[140px] truncate">{value}</span>

                    <button
                      type="button"
                      onClick={() => toggleValue(value)}
                      className="text-gray-400 hover:text-red-500"
                      title={`Remove ${value}`}
                    >
                      <BiX className="text-sm" />
                    </button>
                  </span>
                ))}

                {selectedValues.length > MAX_CHIPS_IN_PANEL && (
                  <span className="text-[11px] text-gray-500">
                    +
                    {(
                      selectedValues.length - MAX_CHIPS_IN_PANEL
                    ).toLocaleString()}{' '}
                    more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

const SourceMaster: React.FC = () => {
  const sourceApi = useMemo(() => createCrudApi('SourceMapping'), []);
  const consoleApi = useMemo(() => createCrudApi('ConsoleMaster'), []);
  const collectorApi = useMemo(() => createCrudApi('collector-configs'), []);
  const tagApi = useMemo(() => createCrudApi('CriticalTag'), []);

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  const [sourceMappings, setSourceMappings] = useState<SourceMappingGroup[]>(
    []
  );
  const [consoles, setConsoles] = useState<ConsoleItem[]>([]);
  const [collectors, setCollectors] = useState<CollectorItem[]>([]);

  // Source names from API for the selected collector (string[])
  const [sourceNameList, setSourceNameList] = useState<string[]>([]);
  const [sourceOptionsLoading, setSourceOptionsLoading] = useState(false);

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  // ------------------------------------------------------------
  // FORM
  // ------------------------------------------------------------
  const [selectedConsole, setSelectedConsole] = useState<SelectOption | null>(
    null
  );
  const [selectedCollector, setSelectedCollector] =
    useState<SelectOption | null>(null);
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // ------------------------------------------------------------
  // EDIT STATE
  // ------------------------------------------------------------
  const [isEdit, setIsEdit] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editFormFocused, setEditFormFocused] = useState(false);

  // ------------------------------------------------------------
  // TABLE UI STATE
  // ------------------------------------------------------------
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('console');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ------------------------------------------------------------
  // REFS
  // ------------------------------------------------------------
  const formRef = useRef<HTMLFormElement>(null);
  const sourceSelectRef = useRef<HTMLButtonElement>(null);
  const editFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ignore stale source-name responses
  const sourceRequestIdRef = useRef(0);

  // Cache of source-name responses (collectorId -> names)
  const sourceCacheRef = useRef<Map<number, string[]>>(new Map());

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------
  const getBackendMessage = (err: any, fallback: string): string => {
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (typeof err?.response?.data === 'string' ? err.response.data : null) ||
      err?.message ||
      fallback
    );
  };

  const extractList = (res: any): any[] => {
    const responseData = res?.data;

    return Array.isArray(responseData?.data)
      ? responseData.data
      : Array.isArray(responseData)
        ? responseData
        : [];
  };

  // ------------------------------------------------------------
  // GET CONSOLES
  // API: ConsoleMaster/GetAllConsoles
  // ------------------------------------------------------------
  const fetchConsoles = async () => {
    try {
      const res = await consoleApi.get<any>('GetAllConsoles');

      const list: ConsoleItem[] = extractList(res).map((item: any) => ({
        consoleId: Number(item?.consoleId ?? 0),
        areaId: item?.areaId,
        consoleName: String(item?.consoleName ?? ''),
        isActive: item?.isActive,
      }));

      setConsoles(list);
    } catch (err: any) {
      console.error('Failed to load consoles:', err);

      setConsoles([]);
    }
  };

  // ------------------------------------------------------------
  // GET COLLECTORS
  // API: collector-configs/data?includeInactive=false
  // ------------------------------------------------------------
  const fetchCollectors = async () => {
    try {
      const res = await collectorApi.get<any>('data?includeInactive=false');

      const list: CollectorItem[] = extractList(res).map((item: any) => ({
        collectorId: Number(item?.collectorId ?? 0),
        collectorName: String(item?.collectorName ?? ''),
        consoleId:
          item?.consoleId !== undefined && item?.consoleId !== null
            ? Number(item.consoleId)
            : undefined,
      }));

      setCollectors(list);
    } catch (err: any) {
      console.error('Failed to load collectors:', err);

      setCollectors([]);
    }
  };

  // ------------------------------------------------------------
  // GET SOURCE NAME LIST (for selected collector)
  // API: CriticalTag/CollectorTagName?collectorname=...&collectorId=...
  // Response: string[]
  // Cached per collector so re-selecting is instant.
  // ------------------------------------------------------------
  const fetchSourceNameList = async (
    collectorId: number,
    collectorName: string
  ) => {
    const requestId = ++sourceRequestIdRef.current;

    const cached = sourceCacheRef.current.get(collectorId);

    if (cached) {
      setSourceNameList(cached);
      setSourceOptionsLoading(false);

      return;
    }

    setSourceOptionsLoading(true);

    try {
      const res = await tagApi.get<any>(
        `CollectorTagName?collectorname=${encodeURIComponent(
          collectorName
        )}&collectorId=${collectorId}`
      );

      if (requestId !== sourceRequestIdRef.current) {
        return;
      }

      const unique = new Set<string>();

      for (const item of extractList(res)) {
        const name =
          typeof item === 'string' ? item : (item?.tagName ?? item?.sourceName);

        if (typeof name === 'string' && name.trim().length > 0) {
          unique.add(name);
        }
      }

      const list = Array.from(unique);

      sourceCacheRef.current.set(collectorId, list);

      setSourceNameList(list);
    } catch (err: any) {
      if (requestId !== sourceRequestIdRef.current) {
        return;
      }

      console.error('Failed to load source name list:', err);

      setSourceNameList([]);
    } finally {
      if (requestId === sourceRequestIdRef.current) {
        setSourceOptionsLoading(false);
      }
    }
  };

  // ------------------------------------------------------------
  // GET ALL SOURCE MAPPINGS
  // API: SourceMapping/GetAllSourceMappings
  // Response: { success, message, data: [] }
  // ------------------------------------------------------------
  const fetchSourceMappings = async () => {
    setListLoading(true);

    try {
      const res = await sourceApi.get<any>('GetAllSourceMappings');

      // Merge by consoleId + collectorId
      const merged = new Map<string, SourceMappingGroup>();

      extractList(res).forEach((group: any) => {
        const consoleId = Number(group?.consoleId ?? 0);
        const collectorId = Number(group?.collectorId ?? 0);

        const sources: SourceItem[] = Array.isArray(group?.sourceName)
          ? group.sourceName
              .map((source: any) => ({
                sourceMappingId: Number(source?.sourceMappingId ?? 0),
                sourceName: String(source?.sourceName ?? ''),
              }))
              .filter((source: SourceItem) => source.sourceName.trim() !== '')
          : [];

        if (sources.length === 0) {
          return;
        }

        const key = groupKey(consoleId, collectorId);
        const existing = merged.get(key);

        if (existing) {
          existing.sourceName.push(...sources);
        } else {
          merged.set(key, { consoleId, collectorId, sourceName: sources });
        }
      });

      setSourceMappings(Array.from(merged.values()));
    } catch (err: any) {
      console.error('Failed to load source mappings:', err);

      setSourceMappings([]);

      Swal.fire(
        'Warning',
        getBackendMessage(
          err,
          'Something went wrong while fetching source mappings.'
        ),
        'warning'
      );
    } finally {
      setListLoading(false);
    }
  };

  // ------------------------------------------------------------
  // INITIAL LOAD
  // ------------------------------------------------------------
  useEffect(() => {
    fetchConsoles();
    fetchCollectors();
    fetchSourceMappings();

    return () => {
      if (editFocusTimerRef.current) {
        clearTimeout(editFocusTimerRef.current);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // MAPS / OPTIONS
  // ------------------------------------------------------------
  const consoleNameMap = useMemo(() => {
    const map = new Map<number, string>();

    consoles.forEach((c) => map.set(c.consoleId, c.consoleName));

    return map;
  }, [consoles]);

  const collectorNameMap = useMemo(() => {
    const map = new Map<number, string>();

    collectors.forEach((c) => map.set(c.collectorId, c.collectorName));

    return map;
  }, [collectors]);

  const consoleOptions: SelectOption[] = useMemo(
    () =>
      consoles.map((c) => ({
        value: c.consoleId,
        label: c.consoleName,
      })),
    [consoles]
  );

  // Collectors of selected console (if API gives consoleId), else all
  const collectorOptions: SelectOption[] = useMemo(() => {
    if (!selectedConsole) {
      return [];
    }

    const hasConsoleLink = collectors.some((c) => c.consoleId !== undefined);

    const list = hasConsoleLink
      ? collectors.filter((c) => c.consoleId === selectedConsole.value)
      : collectors;

    return list.map((c) => ({
      value: c.collectorId,
      label: c.collectorName,
    }));
  }, [collectors, selectedConsole]);

  // Already saved sources of selected console + collector
  const usedSourceNames = useMemo(() => {
    if (!selectedConsole || !selectedCollector) {
      return new Set<string>();
    }

    const group = sourceMappings.find(
      (item) =>
        item.consoleId === selectedConsole.value &&
        item.collectorId === selectedCollector.value
    );

    return new Set((group?.sourceName ?? []).map((s) => s.sourceName));
  }, [sourceMappings, selectedConsole, selectedCollector]);

  // ------------------------------------------------------------
  // SOURCE OPTIONS
  // ADD  : API sources minus already saved sources
  // EDIT : API sources + already selected sources
  // ------------------------------------------------------------
  const availableSourceOptions: string[] = useMemo(() => {
    if (isEdit) {
      return Array.from(new Set([...sourceNameList, ...selectedSourceNames]));
    }

    return sourceNameList.filter((name) => !usedSourceNames.has(name));

    // selectedSourceNames only matters in edit mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEdit,
    sourceNameList,
    usedSourceNames,
    isEdit ? selectedSourceNames : null,
  ]);

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------
  const validateConsole = (value: SelectOption | null) =>
    value ? '' : 'Please select a console';

  const validateCollector = (value: SelectOption | null) =>
    value ? '' : 'Please select a collector';

  const validateSourceNames = (value: string[]) =>
    !value || value.length === 0 ? 'Please select at least one source' : '';

  const validateAll = () => {
    const newErrors: FieldErrors = {};

    const consoleError = validateConsole(selectedConsole);
    if (consoleError) newErrors.consoleId = consoleError;

    const collectorError = validateCollector(selectedCollector);
    if (collectorError) newErrors.collectorId = collectorError;

    const sourceError = validateSourceNames(selectedSourceNames);
    if (sourceError) newErrors.sourceNames = sourceError;

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ------------------------------------------------------------
  // HANDLERS: FORM
  // ------------------------------------------------------------
  const handleConsoleChange = (option: SelectOption | null) => {
    if (isEdit) {
      return;
    }

    sourceRequestIdRef.current++;

    setSelectedConsole(option);
    setSelectedCollector(null);
    setSelectedSourceNames([]);
    setSourceNameList([]);
    setSourceOptionsLoading(false);

    setErrors({
      consoleId: validateConsole(option),
      collectorId: '',
      sourceNames: '',
    });
  };

  const handleCollectorChange = (option: SelectOption | null) => {
    if (isEdit) {
      return;
    }

    setSelectedCollector(option);
    setSelectedSourceNames([]);
    setSourceNameList([]);

    setErrors((prev) => ({
      ...prev,
      collectorId: validateCollector(option),
      sourceNames: '',
    }));

    if (option) {
      fetchSourceNameList(option.value, option.label);
    } else {
      sourceRequestIdRef.current++;
      setSourceOptionsLoading(false);
    }
  };

  const handleSourceNamesChange = (values: string[]) => {
    setSelectedSourceNames(values);

    setErrors((prev) => ({
      ...prev,
      sourceNames: validateSourceNames(values),
    }));
  };

  const resetForm = () => {
    sourceRequestIdRef.current++;

    setSelectedConsole(null);
    setSelectedCollector(null);
    setSelectedSourceNames([]);
    setSourceNameList([]);
    setSourceOptionsLoading(false);
    setErrors({});
    setIsEdit(false);
    setEditingKey(null);
    setEditFormFocused(false);
  };

  // ------------------------------------------------------------
  // EDIT (one edit per console + collector)
  // ------------------------------------------------------------
  const handleEdit = (consoleId: number, collectorId: number) => {
    const group = sourceMappings.find(
      (item) => item.consoleId === consoleId && item.collectorId === collectorId
    );

    if (!group) {
      Swal.fire('Error', 'Source mapping details not found.', 'error');

      return;
    }

    const consoleName = consoleNameMap.get(consoleId) || `#${consoleId}`;
    const collectorName =
      collectorNameMap.get(collectorId) || `#${collectorId}`;

    setSelectedConsole({ value: consoleId, label: consoleName });
    setSelectedCollector({ value: collectorId, label: collectorName });

    // Plain strings -> checkbox state always matches
    setSelectedSourceNames(group.sourceName.map((s) => s.sourceName));

    setSourceNameList([]);
    setErrors({});
    setIsEdit(true);
    setEditingKey(groupKey(consoleId, collectorId));

    fetchSourceNameList(collectorId, collectorName);

    setEditFormFocused(true);

    if (editFocusTimerRef.current) {
      clearTimeout(editFocusTimerRef.current);
    }

    editFocusTimerRef.current = setTimeout(() => {
      setEditFormFocused(false);
    }, 1800);

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    window.setTimeout(() => {
      sourceSelectRef.current?.focus();
    }, 500);
  };

  // ------------------------------------------------------------
  // DELETE
  // API: DELETE SourceMapping/DeleteSourceMapping?sourceMappingId=3
  // ------------------------------------------------------------
  // Row delete = ek j API call, consoleId pass thay chhe.
  const handleDelete = async (consoleId: number, collectorId: number) => {
    // Search filter thi list ghati hoy to pan original group lo
    const group = sourceMappings.find(
      (item) => item.consoleId === consoleId && item.collectorId === collectorId
    );

    const count = group?.sourceName.length ?? 0;

    if (!group || count === 0) {
      Swal.fire('Error', 'Source mapping details not found.', 'error');

      return;
    }

    const consoleName = consoleNameMap.get(consoleId) || `#${consoleId}`;
    const collectorName =
      collectorNameMap.get(collectorId) || `#${collectorId}`;

    const confirm = await Swal.fire({
      title: 'Delete source mappings?',
      text: `All ${count.toLocaleString()} source(s) of "${consoleName} " will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, delete',
    });

    if (!confirm.isConfirmed) {
      return;
    }

    try {
      setLoading(true);

      // Button click par ek j API call.
      // Param nu naam sourceMappingId chhe, value ma consoleId pass thay chhe.
      const res = await sourceApi.delete<any>(
        `DeleteSourceMapping?sourceMappingId=${consoleId}`
      );

      if (res?.data?.success === false) {
        throw new Error(
          res.data?.message || 'Failed to delete source mapping.'
        );
      }

      if (isEdit && editingKey === groupKey(consoleId, collectorId)) {
        resetForm();
      }

      await Swal.fire(
        'Deleted!',
        res?.data?.message || 'Source mapping deleted successfully.',
        'success'
      );

      await fetchSourceMappings();
    } catch (err: any) {
      console.error('Delete source mapping failed:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to delete source mapping.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SUBMIT
  // CREATE: POST SourceMapping/CreateSourceMapping
  // UPDATE: PUT  SourceMapping/UpdateSourceMapping
  // Payload:
  // {
  //   consoleId, collectorId,
  //   sourceName: [{ sourceMappingId, sourceName }]
  // }
  // ------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateAll() || !selectedConsole || !selectedCollector) {
      return;
    }

    try {
      setLoading(true);

      if (isEdit && editingKey !== null) {
        const editingGroup = sourceMappings.find(
          (group) => groupKey(group.consoleId, group.collectorId) === editingKey
        );

        if (!editingGroup) {
          throw new Error('Source mappings for selected collector not found.');
        }

        // Map lookup = O(1)
        const existingIdMap = new Map<string, number>();

        editingGroup.sourceName.forEach((s) => {
          existingIdMap.set(s.sourceName, s.sourceMappingId);
        });

        // Existing -> keep id | New -> 0 | Deselected -> omitted
        const updatePayload = {
          consoleId: selectedConsole.value,
          collectorId: selectedCollector.value,
          sourceName: selectedSourceNames.map((sourceName) => ({
            sourceMappingId: existingIdMap.get(sourceName) ?? 0,
            sourceName,
          })),
        };

        const res = await sourceApi.put<{
          success?: boolean;
          message?: string;
          data?: any;
        }>('UpdateSourceMapping', updatePayload);

        if (res.data?.success === false) {
          throw new Error(
            res.data?.message || 'Failed to update source mapping.'
          );
        }

        await Swal.fire(
          'Updated!',
          res.data?.message || 'Source mapping updated successfully.',
          'success'
        );
      } else {
        const createPayload = {
          consoleId: selectedConsole.value,
          collectorId: selectedCollector.value,
          sourceName: selectedSourceNames.map((sourceName) => ({
            sourceMappingId: 0,
            sourceName,
          })),
        };

        const res = await sourceApi.post<{
          success?: boolean;
          message?: string;
          data?: any;
        }>('CreateSourceMapping', createPayload);

        if (res.data?.success === false) {
          throw new Error(
            res.data?.message || 'Failed to create source mapping(s).'
          );
        }

        await Swal.fire(
          'Created!',
          res.data?.message ||
            `${selectedSourceNames.length.toLocaleString()} source(s) added successfully.`,
          'success'
        );
      }

      resetForm();

      await fetchSourceMappings();
    } catch (err: any) {
      console.error('Save source mapping failed:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to save source mapping.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // LIST: FILTER -> SORT -> PAGINATE
  // ------------------------------------------------------------
  const filteredGroups = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();

    if (!term) {
      return sourceMappings;
    }

    const result: SourceMappingGroup[] = [];

    sourceMappings.forEach((group) => {
      const consoleName = (
        consoleNameMap.get(group.consoleId) || ''
      ).toLowerCase();

      const collectorName = (
        collectorNameMap.get(group.collectorId) || ''
      ).toLowerCase();

      const headerMatched =
        consoleName.includes(term) || collectorName.includes(term);

      const matched = headerMatched
        ? group.sourceName
        : group.sourceName.filter((s) =>
            s.sourceName.toLowerCase().includes(term)
          );

      if (matched.length > 0) {
        result.push({
          consoleId: group.consoleId,
          collectorId: group.collectorId,
          sourceName: matched,
        });
      }
    });

    return result;
  }, [sourceMappings, deferredSearch, consoleNameMap, collectorNameMap]);

  const sortedGroups = useMemo(() => {
    const result = [...filteredGroups];

    result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'console') {
        comparison = (consoleNameMap.get(a.consoleId) || '').localeCompare(
          consoleNameMap.get(b.consoleId) || '',
          undefined,
          { sensitivity: 'base' }
        );

        if (comparison === 0) {
          comparison = (
            collectorNameMap.get(a.collectorId) || ''
          ).localeCompare(
            collectorNameMap.get(b.collectorId) || '',
            undefined,
            { sensitivity: 'base' }
          );
        }
      } else if (sortKey === 'collector') {
        comparison = (collectorNameMap.get(a.collectorId) || '').localeCompare(
          collectorNameMap.get(b.collectorId) || '',
          undefined,
          {
            sensitivity: 'base',
          }
        );

        if (comparison === 0) {
          comparison = a.collectorId - b.collectorId;
        }
      } else {
        comparison = a.sourceName.length - b.sourceName.length;
      }

      return comparison * (sortOrder === 'asc' ? 1 : -1);
    });

    return result;
  }, [filteredGroups, sortKey, sortOrder, consoleNameMap, collectorNameMap]);

  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / PAGE_SIZE));

  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return sortedGroups.slice(start, start + PAGE_SIZE);
  }, [sortedGroups, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const totalSourceCount = useMemo(
    () => sourceMappings.reduce((sum, g) => sum + g.sourceName.length, 0),
    [sourceMappings]
  );

  // ------------------------------------------------------------
  // HANDLERS: LIST
  // ------------------------------------------------------------
  const handleClear = () => {
    setSearch('');
    setPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }

    setPage(1);
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <span className="text-xs text-gray-300">↕</span>;
    }

    return (
      <span className="text-xs text-sky-600">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // ------------------------------------------------------------
  // JSX
  // ------------------------------------------------------------
  return (
    <>
      <h1 className="text-lg font-semibold uppercase text-gray-700">
        Source Master
      </h1>

      <div className="p-4">
        {/* ADD / EDIT FORM */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={`
            rounded-lg bg-white p-5 shadow-lg
            transition-all duration-500
            ${
              editFormFocused
                ? 'shadow-xl ring-2 ring-sky-400 ring-offset-2'
                : ''
            }
          `}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-700">
                {isEdit ? 'Edit Source Mapping' : 'Add Source Mapping'}
              </h2>

              {isEdit && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                  Edit Mode
                </span>
              )}
            </div>

            {isEdit && (
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="rounded bg-gray-500 px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* CONSOLE */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Console *
              </label>

              {isEdit ? (
                <div className="flex min-h-[40px] w-full items-center rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  <span className="font-medium">
                    {selectedConsole?.label || 'N/A'}
                  </span>
                </div>
              ) : (
                <SelectDropdown
                  label=""
                  options={consoleOptions}
                  value={selectedConsole}
                  onChange={(option) =>
                    handleConsoleChange(option as SelectOption | null)
                  }
                />
              )}

              {errors.consoleId && (
                <p className="mt-1 text-xs text-red-600">{errors.consoleId}</p>
              )}
            </div>

            {/* COLLECTOR */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Collector *
              </label>

              {isEdit ? (
                <div className="flex min-h-[40px] w-full items-center rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  <span className="font-medium">
                    {selectedCollector?.label || 'N/A'}
                  </span>
                </div>
              ) : (
                <SelectDropdown
                  key={selectedConsole?.value ?? 'no-console'}
                  label=""
                  options={collectorOptions}
                  value={selectedCollector}
                  onChange={(option) =>
                    handleCollectorChange(option as SelectOption | null)
                  }
                />
              )}

              {errors.collectorId && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.collectorId}
                </p>
              )}
            </div>

            {/* SOURCES */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Source Name(s) *
              </label>

              <SourceMultiSelect
                options={availableSourceOptions}
                selectedValues={selectedSourceNames}
                onChange={handleSourceNamesChange}
                disabled={!selectedConsole || !selectedCollector || loading}
                loading={sourceOptionsLoading}
                placeholder={
                  !selectedConsole
                    ? 'Select console first'
                    : !selectedCollector
                      ? 'Select collector first'
                      : 'Select source name(s)'
                }
                inputRef={sourceSelectRef}
              />

              {errors.sourceNames && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.sourceNames}
                </p>
              )}
            </div>

            {/* BUTTON */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading || sourceOptionsLoading}
                className="rounded bg-sky-600 px-6 py-2 text-sm text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? isEdit
                    ? 'Updating...'
                    : 'Saving...'
                  : isEdit
                    ? 'Update'
                    : 'Add'}
              </button>
            </div>
          </div>
        </form>

        {/* LIST */}
        <div className="mt-5 rounded-lg bg-white p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-700">
                Source Mapping List
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                {sourceMappings.length.toLocaleString()} mapping(s) ·{' '}
                {totalSourceCount.toLocaleString()} source(s)
              </p>

              {isEdit && (
                <p className="mt-0.5 text-xs text-sky-600">
                  Currently editing: {selectedConsole?.label || 'Console'} /{' '}
                  {selectedCollector?.label || 'Collector'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <BiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-gray-400" />

                <input
                  placeholder="Search source, collector or console..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-80 rounded border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
                />
              </div>

              {search && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded bg-gray-500 px-4 py-2 text-sm text-white hover:bg-gray-600 focus:outline-none"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {listLoading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded bg-gray-100"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border border-gray-300 bg-gray-200">
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-800">
                        <button
                          type="button"
                          onClick={() => handleSort('console')}
                          className="flex items-center gap-2 hover:text-sky-600"
                        >
                          Console Name
                          {renderSortIcon('console')}
                        </button>
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-800">
                        <button
                          type="button"
                          onClick={() => handleSort('collector')}
                          className="flex items-center gap-2 hover:text-sky-600"
                        >
                          Collector Name
                          {renderSortIcon('collector')}
                        </button>
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-800">
                        <button
                          type="button"
                          onClick={() => handleSort('count')}
                          className="flex items-center gap-2 hover:text-sky-600"
                        >
                          Sources
                          {renderSortIcon('count')}
                        </button>
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-gray-800">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedGroups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          No source mappings found.
                        </td>
                      </tr>
                    ) : (
                      paginatedGroups.map((group) => {
                        const key = groupKey(
                          group.consoleId,
                          group.collectorId
                        );

                        const isEditingRow = isEdit && editingKey === key;
                        const isExpanded = expanded.has(key);

                        const sources = group.sourceName;

                        const visibleSources = isExpanded
                          ? sources.slice(0, EXPANDED_CHIPS_LIMIT)
                          : sources.slice(0, PREVIEW_CHIPS);

                        const hiddenCount =
                          sources.length - visibleSources.length;

                        return (
                          <tr
                            key={key}
                            className={`border border-gray-200 align-top transition ${
                              isEditingRow ? 'bg-sky-50/60' : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* CONSOLE */}
                            <td className="whitespace-nowrap border-r border-gray-200 px-4 py-3 font-medium text-gray-700">
                              <div className="flex items-center gap-2">
                                <span>
                                  {consoleNameMap.get(group.consoleId) ||
                                    `#${group.consoleId}`}
                                </span>

                                {isEditingRow && (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                                    Editing
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* COLLECTOR */}
                            <td className="whitespace-nowrap border-r border-gray-200 px-4 py-3 text-gray-700">
                              {collectorNameMap.get(group.collectorId) ||
                                `#${group.collectorId}`}
                            </td>

                            {/* SOURCES */}
                            <td className="px-4 py-3">
                              <div
                                className={`flex flex-wrap items-center gap-1.5 ${
                                  isExpanded ? 'max-h-48 overflow-y-auto' : ''
                                }`}
                              >
                                <span className="rounded bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                                  {sources.length.toLocaleString()} source(s)
                                </span>

                                {visibleSources.map((source) => (
                                  <span
                                    key={`${source.sourceMappingId}-${source.sourceName}`}
                                    title={source.sourceName}
                                    className="max-w-[220px] truncate rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"
                                  >
                                    {source.sourceName}
                                  </span>
                                ))}

                                {!isExpanded && hiddenCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(key)}
                                    className="text-[11px] font-medium text-sky-600 hover:underline"
                                  >
                                    +{hiddenCount.toLocaleString()} more
                                  </button>
                                )}

                                {isExpanded && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(key)}
                                    className="text-[11px] font-medium text-sky-600 hover:underline"
                                  >
                                    Show less
                                  </button>
                                )}
                              </div>

                              {isExpanded &&
                                sources.length > EXPANDED_CHIPS_LIMIT && (
                                  <p className="mt-1 text-[10px] text-gray-400">
                                    Showing first {EXPANDED_CHIPS_LIMIT} of{' '}
                                    {sources.length.toLocaleString()}. Use
                                    search to narrow down.
                                  </p>
                                )}
                            </td>

                            {/* ACTIONS */}
                            <td className="border-l border-gray-200 px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEdit(
                                      group.consoleId,
                                      group.collectorId
                                    )
                                  }
                                  disabled={loading}
                                  className={`rounded p-1.5 transition disabled:cursor-not-allowed disabled:text-gray-400 ${
                                    isEditingRow
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'text-sky-600 hover:bg-sky-50 hover:text-sky-700'
                                  }`}
                                  title="Edit sources of this collector"
                                >
                                  <BiEdit className="text-xl" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      group.consoleId,
                                      group.collectorId
                                    )
                                  }
                                  disabled={loading}
                                  className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-400"
                                  title="Delete all sources of this collector"
                                >
                                  <BiTrash className="text-xl" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {sortedGroups.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={page === totalPages}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SourceMaster;
