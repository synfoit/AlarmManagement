// src/pages/CriticalTagConfigMaster.tsx

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
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

type TagItem = {
  tagId: number;
  tagName: string;
};

type CriticalTagGroup = {
  collectorId: number;
  tagNameList: TagItem[];
};

type CollectorItem = {
  collectorId: number;
  collectorName: string;
};

type CollectorOption = {
  value: number;
  label: string;
};

type FieldErrors = {
  collectorId?: string;
  tagNames?: string;
};

type SortKey = 'collector' | 'count';

const PAGE_SIZE = 10;

// Chips shown in the table
const PREVIEW_CHIPS = 8;
const EXPANDED_CHIPS_LIMIT = 200;

// Virtual list settings
const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 288;
const OVERSCAN = 6;
const MAX_CHIPS_IN_PANEL = 8;

/* ================================================================
   TAG MULTI SELECT (virtualized, works smoothly with 26k+ options)
   ================================================================ */

type TagMultiSelectProps = {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLButtonElement | null>;
};

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Select tag name(s)',
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

  // Set gives fast lookup. Array.includes would be too slow for 26k items.
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  // Convert to lowercase once when options change, not on every key press
  const indexedOptions = useMemo(
    () => options.map((value) => ({ value, lower: value.toLowerCase() })),
    [options]
  );

  // Wait a little before applying the search text
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText), 200);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  // Close the dropdown on outside click or Escape key
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

  // Filter options by search text and "selected only"
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

  // Go back to top when the result list changes
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

  // Virtual window: only render the rows that are visible
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
              Loading tags...
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
                placeholder={`Search in ${options.length.toLocaleString()} tags...`}
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
              {options.length === 0 ? 'No tags available.' : 'No tag found.'}
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

          {/* SELECTED PREVIEW (limited) */}
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

