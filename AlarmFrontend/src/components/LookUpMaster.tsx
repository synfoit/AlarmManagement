// src/pages/LookUpMaster.tsx

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiPlus, BiSave, BiSolidTrash } from 'react-icons/bi';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';
import SelectDropdown from '../features/ui/SelectDropdown';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface LookupDetail {
  id: number;
  sourceValue: string;
  targetValue: string;
  dataType: string;
}

interface LookupTable {
  id: number; // also required by DataTable
  lookupName: string;
  description: string;
  isActive: boolean;
  createDate?: string;
  details: LookupDetail[];
}

// table row = lookup table + computed fields (so DataTable can sort them)
interface LookupRow extends LookupTable {
  valueCount: number;
  statusText: string;
  actions?: string;
}

// editable row of the "Lookup Values" editor
interface DetailRow {
  key: number; // local React key
  id: number; // 0 = not saved yet
  sourceValue: string;
  targetValue: string;
  dataType: string;
  savedSource: string; // last value known by the server
  savedTarget: string;
  savedDataType: string;
  busy: boolean;
}

interface FormState {
  lookupName: string;
  description: string;
  isActive: boolean;
}

type FieldErrors = Partial<Record<'lookupName', string>>;

/* ------------------------------------------------------------------ */
/* Config */
/* ------------------------------------------------------------------ */

// createCrudApi prefixes /api  ->  /api/etl/lookup-tables
const RESOURCE_NAME = 'etl/lookup-tables';

const PAGE_SIZE = 10;

// data type dropdown options (change this list if backend supports more)
const DATA_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Int' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'bool', label: 'Bool' },
  { value: 'datetime', label: 'DateTime' },
];
const DEFAULT_DATA_TYPE = 'string';

const EMPTY_FORM: FormState = {
  lookupName: '',
  description: '',
  isActive: true,
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

let keyCounter = 0;
const nextKey = () => ++keyCounter;

const newEmptyRow = (): DetailRow => ({
  key: nextKey(),
  id: 0,
  sourceValue: '',
  targetValue: '',
  dataType: DEFAULT_DATA_TYPE,
  savedSource: '',
  savedTarget: '',
  savedDataType: DEFAULT_DATA_TYPE,
  busy: false,
});

const rowFromDetail = (d: LookupDetail): DetailRow => ({
  key: nextKey(),
  id: d.id,
  sourceValue: d.sourceValue ?? '',
  targetValue: d.targetValue ?? '',
  dataType: d.dataType || DEFAULT_DATA_TYPE,
  savedSource: d.sourceValue ?? '',
  savedTarget: d.targetValue ?? '',
  savedDataType: d.dataType || DEFAULT_DATA_TYPE,
  busy: false,
});

const isRowDirty = (r: DetailRow) =>
  r.id === 0 ||
  r.sourceValue !== r.savedSource ||
  r.targetValue !== r.savedTarget ||
  r.dataType !== r.savedDataType;

// a row is blank when nothing is typed (data type alone doesn't count)
const isRowBlank = (r: DetailRow) =>
  r.sourceValue.trim() === '' && r.targetValue.trim() === '';

// accepts both a plain array and a { data: [...] } wrapper
function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const inner = (payload as { data?: unknown } | null | undefined)?.data;

  return Array.isArray(inner) ? (inner as T[]) : [];
}

// accepts { ...table } or { data: { ...table } }
function asTable(payload: unknown): Partial<LookupTable> | null {
  if (!payload || typeof payload !== 'object') return null;

  const obj = payload as Record<string, unknown>;

  if ('lookupName' in obj) return obj as Partial<LookupTable>;

  if (obj.data && typeof obj.data === 'object') {
    return obj.data as Partial<LookupTable>;
  }

  return null;
}

function normalizeTable(raw: Partial<LookupTable>): LookupTable {
  return {
    id: Number(raw.id ?? 0),
    lookupName: raw.lookupName ?? '',
    description: raw.description ?? '',
    isActive: Boolean(raw.isActive),
    createDate: raw.createDate,
    details: (raw.details ?? []).map((d) => ({
      id: Number(d.id ?? 0),
      sourceValue: d.sourceValue ?? '',
      targetValue: d.targetValue ?? '',
      dataType: d.dataType || DEFAULT_DATA_TYPE,
    })),
  };
}

const getBackendMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.response?.data?.title ||
  (typeof err?.response?.data === 'string' && err.response.data
    ? err.response.data
    : null) ||
  err?.message ||
  fallback;

const formatDate = (date?: string) => {
  if (!date || date.startsWith('0001-01-01')) return 'N/A';

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
};

