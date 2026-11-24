// src/pages/AlarmMaster.tsx

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';

type Plant = {
  id: number; // Required by DataTable
  plantId: number;
  plantName: string;
  isActive: boolean;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: number;
  updatedBy?: number;
  actions?: string;
};

type FieldErrors = Partial<Record<'plantName', string>>;

const PAGE_SIZE = 10;

const AlarmMaster: React.FC = () => {
  const plantApi = useMemo(() => createCrudApi('PlantMaster'), []);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<Plant>({
    id: 0,
    plantId: 0,
    plantName: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Plant>('plantName');
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
  // GET ALL PLANTS
  // ------------------------------------------------------------
  const fetchPlants = async () => {
    setListLoading(true);

    try {
      const res = await plantApi.get<any>('GetAllPlants');

      const responseData = res?.data;

      const rawPlantList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const plantList: Plant[] = rawPlantList.map((plant: any) => ({
        ...plant,
        id: plant.plantId,
      }));

      setPlants(plantList);
    } catch (err: any) {
      console.error('Failed to load plants:', err);

      const backendMessage = getBackendMessage(
        err,
        'Something went wrong while fetching plants.'
      );

      setPlants([]);

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------
  const validatePlantName = (value: string): string => {
    const val = value.trim();

    if (!val) {
      return 'Plant Name cannot be blank';
    }

    if (val.length < 2) {
      return 'Plant Name must be at least 2 characters';
    }

    return '';
  };

  const validateAll = (): boolean => {
    const newErrors: FieldErrors = {};

    const plantNameError = validatePlantName(formData.plantName);

    if (plantNameError) {
      newErrors.plantName = plantNameError;
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

    if (name === 'plantName') {
      setErrors((prev) => ({
        ...prev,
        plantName: validatePlantName(value),
      }));
    }
  };

  // ------------------------------------------------------------
  // RESET FORM
  // ------------------------------------------------------------
  const resetForm = () => {
    setFormData({
      id: 0,
      plantId: 0,
      plantName: '',
      isActive: true,
    });

    setErrors({});
    setIsEdit(false);
    setEditingId(null);
  };

  // ------------------------------------------------------------
  // EDIT - GET BY ID
  // ------------------------------------------------------------
  const handleEdit = async (plantId: number) => {
    try {
      setLoading(true);

      const res = await plantApi.get<any>(
        `GetById?plantId=${encodeURIComponent(String(plantId))}`
      );

      const plant: Plant | null = res?.data?.data ?? res?.data ?? null;

      if (!plant) {
        Swal.fire('Error', 'Plant details not found.', 'error');
        return;
      }

      const actualPlantId = plant.plantId ?? plantId;

      setFormData({
        id: actualPlantId,
        plantId: actualPlantId,
        plantName: plant.plantName ?? '',
        isActive: plant.isActive ?? true,
        createdDate: plant.createdDate,
        updatedDate: plant.updatedDate,
        createdBy: plant.createdBy,
        updatedBy: plant.updatedBy,
      });

      setErrors({});
      setIsEdit(true);
      setEditingId(actualPlantId);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (err: any) {
      console.error('Failed to load plant:', err);

      const backendMessage = getBackendMessage(
        err,
        'Failed to load plant details.'
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
      plantId: isEdit && editingId ? editingId : 0,
      plantName: formData.plantName.trim(),
    };

    try {
      setLoading(true);

      const res = await plantApi.post<{
        success: boolean;
        message: string;
      }>('AddAndUpdatePlant', payload);

      const responseData = res.data;

      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to save plant.');
      }

      const successMessage =
        responseData.message ||
        (isEdit ? 'Plant updated successfully.' : 'Plant added successfully.');

      await Swal.fire(
        isEdit ? 'Plant Updated!' : 'Plant Created!',
        successMessage,
        'success'
      );

      resetForm();
      await fetchPlants();
    } catch (err: any) {
      console.error('Save plant failed:', err);

      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save plant.';

      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------
  const handleDelete = async (plantId: number, plantName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete plant: <strong>${plantName}</strong>`,
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

      await plantApi.delete(
        `DeletePlant?plantId=${encodeURIComponent(String(plantId))}`
      );

      await Swal.fire(
        'Deleted',
        'Plant has been deleted successfully.',
        'success'
      );

      if (editingId === plantId) {
        resetForm();
      }

      await fetchPlants();
    } catch (err: any) {
      console.error('Delete plant failed:', err);

      const backendMessage = getBackendMessage(err, 'Delete failed.');

      Swal.fire('Error', backendMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const filteredPlants = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return plants;
    }

    return plants.filter((plant) =>
      (plant.plantName || '').toLowerCase().includes(searchTerm)
    );
  }, [plants, search]);

  // ------------------------------------------------------------
  // SORT
  // ------------------------------------------------------------
  const sortedPlants = useMemo(() => {
    const result = [...filteredPlants];

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
  }, [filteredPlants, sortKey, sortOrder]);

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(sortedPlants.length / PAGE_SIZE));

  const paginatedPlants = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;

    return sortedPlants.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedPlants, page]);

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
  const handleSort = (key: keyof Plant) => {
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
        Plant Master
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
              {isEdit ? 'Edit Plant' : 'Add Plant'}
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
            {/* PLANT NAME */}
            <div>
              <label className="block font-medium text-sm mb-1 text-gray-500">
                Plant Name *
              </label>

              <input
                name="plantName"
                value={formData.plantName}
                onChange={handleChange}
                placeholder="Enter plant name"
                disabled={loading}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none disabled:bg-gray-100"
              />

              {errors.plantName && (
                <p className="text-red-600 text-xs mt-1">{errors.plantName}</p>
              )}
            </div>

            {/* STATUS 
             {isEdit && (
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
        {/* PLANT LIST */}
        {/* ================================================== */}
        <div className="mt-5 bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-700">
              Plant List
            </h2>

            <div className="flex items-center gap-2">
              <input
                placeholder="Search plant..."
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
              Loading plants...
            </div>
          ) : (
            <DataTable<Plant>
              columns={[
                {
                  label: 'Plant Name',
                  accessor: 'plantName',
                  sortable: true,
                },

                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: Plant) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.plantId)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit plant"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(row.plantId, row.plantName)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete plant"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedPlants}
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

export default AlarmMaster;