const CriticalTagConfigMaster: React.FC = () => {
  const tagApi = useMemo(() => createCrudApi('CriticalTag'), []);

  const collectorApi = useMemo(() => createCrudApi('collector-configs'), []);

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  const [criticalTags, setCriticalTags] = useState<CriticalTagGroup[]>([]);

  const [collectors, setCollectors] = useState<CollectorItem[]>([]);

  // Tag names from the CollectorTagName API (string[])
  const [tagNameList, setTagNameList] = useState<string[]>([]);

  // Tag names loaded from the uploaded Excel file
  const [uploadedTags, setUploadedTags] = useState<string[]>([]);

  const [tagOptionsLoading, setTagOptionsLoading] = useState(false);

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const [search, setSearch] = useState('');

  // Keeps typing smooth even with big lists
  const deferredSearch = useDeferredValue(search);

  // ------------------------------------------------------------
  // FORM
  // ------------------------------------------------------------
  const [selectedCollector, setSelectedCollector] =
    useState<CollectorOption | null>(null);

  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const [errors, setErrors] = useState<FieldErrors>({});

  const [loading, setLoading] = useState(false);

  const [listLoading, setListLoading] = useState(false);

  const [excelLoading, setExcelLoading] = useState(false);

  // ------------------------------------------------------------
  // EDIT STATE
  // ------------------------------------------------------------
  const [isEdit, setIsEdit] = useState(false);

  const [editingCollectorId, setEditingCollectorId] = useState<number | null>(
    null
  );

  const [editFormFocused, setEditFormFocused] = useState(false);

  // ------------------------------------------------------------
  // TABLE UI STATE
  // ------------------------------------------------------------
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>('collector');

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ------------------------------------------------------------
  // REFS
  // ------------------------------------------------------------
  const formRef = useRef<HTMLFormElement>(null);

  const tagSelectRef = useRef<HTMLButtonElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const editFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Used to ignore old tag-name responses
  const tagRequestIdRef = useRef(0);

  // Cache of CollectorTagName responses (collectorId -> tags)
  const tagCacheRef = useRef<Map<number, string[]>>(new Map());

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
  // GET COLLECTORS
  // API: collector-configs/data?includeInactive=false
  // ------------------------------------------------------------
  const fetchCollectors = async () => {
    try {
      const res = await collectorApi.get<any>('data?includeInactive=false');

      const list: CollectorItem[] = extractList(res).map((item: any) => ({
        collectorId: Number(item?.collectorId ?? 0),
        collectorName: String(item?.collectorName ?? ''),
      }));

      setCollectors(list);
    } catch (err: any) {
      console.error('Failed to load collectors:', err);

      setCollectors([]);
    }
  };

  // ------------------------------------------------------------
  // GET TAG NAME LIST (for the selected collector)
  // API: CriticalTag/CollectorTagName?collectorname=...&collectorId=...
  // Response: string[]
  // The result is cached per collector, so selecting it again is instant.
  // ------------------------------------------------------------
  const fetchTagNameList = async (
    collectorId: number,
    collectorName: string
  ) => {
    const requestId = ++tagRequestIdRef.current;

    const cached = tagCacheRef.current.get(collectorId);

    if (cached) {
      setTagNameList(cached);
      setTagOptionsLoading(false);

      return;
    }

    setTagOptionsLoading(true);

    try {
      const res = await tagApi.get<any>(
        `CollectorTagName?collectorname=${encodeURIComponent(
          collectorName
        )}&collectorId=${collectorId}`
      );

      // Ignore this response if a newer request was made
      if (requestId !== tagRequestIdRef.current) {
        return;
      }

      const unique = new Set<string>();

      for (const item of extractList(res)) {
        const name = typeof item === 'string' ? item : item?.tagName;

        if (typeof name === 'string' && name.trim().length > 0) {
          unique.add(name);
        }
      }

      const list = Array.from(unique);

      tagCacheRef.current.set(collectorId, list);

      setTagNameList(list);
    } catch (err: any) {
      if (requestId !== tagRequestIdRef.current) {
        return;
      }

      console.error('Failed to load tag name list:', err);

      setTagNameList([]);
    } finally {
      if (requestId === tagRequestIdRef.current) {
        setTagOptionsLoading(false);
      }
    }
  };

  // ------------------------------------------------------------
  // GET ALL CRITICAL TAGS
  // API: CriticalTag/GetAllDtoData
  // ------------------------------------------------------------
  const fetchCriticalTags = async () => {
    setListLoading(true);

    try {
      const res = await tagApi.get<any>('GetAllDtoData');

      const merged = new Map<number, TagItem[]>();

      extractList(res).forEach((group: any) => {
        const collectorId = Number(group?.collectorId ?? 0);

        const tags: TagItem[] = Array.isArray(group?.tagNameList)
          ? group.tagNameList
              .map((tag: any) => ({
                tagId: Number(tag?.tagId ?? 0),
                tagName: String(tag?.tagName ?? ''),
              }))
              .filter((tag: TagItem) => tag.tagName.trim() !== '')
          : [];

        if (tags.length === 0) {
          return;
        }

        merged.set(collectorId, [...(merged.get(collectorId) ?? []), ...tags]);
      });

      setCriticalTags(
        Array.from(merged.entries()).map(([collectorId, tagNameList]) => ({
          collectorId,
          tagNameList,
        }))
      );
    } catch (err: any) {
      console.error('Failed to load critical tags:', err);

      setCriticalTags([]);

      Swal.fire(
        'Warning',
        getBackendMessage(err, 'Something went wrong while fetching tags.'),
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
    fetchCollectors();
    fetchCriticalTags();

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
  const collectorNameMap = useMemo(() => {
    const map = new Map<number, string>();

    collectors.forEach((collector) => {
      map.set(collector.collectorId, collector.collectorName);
    });

    return map;
  }, [collectors]);

  const collectorOptions: CollectorOption[] = useMemo(
    () =>
      collectors.map((collector) => ({
        value: collector.collectorId,
        label: collector.collectorName,
      })),
    [collectors]
  );

  // Tags already saved for the selected collector
  const usedTagNames = useMemo(() => {
    if (!selectedCollector) {
      return new Set<string>();
    }

    const group = criticalTags.find(
      (item) => item.collectorId === selectedCollector.value
    );

    return new Set((group?.tagNameList ?? []).map((tag) => tag.tagName));
  }, [criticalTags, selectedCollector]);

  // ------------------------------------------------------------
  // TAG OPTIONS
  // API tags + Excel tags (merged, no duplicates)
  // ADD  : remove tags that are already saved
  // EDIT : add tags that are already selected
  // ------------------------------------------------------------
  const availableTagOptions: string[] = useMemo(() => {
    const merged = new Set<string>([...tagNameList, ...uploadedTags]);

    if (isEdit) {
      selectedTagNames.forEach((name) => merged.add(name));
    } else {
      usedTagNames.forEach((name) => merged.delete(name));
    }

    return Array.from(merged);

    // selectedTagNames is only needed in edit mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEdit,
    tagNameList,
    uploadedTags,
    usedTagNames,
    isEdit ? selectedTagNames : null,
  ]);

  // ------------------------------------------------------------
  // EXCEL UPLOAD
  // Reads the first column of the first sheet, skips the header,
  // and removes duplicates.
  // ------------------------------------------------------------
  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setExcelLoading(true);

      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, { type: 'array' });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw new Error('Excel file has no sheet.');
      }

      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const unique = new Set<string>();

      rows.forEach((row, index) => {
        const value = String(row?.[0] ?? '').trim();

        if (!value) {
          return;
        }

        // Skip the header row, like "TagName", "Tag Name" or "tag_name"
        if (index === 0 && /^tag\s*_?\s*name$/i.test(value)) {
          return;
        }

        unique.add(value);
      });

      if (unique.size === 0) {
        Swal.fire(
          'Warning',
          'No tag names found in the Excel file.',
          'warning'
        );

        return;
      }

      setUploadedTags(Array.from(unique));

      Swal.fire(
        'Uploaded',
        `${unique.size.toLocaleString()} tag(s) loaded from Excel. Now select them from the dropdown.`,
        'success'
      );
    } catch (err: any) {
      console.error('Excel upload failed:', err);

      Swal.fire('Error', 'Invalid or unreadable Excel file.', 'error');
    } finally {
      setExcelLoading(false);

      // Allows uploading the same file again
      e.target.value = '';
    }
  };

  const clearUploadedTags = () => {
    setUploadedTags([]);

    // In add mode, remove selected tags that came only from Excel
    if (!isEdit) {
      const apiSet = new Set(tagNameList);

      setSelectedTagNames((prev) => prev.filter((name) => apiSet.has(name)));
    }
  };

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------
  const validateCollector = (value: CollectorOption | null) =>
    value ? '' : 'Please select a collector';

  const validateTagNames = (value: string[]) =>
    !value || value.length === 0 ? 'Please select at least one tag' : '';

  const validateAll = () => {
    const newErrors: FieldErrors = {};

    const collectorError = validateCollector(selectedCollector);

    if (collectorError) {
      newErrors.collectorId = collectorError;
    }

    const tagError = validateTagNames(selectedTagNames);

    if (tagError) {
      newErrors.tagNames = tagError;
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ------------------------------------------------------------
  // HANDLERS: FORM
  // ------------------------------------------------------------
  const handleCollectorChange = (option: CollectorOption | null) => {
    if (isEdit) {
      return;
    }

    setSelectedCollector(option);

    setSelectedTagNames([]);

    setTagNameList([]);

    // Excel tags belong to the previous collector, so clear them
    setUploadedTags([]);

    setErrors({
      collectorId: validateCollector(option),
      tagNames: '',
    });

    if (option) {
      fetchTagNameList(option.value, option.label);
    } else {
      tagRequestIdRef.current++;

      setTagOptionsLoading(false);
    }
  };

  const handleTagNamesChange = (values: string[]) => {
    setSelectedTagNames(values);

    setErrors((prev) => ({
      ...prev,
      tagNames: validateTagNames(values),
    }));
  };

  const resetForm = () => {
    tagRequestIdRef.current++;

    setSelectedCollector(null);

    setSelectedTagNames([]);

    setTagNameList([]);

    setUploadedTags([]);

    setTagOptionsLoading(false);

    setErrors({});

    setIsEdit(false);

    setEditingCollectorId(null);

    setEditFormFocused(false);
  };

  // ------------------------------------------------------------
  // EDIT (one edit per collector)
  // ------------------------------------------------------------
  const handleEdit = (collectorId: number) => {
    const group = criticalTags.find((item) => item.collectorId === collectorId);

    if (!group) {
      Swal.fire('Error', 'Critical tag details not found.', 'error');

      return;
    }

    const collectorName =
      collectorNameMap.get(collectorId) || `#${collectorId}`;

    setSelectedCollector({ value: collectorId, label: collectorName });

    setSelectedTagNames(group.tagNameList.map((tag) => tag.tagName));

    setTagNameList([]);

    setUploadedTags([]);

    setErrors({});

    setIsEdit(true);

    setEditingCollectorId(collectorId);

    fetchTagNameList(collectorId, collectorName);

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
      tagSelectRef.current?.focus();
    }, 500);
  };

  // ------------------------------------------------------------
  // DELETE (all critical tags of a collector)
  // API: DELETE CriticalTag/{collectorId}
  // ------------------------------------------------------------
  const handleDelete = async (collectorId: number) => {
    const collectorName =
      collectorNameMap.get(collectorId) || `#${collectorId}`;

    const group = criticalTags.find((item) => item.collectorId === collectorId);

    const count = group?.tagNameList.length ?? 0;

    const confirm = await Swal.fire({
      title: 'Delete critical tags?',
      text: `All ${count.toLocaleString()} tag(s) of "${collectorName}" will be removed.`,
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

      const res = await tagApi.delete<any>(String(collectorId));

      if (res?.data?.success === false) {
        throw new Error(res.data?.message || 'Failed to delete critical tag.');
      }

      await Swal.fire(
        'Deleted!',
        res?.data?.message || 'Critical tags deleted successfully.',
        'success'
      );

      if (isEdit && editingCollectorId === collectorId) {
        resetForm();
      }

      await fetchCriticalTags();
    } catch (err: any) {
      console.error('Delete critical tag failed:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to delete critical tag.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SUBMIT
  // Selected tags (API + Excel) use the same payload: { tagId, tagName }
  // ------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateAll() || !selectedCollector) {
      return;
    }

    try {
      setLoading(true);

      if (isEdit && editingCollectorId !== null) {
        const editingGroup = criticalTags.find(
          (group) => group.collectorId === editingCollectorId
        );

        if (!editingGroup) {
          throw new Error('Tags for selected collector were not found.');
        }

        // Map lookup is fast. Array.find on 26k tags would hang the page.
        const existingIdMap = new Map<string, number>();

        editingGroup.tagNameList.forEach((tag) => {
          existingIdMap.set(tag.tagName, tag.tagId);
        });

        // Existing tag: keep tagId | New tag: 0 | Deselected tag: not sent
        const updatePayload = {
          tagNameList: selectedTagNames.map((tagName) => ({
            tagId: existingIdMap.get(tagName) ?? 0,
            tagName,
          })),
          collectorId: selectedCollector.value,
        };

        const res = await tagApi.put<{
          success?: boolean;
          message?: string;
          data?: any;
        }>('', updatePayload);

        if (res.data?.success === false) {
          throw new Error(
            res.data?.message || 'Failed to update critical tag.'
          );
        }

        await Swal.fire(
          'Updated!',
          res.data?.message || 'Critical tag updated successfully.',
          'success'
        );
      } else {
        const createPayload = {
          tagNameList: selectedTagNames.map((tagName) => ({
            tagId: 0,
            tagName,
          })),
          collectorId: selectedCollector.value,
        };

        const res = await tagApi.post<{
          success?: boolean;
          message?: string;
          data?: any;
        }>('', createPayload);

        if (res.data?.success === false) {
          throw new Error(
            res.data?.message || 'Failed to create critical tag.'
          );
        }

        await Swal.fire(
          'Created!',
          res.data?.message ||
            `${selectedTagNames.length.toLocaleString()} tag(s) added successfully.`,
          'success'
        );
      }

      resetForm();

      await fetchCriticalTags();
    } catch (err: any) {
      console.error('Save critical tag failed:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to save critical tag.'),
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
      return criticalTags;
    }

    const result: CriticalTagGroup[] = [];

    criticalTags.forEach((group) => {
      const collectorName = (
        collectorNameMap.get(group.collectorId) || ''
      ).toLowerCase();

      const matchedTags = collectorName.includes(term)
        ? group.tagNameList
        : group.tagNameList.filter((tag) =>
            tag.tagName.toLowerCase().includes(term)
          );

      if (matchedTags.length > 0) {
        result.push({
          collectorId: group.collectorId,
          tagNameList: matchedTags,
        });
      }
    });

    return result;
  }, [criticalTags, deferredSearch, collectorNameMap]);

  const sortedGroups = useMemo(() => {
    const result = [...filteredGroups];

    result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'collector') {
        const aName = collectorNameMap.get(a.collectorId) || '';
        const bName = collectorNameMap.get(b.collectorId) || '';

        comparison = aName.localeCompare(bName, undefined, {
          sensitivity: 'base',
        });

        if (comparison === 0) {
          comparison = a.collectorId - b.collectorId;
        }
      } else {
        comparison = a.tagNameList.length - b.tagNameList.length;
      }

      return comparison * (sortOrder === 'asc' ? 1 : -1);
    });

    return result;
  }, [filteredGroups, sortKey, sortOrder, collectorNameMap]);

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

  const totalTagCount = useMemo(
    () => criticalTags.reduce((sum, g) => sum + g.tagNameList.length, 0),
    [criticalTags]
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

  const toggleExpand = (collectorId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(collectorId)) {
        next.delete(collectorId);
      } else {
        next.add(collectorId);
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
        Critical Tag Config Master
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
                {isEdit ? 'Edit Critical Tag' : 'Add Critical Tag'}
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  label=""
                  options={collectorOptions}
                  value={selectedCollector}
                  onChange={(option) =>
                    handleCollectorChange(option as CollectorOption | null)
                  }
                />
              )}

              {errors.collectorId && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.collectorId}
                </p>
              )}
            </div>

            {/* TAGS */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Tag Name(s) *
              </label>

              <TagMultiSelect
                options={availableTagOptions}
                selectedValues={selectedTagNames}
                onChange={handleTagNamesChange}
                disabled={!selectedCollector || loading}
                loading={tagOptionsLoading}
                placeholder={
                  selectedCollector
                    ? 'Select tag name(s)'
                    : 'Select collector first'
                }
                inputRef={tagSelectRef}
              />

              {/* EXCEL UPLOAD */}
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelUpload}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedCollector || loading || excelLoading}
                  className="text-[11px] font-medium text-sky-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                >
                  {excelLoading ? 'Reading Excel...' : 'Upload Excel'}
                </button>

                {uploadedTags.length > 0 && (
                  <>
                    <span className="text-[11px] text-gray-500">
                      {uploadedTags.length.toLocaleString()} tag(s) from Excel
                    </span>

                    <button
                      type="button"
                      onClick={clearUploadedTags}
                      disabled={loading}
                      className="text-[11px] font-medium text-red-500 hover:underline disabled:text-gray-300"
                    >
                      Remove Excel tags
                    </button>
                  </>
                )}
              </div>

              <p className="mt-0.5 text-[10px] text-gray-400">
                Excel: first column = tag name (one tag per row)
              </p>

              {errors.tagNames && (
                <p className="mt-1 text-xs text-red-600">{errors.tagNames}</p>
              )}
            </div>

            {/* BUTTON */}
            <div className="mt-5 gap-2">
              <button
                type="submit"
                disabled={loading || tagOptionsLoading}
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
                Critical Tag List
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                {criticalTags.length.toLocaleString()} collector(s) ·{' '}
                {totalTagCount.toLocaleString()} tag(s)
              </p>

              {isEdit && (
                <p className="mt-0.5 text-xs text-sky-600">
                  Currently editing: {selectedCollector?.label || 'Collector'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <BiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-gray-400" />

                <input
                  placeholder="Search tag or collector..."
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
                          Tags
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
                          colSpan={3}
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          No critical tags found.
                        </td>
                      </tr>
                    ) : (
                      paginatedGroups.map((group) => {
                        const isEditingRow =
                          isEdit && editingCollectorId === group.collectorId;

                        const isExpanded = expanded.has(group.collectorId);

                        const tags = group.tagNameList;

                        const visibleTags = isExpanded
                          ? tags.slice(0, EXPANDED_CHIPS_LIMIT)
                          : tags.slice(0, PREVIEW_CHIPS);

                        const hiddenCount = tags.length - visibleTags.length;

                        return (
                          <tr
                            key={group.collectorId}
                            className={`border border-gray-200 align-top transition ${
                              isEditingRow ? 'bg-sky-50/60' : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* COLLECTOR */}
                            <td className="whitespace-nowrap border-r border-gray-200 px-4 py-3 font-medium text-gray-700">
                              <div className="flex items-center gap-2">
                                <span>
                                  {collectorNameMap.get(group.collectorId) ||
                                    `#${group.collectorId}`}
                                </span>

                                {isEditingRow && (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                                    Editing
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* TAGS */}
                            <td className="px-4 py-3">
                              <div
                                className={`flex flex-wrap items-center gap-1.5 ${
                                  isExpanded ? 'max-h-48 overflow-y-auto' : ''
                                }`}
                              >
                                <span className="rounded bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                                  {tags.length.toLocaleString()} tag(s)
                                </span>

                                {visibleTags.map((tag) => (
                                  <span
                                    key={`${tag.tagId}-${tag.tagName}`}
                                    title={tag.tagName}
                                    className="max-w-[220px] truncate rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700"
                                  >
                                    {tag.tagName}
                                  </span>
                                ))}

                                {!isExpanded && hiddenCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExpand(group.collectorId)
                                    }
                                    className="text-[11px] font-medium text-sky-600 hover:underline"
                                  >
                                    +{hiddenCount.toLocaleString()} more
                                  </button>
                                )}

                                {isExpanded && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExpand(group.collectorId)
                                    }
                                    className="text-[11px] font-medium text-sky-600 hover:underline"
                                  >
                                    Show less
                                  </button>
                                )}
                              </div>

                              {isExpanded &&
                                tags.length > EXPANDED_CHIPS_LIMIT && (
                                  <p className="mt-1 text-[10px] text-gray-400">
                                    Showing first {EXPANDED_CHIPS_LIMIT} of{' '}
                                    {tags.length.toLocaleString()}. Use search
                                    to narrow down.
                                  </p>
                                )}
                            </td>

                            {/* ACTIONS */}
                            <td className="border-l border-gray-200 px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(group.collectorId)}
                                  disabled={loading}
                                  className={`rounded p-1.5 transition disabled:cursor-not-allowed disabled:text-gray-400 ${
                                    isEditingRow
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'text-sky-600 hover:bg-sky-50 hover:text-sky-700'
                                  }`}
                                  title="Edit tags of this collector"
                                >
                                  <BiEdit className="text-xl" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(group.collectorId)
                                  }
                                  disabled={loading}
                                  className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-400"
                                  title="Delete all tags of this collector"
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

export default CriticalTagConfigMaster;
