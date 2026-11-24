// src/pages/AreaMaster.tsx
import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { DataTable } from '../components/DataTable';
import SelectDropdown from '../features/ui/SelectDropdown';
import { createCrudApi } from '../features/lib/createCrudApi';

type Area = {
  id: number; // Required by DataTable
  areaId: number;
  plantId: number;
  areaName: string;
  isActive: boolean;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: number;
  updatedBy?: number;
  actions?: string;
};

type Plant = {
  plantId: number;
  plantName: string;
  isActive: boolean;
};

type PlantOption = {
  value: number;
  label: string;
};

type FieldErrors = Partial<Record<'areaName' | 'plantId', string>>;

const PAGE_SIZE = 10;

const AreaMaster: React.FC = () => {
  const areaApi = useMemo(() => createCrudApi('AreaMaster'), []);
  const plantApi = useMemo(() => createCrudApi('PlantMaster'), []);

  const [areas, setAreas] = useState<Area[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<Area>({
    id: 0,
    areaId: 0,
    plantId: 0,
    areaName: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Area>('areaName');
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
  // GET ALL PLANTS (for dropdown)
  // ------------------------------------------------------------
  const fetchPlants = async () => {
    try {
      const res = await plantApi.get<any>('GetAllPlants');
      const responseData = res?.data;

      const rawPlantList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      setPlants(rawPlantList);
    } catch (err: any) {
      console.error('Failed to load plants:', err);
      setPlants([]);
    }
  };

  // ------------------------------------------------------------
  // GET ALL AREAS
  // ------------------------------------------------------------
  const fetchAreas = async () => {
    setListLoading(true);
    try {
      const res = await areaApi.get<any>('GetAllAreas');
      const responseData = res?.data;

      const rawAreaList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const areaList: Area[] = rawAreaList.map((area: any) => ({
        ...area,
        id: area.areaId,
      }));

      setAreas(areaList);
    } catch (err: any) {
      console.error('Failed to load areas:', err);
      const backendMessage = getBackendMessage(
        err,
        'Something went wrong while fetching areas.'
      );
      setAreas([]);
      Swal.fire('Warning', backendMessage, 'warning');
    } finally {
      setListLoading(false);
    }
  };

  // ------------------------------------------------------------
  // INITIAL LOAD
  // ------------------------------------------------------------
  useEffect(() => {
    fetchPlants();
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // PLANT NAME LOOKUP (id -> name, used in table)
  // ------------------------------------------------------------
  const plantNameMap = useMemo(() => {
    const map = new Map<number, string>();
    plants.forEach((p) => map.set(p.plantId, p.plantName));
    return map;
  }, [plants]);

  const plantOptions: PlantOption[] = useMemo(
    () =>
      plants.map((p) => ({
        value: p.plantId,
        label: p.plantName,
      })),
    [plants]
  );

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------
  const validateAreaName = (value: string): string => {
    const val = value.trim();

    if (!val) {
      return 'Area Name cannot be blank';
    }

    if (val.length < 2) {
      return 'Area Name must be at least 2 characters';
    }

    return '';
  };

  const validatePlantId = (value: number): string => {
    if (!value) {
      return 'Please select a plant';
    }

    return '';
  };

  const validateAll = (): boolean => {
    const newErrors: FieldErrors = {};

    const areaNameError = validateAreaName(formData.areaName);
    if (areaNameError) {
      newErrors.areaName = areaNameError;
    }

    const plantIdError = validatePlantId(formData.plantId);
    if (plantIdError) {
      newErrors.plantId = plantIdError;
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

    if (name === 'areaName') {
      setErrors((prev) => ({
        ...prev,
        areaName: validateAreaName(value),
      }));
    }
  };

  const handlePlantChange = (opt: PlantOption | null) => {
    const value = opt ? opt.value : 0;

    setFormData((prev) => ({
      ...prev,
      plantId: value,
    }));

    setErrors((prev) => ({
      ...prev,
      plantId: validatePlantId(value),
    }));
  };

  // ------------------------------------------------------------
  // RESET FORM
  // ------------------------------------------------------------
  const resetForm = () => {
    setFormData({
      id: 0,
      areaId: 0,
      plantId: 0,
      areaName: '',
      isActive: true,
    });
    setErrors({});
    setIsEdit(false);
    setEditingId(null);
  };

  // ------------------------------------------------------------
  // EDIT - GET BY ID
  // ------------------------------------------------------------
  const handleEdit = async (areaId: number) => {
    try {
      setLoading(true);

      const res = await areaApi.get<any>(
        `GetById?areaId=${encodeURIComponent(String(areaId))}`
      );

      const area: Area | null = res?.data?.data ?? res?.data ?? null;

      if (!area) {
        Swal.fire('Error', 'Area details not found.', 'error');
        return;
      }

      const actualAreaId = area.areaId ?? areaId;

      setFormData({
        id: actualAreaId,
        areaId: actualAreaId,
        plantId: area.plantId,
        areaName: area.areaName ?? '',
        isActive: area.isActive ?? true,
        createdDate: area.createdDate,
        updatedDate: area.updatedDate,
        createdBy: area.createdBy,
        updatedBy: area.updatedBy,
      });

      setErrors({});
      setIsEdit(true);
      setEditingId(actualAreaId);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to load area:', err);
      const backendMessage = getBackendMessage(
        err,
        'Failed to load area details.'
      );
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // ADD / UPDATE
  // ------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateAll()) {
      return;
    }

    const payload = {
      areaId: isEdit && editingId ? editingId : 0,
      plantId: formData.plantId,
      areaName: formData.areaName.trim(),
    };

    try {
      setLoading(true);

      const res = await areaApi.post<{
        success: boolean;
        message: string;
      }>('AddAndUpdate', payload);

      const responseData = res.data;

      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to save area.');
      }

      const successMessage =
        responseData.message ||
        (isEdit ? 'Area updated successfully.' : 'Area added successfully.');

      await Swal.fire(
        isEdit ? 'Area Updated!' : 'Area Created!',
        successMessage,
        'success'
      );

      resetForm();
      await fetchAreas();
    } catch (err: any) {
      console.error('Save area failed:', err);
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save area.';
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------
  const handleDelete = async (areaId: number, areaName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete area: <strong>${areaName}</strong>`,
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

      await areaApi.delete(
        `DeleteArea?areaId=${encodeURIComponent(String(areaId))}`
      );

      await Swal.fire(
        'Deleted',
        'Area has been deleted successfully.',
        'success'
      );

      if (editingId === areaId) {
        resetForm();
      }

      await fetchAreas();
    } catch (err: any) {
      console.error('Delete area failed:', err);
      const backendMessage = getBackendMessage(err, 'Delete failed.');
      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const filteredAreas = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return areas;
    }

    return areas.filter((area) => {
      const plantName = plantNameMap.get(area.plantId) || '';

      return (
        (area.areaName || '').toLowerCase().includes(searchTerm) ||
        plantName.toLowerCase().includes(searchTerm)
      );
    });
  }, [areas, search, plantNameMap]);

  // ------------------------------------------------------------
  // SORT
  // ------------------------------------------------------------
  const sortedAreas = useMemo(() => {
    const result = [...filteredAreas];

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
  }, [filteredAreas, sortKey, sortOrder]);

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(sortedAreas.length / PAGE_SIZE));

  const paginatedAreas = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return sortedAreas.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedAreas, page]);

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
  const handleSort = (key: keyof Area) => {
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
        Area Master
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
              {isEdit ? 'Edit Area' : 'Add Area'}
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
            {/* PLANT */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Plant *
              </label>
              <SelectDropdown
                label=""
                options={plantOptions}
                value={
                  plantOptions.find((o) => o.value === formData.plantId) ?? null
                }
                onChange={(opt) => handlePlantChange(opt as PlantOption | null)}
              />
              {errors.plantId && (
                <p className="text-red-600 text-xs mt-1">{errors.plantId}</p>
              )}
            </div>

            {/* AREA NAME */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Area Name *
              </label>
              <input
                name="areaName"
                value={formData.areaName}
                onChange={handleChange}
                placeholder="Enter area name"
                disabled={loading}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none disabled:bg-gray-100"
              />
              {errors.areaName && (
                <p className="text-red-600 text-xs mt-1">{errors.areaName}</p>
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
        {/* AREA LIST */}
        {/* ================================================== */}
        <div className="mt-5 bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-700">Area List</h2>

            <div className="flex items-center gap-2">
              <input
                placeholder="Search area or plant..."
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
              Loading areas...
            </div>
          ) : (
            <DataTable<Area>
              columns={[
                {
                  label: 'Plant Name',
                  accessor: 'plantId',
                  sortable: true,
                  render: (row: Area) => plantNameMap.get(row.plantId) || 'N/A',
                },
                {
                  label: 'Area Name',
                  accessor: 'areaName',
                  sortable: true,
                },

                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: Area) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.areaId)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit area"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(row.areaId, row.areaName)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete area"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedAreas}
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

export default AreaMaster;