// if the server sends a type that is not in DATA_TYPES, still show it
const typeOptionsFor = (current: string) =>
  current && !DATA_TYPE_OPTIONS.some((o) => o.value === current)
    ? [...DATA_TYPE_OPTIONS, { value: current, label: current }]
    : DATA_TYPE_OPTIONS;

const inputClass =
  'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none disabled:bg-gray-100';

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_72px] gap-2';

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

const LookUpMaster: React.FC = () => {
  const lookupApi = useMemo(() => createCrudApi(RESOURCE_NAME), []);

  /* ---------------- list state ---------------- */

  const [tables, setTables] = useState<LookupTable[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof LookupRow>('lookupName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  /* ---------------- form state ---------------- */

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // value rows editor
  const [detailRows, setDetailRows] = useState<DetailRow[]>(() => [
    newEmptyRow(),
  ]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // details as the server currently has them (sent along with the PUT)
  const [savedDetails, setSavedDetails] = useState<LookupDetail[]>([]);

  /* ------------------------------------------------------------ */
  /* GET ALL  (GET /api/etl/lookup-tables)                         */
  /* ------------------------------------------------------------ */

  const fetchTables = async () => {
    setListLoading(true);

    try {
      const res = await lookupApi.get<any>('');

      const list = asList<Partial<LookupTable>>(res?.data).map(normalizeTable);

      setTables(list);
    } catch (err: any) {
      console.error('Failed to load lookup tables:', err);

      setTables([]);

      Swal.fire(
        'Warning',
        getBackendMessage(err, 'Something went wrong while fetching lookups.'),
        'warning'
      );
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------ */
  /* VALIDATION                                                    */
  /* ------------------------------------------------------------ */

  const validateName = (value: string): string => {
    const val = value.trim();

    if (!val) return 'Lookup Name cannot be blank';
    if (val.length < 2) return 'Lookup Name must be at least 2 characters';

    return '';
  };

  // validates a single value row (blank rows are handled by the caller)
  const validateRow = (row: DetailRow, all: DetailRow[]): string => {
    const source = row.sourceValue.trim();
    const target = row.targetValue.trim();

    if (!source) return 'Source value is required';
    if (!target) return 'Target value is required';
    if (!row.dataType) return 'Data type is required';

    const duplicate = all.some(
      (r) => r.key !== row.key && r.sourceValue.trim() === source
    );

    if (duplicate) return `Source value "${source}" is duplicated`;

    return '';
  };

  /* ------------------------------------------------------------ */
  /* FORM HANDLERS                                                 */
  /* ------------------------------------------------------------ */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'lookupName') {
      setErrors((prev) => ({ ...prev, lookupName: validateName(value) }));
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setIsEdit(false);
    setEditingId(null);
    setDetailRows([newEmptyRow()]);
    setRowErrors({});
    setSavedDetails([]);
  };

  /* ------------------------------------------------------------ */
  /* VALUE ROW HANDLERS (local editing)                            */
  /* ------------------------------------------------------------ */

  const updateRow = (key: number, patch: Partial<DetailRow>) => {
    setDetailRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );

    setRowErrors((prev) => {
      if (!(key in prev)) return prev;

      const next = { ...prev };
      delete next[key];

      return next;
    });
  };

  const addRow = () => setDetailRows((prev) => [...prev, newEmptyRow()]);

  // re-reads the lookup from the server and merges it into the editor,
  // keeping rows that still have unsaved edits
  const refreshDetailsFromServer = async (tableId: number) => {
    const res = await lookupApi.get<any>(`${tableId}`);

    const raw = asTable(res?.data);

    if (!raw) return;

    const fresh = normalizeTable(raw);

    setSavedDetails(fresh.details);

    setDetailRows((prev) => {
      const merged: DetailRow[] = fresh.details.map((d) => {
        const local = prev.find((r) => r.id === d.id);

        // keep unsaved typing of an existing row
        if (local && isRowDirty(local)) {
          return {
            ...local,
            savedSource: d.sourceValue,
            savedTarget: d.targetValue,
            savedDataType: d.dataType,
          };
        }

        return rowFromDetail(d);
      });

      // rows that were never saved stay at the bottom
      // (no empty row is added automatically - only "Add Row" creates one)
      const unsaved = prev.filter((r) => r.id === 0 && !isRowBlank(r));

      return [...merged, ...unsaved];
    });
  };

  // edit mode: save ONE row
  //   new row      -> POST /api/etl/lookup-tables/{id}/details
  //   existing row -> PUT  /api/etl/lookup-tables/details/{detailId}
  const saveDetailRow = async (row: DetailRow) => {
    if (editingId === null) return;

    const message = validateRow(row, detailRows);

    if (message) {
      setRowErrors((prev) => ({ ...prev, [row.key]: message }));
      return;
    }

    const payload: LookupDetail = {
      id: row.id,
      sourceValue: row.sourceValue.trim(),
      targetValue: row.targetValue.trim(),
      dataType: row.dataType,
    };

    updateRow(row.key, { busy: true });

    try {
      if (row.id === 0) {
        // the new row is removed from the editor, the fresh list from the
        // server brings it back with its real id
        await lookupApi.post<any>(`${editingId}/details`, payload);

        setDetailRows((prev) => prev.filter((r) => r.key !== row.key));

        await refreshDetailsFromServer(editingId);
      } else {
        await lookupApi.put<any>(`details/${row.id}`, payload);

        updateRow(row.key, {
          sourceValue: payload.sourceValue,
          targetValue: payload.targetValue,
          dataType: payload.dataType,
          savedSource: payload.sourceValue,
          savedTarget: payload.targetValue,
          savedDataType: payload.dataType,
          busy: false,
        });

        setSavedDetails((prev) =>
          prev.map((d) => (d.id === row.id ? payload : d))
        );
      }

      // keeps the "values" column of the list in sync
      fetchTables();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Lookup value saved',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err: any) {
      console.error('Save lookup value failed:', err);

      updateRow(row.key, { busy: false });

      // the new row was removed above only on success, so on failure it stays
      setRowErrors((prev) => ({
        ...prev,
        [row.key]: getBackendMessage(err, 'Failed to save lookup value.'),
      }));
    }
  };

  // remove a row (edit mode saved row -> DELETE /details/{detailId})
  const removeRow = async (row: DetailRow) => {
    // not saved on the server -> just drop it locally
    if (row.id === 0 || !isEdit) {
      setDetailRows((prev) => {
        const next = prev.filter((r) => r.key !== row.key);

        return next.length > 0 ? next : [newEmptyRow()];
      });

      return;
    }

    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete value: <strong>${row.savedSource} → ${row.savedTarget}</strong>`,
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

    updateRow(row.key, { busy: true });

    try {
      const res = await lookupApi.delete<any>(`details/${row.id}`);

      setDetailRows((prev) => {
        const next = prev.filter((r) => r.key !== row.key);

        return next.length > 0 ? next : [newEmptyRow()];
      });

      setSavedDetails((prev) => prev.filter((d) => d.id !== row.id));

      fetchTables();

      Swal.fire(
        'Deleted',
        res?.data?.message || 'Lookup value deleted successfully.',
        'success'
      );
    } catch (err: any) {
      console.error('Delete lookup value failed:', err);

      updateRow(row.key, { busy: false });

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to delete lookup value.'),
        'error'
      );
    }
  };

  /* ------------------------------------------------------------ */
  /* EDIT  (GET /api/etl/lookup-tables/{id})                       */
  /* ------------------------------------------------------------ */

  const handleEdit = async (id: number) => {
    try {
      setLoading(true);

      const res = await lookupApi.get<any>(`${id}`);

      const raw = asTable(res?.data);

      if (!raw) {
        Swal.fire('Error', 'Lookup details not found.', 'error');
        return;
      }

      const table = normalizeTable(raw);

      setFormData({
        lookupName: table.lookupName,
        description: table.description,
        isActive: table.isActive,
      });

      setSavedDetails(table.details);

      setDetailRows(
        table.details.length > 0
          ? table.details.map(rowFromDetail)
          : [newEmptyRow()]
      );

      setRowErrors({});
      setErrors({});
      setIsEdit(true);
      setEditingId(table.id || id);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to load lookup:', err);

      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to load lookup details.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------ */
  /* ADD / UPDATE                                                  */
  /*   create: POST /api/etl/lookup-tables  (with details)         */
  /*   update: PUT  /api/etl/lookup-tables/{id}                    */
  /* ------------------------------------------------------------ */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // ---- validate name ----
    const nameError = validateName(formData.lookupName);

    setErrors(nameError ? { lookupName: nameError } : {});

    // ---- validate value rows (create mode only) ----
    let createDetails: LookupDetail[] = [];

    if (!isEdit) {
      const filled = detailRows.filter((r) => !isRowBlank(r));

      const nextRowErrors: Record<number, string> = {};

      filled.forEach((r) => {
        const message = validateRow(r, filled);

        if (message) nextRowErrors[r.key] = message;
      });

      setRowErrors(nextRowErrors);

      if (Object.keys(nextRowErrors).length > 0) return;

      createDetails = filled.map((r) => ({
        id: 0,
        sourceValue: r.sourceValue.trim(),
        targetValue: r.targetValue.trim(),
        dataType: r.dataType,
      }));
    }

    if (nameError) return;

    const payload = {
      lookupName: formData.lookupName.trim(),
      description: formData.description.trim(),
      isActive: formData.isActive,
      // update: the details are managed row by row, so the server's current
      // details are sent back unchanged
      details: isEdit ? savedDetails : createDetails,
    };

    try {
      setLoading(true);

      const res =
        isEdit && editingId !== null
          ? await lookupApi.put<any>(`${editingId}`, payload)
          : await lookupApi.post<any>('', payload);

      const message =
        res?.data?.message ||
        (isEdit
          ? 'Lookup updated successfully.'
          : 'Lookup created successfully.');

      await Swal.fire(
        isEdit ? 'Lookup Updated!' : 'Lookup Created!',
        message,
        'success'
      );

      resetForm();
      await fetchTables();
    } catch (err: any) {
      console.error('Save lookup failed:', err, payload);

      // e.g. { "message": "Lookup name already exists." }
      Swal.fire(
        'Error',
        getBackendMessage(err, 'Failed to save lookup.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------ */
  /* DELETE  (DELETE /api/etl/lookup-tables/{id} -> deactivates)   */
  /* ------------------------------------------------------------ */

  const handleDelete = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete lookup: <strong>${name}</strong>`,
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

      const res = await lookupApi.delete<any>(`${id}`);

      await Swal.fire(
        'Deleted',
        res?.data?.message || 'Lookup table deactivated successfully.',
        'success'
      );

      if (editingId === id) resetForm();

      await fetchTables();
    } catch (err: any) {
      console.error('Delete lookup failed:', err);

      Swal.fire('Error', getBackendMessage(err, 'Delete failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------ */
  /* LIST: rows / search / sort / pagination                       */
  /* ------------------------------------------------------------ */

  const rows = useMemo<LookupRow[]>(
    () =>
      tables.map((t) => ({
        ...t,
        valueCount: t.details.length,
        statusText: t.isActive ? 'Active' : 'Inactive',
      })),
    [tables]
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return rows;

    return rows.filter(
      (t) =>
        t.lookupName.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.statusText.toLowerCase().includes(term) ||
        t.details.some(
          (d) =>
            d.sourceValue.toLowerCase().includes(term) ||
            d.targetValue.toLowerCase().includes(term) ||
            d.dataType.toLowerCase().includes(term)
        )
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const result = [...filteredRows];

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
  }, [filteredRows, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSearch = () => setPage(1);

  const handleClear = () => {
    setSearch('');
    setPage(1);
  };

  const handleSort = (key: keyof LookupRow) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }

    setPage(1);
  };

  /* ------------------------------------------------------------ */
  /* ADD ROW availability                                          */
  /* ------------------------------------------------------------ */

  // Add Row is allowed only when every existing row is already saved
  //  - edit mode:   no row has unsaved changes (new rows with id 0 count as unsaved)
  //  - create mode: every row has both source and target filled
  const canAddRow = isEdit
    ? !detailRows.some((r) => isRowDirty(r) || r.busy)
    : !detailRows.some(
        (r) => r.sourceValue.trim() === '' || r.targetValue.trim() === ''
      );

  /* ------------------------------------------------------------ */
  /* UI                                                            */
  /* ------------------------------------------------------------ */

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Lookup Master
      </h1>

      <div className="p-4">
        {/* ================================================== */}
        {/* ADD / EDIT FORM */}
        {/* ================================================== */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-lg shadow-lg"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-700">
              {isEdit ? 'Edit Lookup' : 'Add Lookup'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* LOOKUP NAME */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Lookup Name *
              </label>

              <input
                name="lookupName"
                value={formData.lookupName}
                onChange={handleChange}
                placeholder="e.g. PriorityMap"
                disabled={loading}
                className={inputClass}
              />

              {errors.lookupName && (
                <p className="text-red-600 text-xs mt-1">{errors.lookupName}</p>
              )}
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Description
              </label>

              <input
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter description"
                disabled={loading}
                className={inputClass}
              />
            </div>

            {/* STATUS (edit only) */}
            {isEdit && (
              <div>
                <label className="block font-medium text-sm mb-1 text-gray-500">
                  Status
                </label>

                <label className="h-[38px] flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    disabled={loading}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-sky-600"
                  />

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      formData.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* ================================================ */}
          {/* LOOKUP VALUES (details) */}
          {/* ================================================ */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Lookup Values
              </h3>

              {isEdit && (
                <span className="text-xs text-gray-400">
                  Each value is saved on its own — use the save icon on the row.
                </span>
              )}
            </div>

            <div className="border border-gray-200 rounded p-3">
              <div
                className={`${ROW_GRID} mb-2 text-xs font-medium text-gray-400`}
              >
                <span>Source Value</span>
                <span>Target Value</span>
                <span>Data Type</span>
                <span />
              </div>

              <div className="space-y-2">
                {detailRows.map((row) => {
                  const dirty = isEdit && isRowDirty(row);

                  return (
                    <div key={row.key}>
                      <div className={`${ROW_GRID} items-center`}>
                        <input
                          value={row.sourceValue}
                          disabled={loading || row.busy}
                          placeholder="Source value"
                          onChange={(e) =>
                            updateRow(row.key, { sourceValue: e.target.value })
                          }
                          className={`${inputClass} ${
                            dirty ? 'border-amber-400' : ''
                          }`}
                        />

                        <input
                          value={row.targetValue}
                          disabled={loading || row.busy}
                          placeholder="Target value"
                          onChange={(e) =>
                            updateRow(row.key, { targetValue: e.target.value })
                          }
                          className={`${inputClass} ${
                            dirty ? 'border-amber-400' : ''
                          }`}
                        />

                        <SelectDropdown
                          options={typeOptionsFor(row.dataType)}
                          value={
                            typeOptionsFor(row.dataType).find(
                              (opt) => opt.value === row.dataType
                            ) || null
                          }
                          onChange={(selected: any) =>
                            updateRow(row.key, {
                              dataType: selected?.value || DEFAULT_DATA_TYPE,
                            })
                          }
                          isDisabled={loading || row.busy}
                          aria-disabled={loading || row.busy}
                          label={''}
                        />

                        <div className="flex items-center justify-end gap-2">
                          {isEdit && (
                            <button
                              type="button"
                              title={row.id === 0 ? 'Add value' : 'Save value'}
                              onClick={() => saveDetailRow(row)}
                              disabled={loading || row.busy || !dirty}
                              className="text-sky-600 hover:text-sky-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              <BiSave className="text-xl" />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Remove value"
                            onClick={() => removeRow(row)}
                            disabled={loading || row.busy}
                            className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                          >
                            <BiSolidTrash className="text-xl" />
                          </button>
                        </div>
                      </div>

                      {rowErrors[row.key] && (
                        <p className="text-red-600 text-xs mt-1">
                          {rowErrors[row.key]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRow}
                disabled={loading || !canAddRow}
                title={
                  canAddRow
                    ? 'Add row'
                    : isEdit
                      ? 'Save the current row first'
                      : 'Fill the current row first'
                }
                className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-sky-300 bg-white text-sky-600 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BiPlus className="text-lg" />
                Add Row
              </button>
            </div>
          </div>

          {/* BUTTON */}
          <div className="mt-5 flex items-center gap-2">
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
                  : 'Add'}
            </button>
          </div>
        </form>

        {/* ================================================== */}
        {/* LOOKUP LIST */}
        {/* ================================================== */}
        <div className="mt-5 bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-700">
              Lookup List
            </h2>

            <div className="flex items-center gap-2">
              <input
                placeholder="Search lookup, value..."
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
              Loading lookups...
            </div>
          ) : (
            <DataTable<LookupRow>
              columns={[
                {
                  label: 'Lookup Name',
                  accessor: 'lookupName',
                  sortable: true,
                },
                {
                  label: 'Description',
                  accessor: 'description',
                  sortable: true,
                },
                {
                  label: 'Values',
                  accessor: 'valueCount',
                  sortable: true,
                  render: (row: LookupRow) => (
                    <div className="flex flex-wrap justify-center items-center gap-1">
                      {row.details.slice(0, 3).map((d) => (
                        <span
                          key={d.id}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 whitespace-pre"
                        >
                          {d.sourceValue} → {d.targetValue}
                        </span>
                      ))}

                      {row.details.length > 3 && (
                        <span className="text-[11px] text-gray-400">
                          +{row.details.length - 3} more
                        </span>
                      )}

                      {row.details.length === 0 && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  ),
                },
                {
                  label: 'Status',
                  accessor: 'statusText',
                  sortable: true,
                  render: (row: LookupRow) => (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        row.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.statusText}
                    </span>
                  ),
                },
                // {
                //   label: 'Created',
                //   accessor: 'createDate',
                //   sortable: true,
                //   render: (row: LookupRow) => formatDate(row.createDate),
                // },
                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: LookupRow) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.id)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit lookup"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(row.id, row.lookupName)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete lookup"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedRows}
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

export default LookUpMaster;
