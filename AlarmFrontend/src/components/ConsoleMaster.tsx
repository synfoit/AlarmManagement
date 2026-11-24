// src/pages/ConsoleMaster.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { DataTable } from '../components/DataTable';
import SelectDropdown from '../features/ui/SelectDropdown';
import { createCrudApi } from '../features/lib/createCrudApi';

type Console = {
  id: number; // Required by DataTable
  consoleId: number;
  areaId: number;
  consoleName: string;
  isActive: boolean;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: number;
  updatedBy?: number;
  actions?: string;
};

type Area = {
  areaId: number;
  plantId: number;
  areaName: string;
  isActive: boolean;
};

type AreaOption = {
  value: number;
  label: string;
};

type FieldErrors = Partial<Record<'consoleName' | 'areaId', string>>;

const PAGE_SIZE = 10;

const ConsoleMaster: React.FC = () => {
  const consoleApi = useMemo(() => createCrudApi('ConsoleMaster'), []);
  const areaApi = useMemo(() => createCrudApi('AreaMaster'), []);

  const [consoles, setConsoles] = useState<Console[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<Console>({
    id: 0,
    consoleId: 0,
    areaId: 0,
    consoleName: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Console>('consoleName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ------------------------------------------------------------
  // GET BACKEND MESSAGE
  // ------------------------------------------------------------
  const getBackendMessage = (err: any, fallback: string): string => {
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (typeof err?.response?.data === 'string' ? err.response.data : null) ||
      fallback
    );
  };

  // ------------------------------------------------------------
  // GET ALL AREAS (for dropdown)
  // ------------------------------------------------------------
  const fetchAreas = async () => {
    try {
      const res = await areaApi.get<any>('GetAllAreas');
      const responseData = res?.data;

      const rawAreaList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      setAreas(rawAreaList);
    } catch (err: any) {
      console.error('Failed to load areas:', err);
      setAreas([]);
    }
  };

  // ------------------------------------------------------------
  // GET ALL CONSOLES
  // ------------------------------------------------------------
  const fetchConsoles = async () => {
    setListLoading(true);
    try {
      const res = await consoleApi.get<any>('GetAllConsoles');
      const responseData = res?.data;

      const rawConsoleList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const consoleList: Console[] = rawConsoleList.map((c: any) => ({
        ...c,
        id: c.consoleId,
      }));

      setConsoles(consoleList);
    } catch (err: any) {
      console.error('Failed to load consoles:', err);
      const backendMessage = getBackendMessage(
        err,
        'Something went wrong while fetching consoles.'
      );
      setConsoles([]);
      Swal.fire('Warning', backendMessage, 'warning');
    } finally {
      setListLoading(false);
    }
  };

  // ------------------------------------------------------------
  // INITIAL LOAD
  // ------------------------------------------------------------
  useEffect(() => {
    fetchAreas();
    fetchConsoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // AREA NAME LOOKUP (id -> name, used in table)
  // ------------------------------------------------------------
  const areaNameMap = useMemo(() => {
    const map = new Map<number, string>();
    areas.forEach((a) => map.set(a.areaId, a.areaName));
    return map;
  }, [areas]);

  const areaOptions: AreaOption[] = useMemo(
    () =>
      areas.map((a) => ({
        value: a.areaId,
        label: a.areaName,
      })),
    [areas]
  );

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------
  const validateConsoleName = (value: string): string => {
    const val = value.trim();

    if (!val) {
      return 'Console Name cannot be blank';
    }

    if (val.length < 2) {
      return 'Console Name must be at least 2 characters';
    }

    return '';
  };

  const validateAreaId = (value: number): string => {
    if (!value) {
      return 'Please select an area';
    }

    return '';
  };

  const validateAll = (): boolean => {
    const newErrors: FieldErrors = {};

    const consoleNameError = validateConsoleName(formData.consoleName);
    if (consoleNameError) {
      newErrors.consoleName = consoleNameError;
    }

    const areaIdError = validateAreaId(formData.areaId);
    if (areaIdError) {
      newErrors.areaId = areaIdError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ------------------------------------------------------------
  // HANDLE INPUT CHANGE
  // ------------------------------------------------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'consoleName') {
      setErrors((prev) => ({
        ...prev,
        consoleName: validateConsoleName(value),
      }));
    }
  };

  const handleAreaChange = (opt: AreaOption | null) => {
    const value = opt ? opt.value : 0;

    setFormData((prev) => ({
      ...prev,
      areaId: value,
    }));

    setErrors((prev) => ({
      ...prev,
      areaId: validateAreaId(value),
    }));
  };

  // ------------------------------------------------------------
  // RESET FORM
  // ------------------------------------------------------------
  const resetForm = () => {
    setFormData({
      id: 0,
      consoleId: 0,
      areaId: 0,
      consoleName: '',
      isActive: true,
    });
    setErrors({});
    setIsEdit(false);
    setEditingId(null);
  };

  // ------------------------------------------------------------
  // EDIT - GET BY ID
  // ------------------------------------------------------------
  const handleEdit = async (consoleId: number) => {
    try {
      setLoading(true);

      const res = await consoleApi.get<any>(
        `GetById?consoleId=${encodeURIComponent(String(consoleId))}`
      );

      const consoleItem: Console | null = res?.data?.data ?? res?.data ?? null;

      if (!consoleItem) {
        Swal.fire('Error', 'Console details not found.', 'error');
        return;
      }

      const actualConsoleId = consoleItem.consoleId ?? consoleId;

      setFormData({
        id: actualConsoleId,
        consoleId: actualConsoleId,
        areaId: consoleItem.areaId,
        consoleName: consoleItem.consoleName ?? '',
        isActive: consoleItem.isActive ?? true,
        createdDate: consoleItem.createdDate,
        updatedDate: consoleItem.updatedDate,
        createdBy: consoleItem.createdBy,
        updatedBy: consoleItem.updatedBy,
      });

      setErrors({});
      setIsEdit(true);
      setEditingId(actualConsoleId);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to load console:', err);
      const backendMessage = getBackendMessage(
        err,
        'Failed to load console details.'
      );
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // ADD / UPDATE
  // NOTE: Add -> POST AddAndUpdateConsole (consoleId: 0)
  //       Update -> PUT ConsoleMaster/{consoleId}
  // ------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateAll()) {
      return;
    }

    try {
      setLoading(true);

      let res;

      if (isEdit && editingId) {
        const payload = {
          consoleId: editingId,
          areaId: formData.areaId,
          consoleName: formData.consoleName.trim(),
        };

        res = await consoleApi.put<{
          success: boolean;
          message: string;
        }>(`${editingId}`, payload);
      } else {
        const payload = {
          consoleId: 0,
          areaId: formData.areaId,
          consoleName: formData.consoleName.trim(),
        };

        res = await consoleApi.post<{
          success: boolean;
          message: string;
        }>('AddAndUpdateConsole', payload);
      }

      const responseData = res.data;

      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to save console.');
      }

      const successMessage =
        responseData.message ||
        (isEdit
          ? 'Console updated successfully.'
          : 'Console added successfully.');

      await Swal.fire(
        isEdit ? 'Console Updated!' : 'Console Created!',
        successMessage,
        'success'
      );

      resetForm();
      await fetchConsoles();
    } catch (err: any) {
      console.error('Save console failed:', err);
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save console.';
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------
  const handleDelete = async (consoleId: number, consoleName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete console: <strong>${consoleName}</strong>`,
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

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoading(true);

      await consoleApi.delete(
        `DeleteConsole?consoleId=${encodeURIComponent(String(consoleId))}`
      );

      await Swal.fire(
        'Deleted',
        'Console has been deleted successfully.',
        'success'
      );

      if (editingId === consoleId) {
        resetForm();
      }

      await fetchConsoles();
    } catch (err: any) {
      console.error('Delete console failed:', err);
      const backendMessage = getBackendMessage(err, 'Delete failed.');
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const filteredConsoles = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return consoles;
    }

    return consoles.filter((c) => {
      const areaName = areaNameMap.get(c.areaId) || '';

      return (
        (c.consoleName || '').toLowerCase().includes(searchTerm) ||
        areaName.toLowerCase().includes(searchTerm)
      );
    });
  }, [consoles, search, areaNameMap]);

  // ------------------------------------------------------------
  // SORT
  // ------------------------------------------------------------
  const sortedConsoles = useMemo(() => {
    const result = [...filteredConsoles];

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
  }, [filteredConsoles, sortKey, sortOrder]);

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(sortedConsoles.length / PAGE_SIZE));

  const paginatedConsoles = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return sortedConsoles.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedConsoles, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // ------------------------------------------------------------
  // SEARCH HANDLERS
  // ------------------------------------------------------------
  const handleSearch = () => {
    setPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setPage(1);
  };

  // ------------------------------------------------------------
  // SORT HANDLER
  // ------------------------------------------------------------
  const handleSort = (key: keyof Console) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // ------------------------------------------------------------
  // DATE FORMAT
  // ------------------------------------------------------------
  const formatDate = (date?: string) => {
    if (!date || date.startsWith('0001-01-01')) {
      return 'N/A';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'N/A';
    }

    return parsedDate.toLocaleString();
  };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Console Master
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
              {isEdit ? 'Edit Console' : 'Add Console'}
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
            {/* AREA */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Area *
              </label>
              <SelectDropdown
                label=""
                options={areaOptions}
                value={
                  areaOptions.find((o) => o.value === formData.areaId) ?? null
                }
                onChange={(opt) => handleAreaChange(opt as AreaOption | null)}
              />
              {errors.areaId && (
                <p className="text-red-600 text-xs mt-1">{errors.areaId}</p>
              )}
            </div>

            {/* CONSOLE NAME */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Console Name *
              </label>
              <input
                name="consoleName"
                value={formData.consoleName}
                onChange={handleChange}
                placeholder="Enter console name"
                disabled={loading}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none disabled:bg-gray-100"
              />
              {errors.consoleName && (
                <p className="text-red-600 text-xs mt-1">
                  {errors.consoleName}
                </p>
              )}
            </div>

            {/* STATUS */}
            {/* {isEdit && (
              <div>
                <label className="block font-medium text-sm mb-1 text-gray-500">
                  Status
                </label>
                <div className="h-[38px] flex items-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      formData.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            )} */}

            {/* BUTTON */}
            <div className="flex items-end gap-2">
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
          </div>
        </form>

        {/* ================================================== */}
        {/* CONSOLE LIST */}
        {/* ================================================== */}
        <div className="mt-5 bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-700">
              Console List
            </h2>

            <div className="flex items-center gap-2">
              <input
                placeholder="Search console or area..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
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

          {/* ================================================== */}
          {/* TABLE */}
          {/* ================================================== */}
          {listLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading consoles...
            </div>
          ) : (
            <DataTable<Console>
              columns={[
                {
                  label: 'Area Name',
                  accessor: 'areaId',
                  sortable: true,
                  render: (row: Console) =>
                    areaNameMap.get(row.areaId) || 'N/A',
                },
                {
                  label: 'Console Name',
                  accessor: 'consoleName',
                  sortable: true,
                },
                // {
                //   label: 'Status',
                //   accessor: 'isActive',
                //   sortable: true,
                //   render: (row: Console) => (
                //     <span
                //       className={`px-3 py-1 rounded-full text-xs font-semibold ${
                //         row.isActive
                //           ? 'bg-green-100 text-green-700'
                //           : 'bg-red-100 text-red-700'
                //       }`}
                //     >
                //       {row.isActive ? 'Active' : 'Inactive'}
                //     </span>
                //   ),
                // },
                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: Console) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.consoleId)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit console"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(row.consoleId, row.consoleName)
                        }
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete console"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedConsoles}
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

export default ConsoleMaster;
