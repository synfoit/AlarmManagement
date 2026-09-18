// src/pages/BlenderList.tsx
import React, { JSX } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';
import { Blender } from '../features/interfaces/blender-types';

export default function BlenderList(): JSX.Element {
  const Api = React.useMemo(() => createCrudApi('BlenderConfiguration'), []);
  const navigate = useNavigate();

  const [items, setItems] = React.useState<Blender[]>([]);
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');

  const [sortKey, setSortKey] = React.useState<keyof Blender>('blenderName');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);

  const searchableFields = React.useMemo(
    () => ['Blender Name', 'View Name', 'Table Name', 'Equipment No'],
    []
  );
  const searchPlaceholder = React.useMemo(
    () => `Search by ${searchableFields.join(', ')}...`,
    [searchableFields]
  );
  const handleClear = () => {
    setSearch('');
    setPage(1);
    setAppliedSearch('');
  };

  const normalizeBlender = (d: any): Blender => {
    return {
      id: 0,
      rowId: Number(d?.rowId ?? d?.id ?? 0),
      blenderName: String(
        d?.blenderName ?? d?.blendername ?? d?.name ?? ''
      ).trim(),
      viewName: String(d?.viewName ?? d?.viewname ?? '').trim(),
      tableName: String(d?.tableName ?? d?.table_name ?? '').trim(),
      equipmentNumber: Number(d?.equipmentNumber ?? d?.equipment ?? 0),
      isActive:
        typeof d?.isActive === 'boolean'
          ? d.isActive
          : Boolean(d?.isActive ?? true),
      createdAt: String(d?.createdAt ?? ''),
    };
  };

  const fetchItems = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await Api.get<any>(
        `GetBlenderConfiguration?page=${page}&limit=10&search=${encodeURIComponent(
          appliedSearch
        )}&sortKey=${encodeURIComponent(String(sortKey))}&sortOrder=${encodeURIComponent(
          sortOrder
        )}`
      );

      const payload = res?.data ?? {};

      const list: Blender[] = Array.isArray(payload.blender)
        ? payload.blender
        : Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

      const total =
        typeof payload.total === 'number'
          ? payload.total
          : typeof payload.totalCount === 'number'
            ? payload.totalCount
            : list.length;

      setItems(list.map((r) => normalizeBlender(r)));
      setTotalPages(Math.max(1, Math.ceil((total ?? 0) / 10)));
    } catch (err) {
      console.error('Failed to load Blender configurations:', err);
      Swal.fire({
        icon: 'info',
        title: 'No Data',
        text: 'Data Not Found..',
      });
    } finally {
      setIsLoading(false);
    }
  }, [Api, page, appliedSearch, sortKey, sortOrder]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSort = (key: keyof Blender) => {
    if (sortKey === key) {
      setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleSearch = () => {
    const trimmed = search.trim();

    setPage(1);
    setAppliedSearch(trimmed);
  };

  const handleDelete = async (
    rowId: number | undefined,
    blenderName?: string
  ) => {
    if (typeof rowId !== 'number' || Number.isNaN(rowId)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Record',
        text: 'Unable to identify the Blender record to delete.',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Blender Configuration?',
      html: `You want to delete Blender: <strong>${blenderName ?? rowId}</strong>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton:
          'bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded',
        cancelButton:
          'ms-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded',
      },
      buttonsStyling: false,
    });

    if (!result.isConfirmed) return;

    setIsLoading(true);
    try {
      // await Api.delete(`DeleteBlenderConfiguration/${encodeURIComponent(String(rowId))}`);
      await Api.post(
        `DeleteBlenderConfiguration/${encodeURIComponent(String(rowId))}`,
        {}
      );

      Swal.fire({
        icon: 'success',
        title: 'Deleted Successfully',
        text: `Blender configuration${blenderName ? ` "${blenderName}"` : ''} has been deleted.`,
      });

      fetchItems();
    } catch (err) {
      console.error('Delete failed:', err);
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: 'Could not delete the selected Blender configuration.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Blender Configuration List
      </h1>

      <div className="p-4">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              className="w-[600px] border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
              aria-label="Search Blenders"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="px-4 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none"
            >
              Search
            </button>
            {appliedSearch && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-sm rounded bg-gray-500 text-white hover:bg-gray-600 focus:outline-none"
                title="Clear Search"
                aria-label="Clear Search"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/manage-blender')}
            className="px-3 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none"
            title="Add Blender"
            aria-label="Add Blender"
          >
            Add Blender
          </button>
        </div>
        <DataTable<Blender>
          columns={[
            {
              label: 'Blender Name',
              accessor: 'blenderName' as keyof Blender,
              sortable: true,
            },
            {
              label: 'Table Mapping',
              accessor: 'viewName' as keyof Blender,
              sortable: true,
            },
            { label: 'Table Name', accessor: 'tableName' as keyof Blender },
            {
              label: 'Equipment No',
              accessor: 'equipmentNumber' as keyof Blender,
              sortable: true,
            },
            {
              label: 'Actions',
              accessor: 'actions' as unknown as any,
              render: (row: Blender) => {
                return (
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => navigate(`/manage-blender/${row.rowId}`)}
                      className="text-sky-600 hover:text-sky-700"
                      title="Edit"
                      aria-label={`Edit ${row.blenderName}`}
                    >
                      <BiEdit className="text-xl me-2" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.rowId, row.blenderName)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                      aria-label={`Delete ${row.blenderName}`}
                    >
                      <BiSolidTrash className="text-xl" />
                    </button>
                  </div>
                );
              },
            },
          ]}
          paginatedData={items ?? []}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          sortOrder={sortOrder}
          handleSort={(key) => handleSort(key as keyof Blender)}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}
