// src/pages/SourceList.tsx

import React, { JSX } from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';
import type { SourceTank } from '../features/interfaces/sourceTank-types';

export default function SourceTankList(): JSX.Element {
  const SourceApi = React.useMemo(() => createCrudApi('SourceTankDesc'), []);

  const [items, setItems] = React.useState<SourceTank[]>([]);
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');

  const [sortKey, setSortKey] =
    React.useState<keyof SourceTank>('tankDescription');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');

  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);

  const navigate = useNavigate();

  const searchableFields = React.useMemo(
    () => ['Tank No', 'Tank Description'],
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

  const fetchItems = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await SourceApi.get<{
        sourceTankDescs: SourceTank[];
        total: number;
      }>(
        `getSourceTankList?search=${encodeURIComponent(
          appliedSearch
        )}&page=${page}&limit=10&sortKey=${String(
          sortKey
        )}&sortOrder=${sortOrder}`
      );

      const payload = res.data;

      const list = payload.sourceTankDescs ?? [];

      setItems(list);

      setTotalPages(Math.max(1, Math.ceil((payload.total ?? 0) / 10)));
    } catch (err) {
      console.error('Failed to load tanks:', err);

      Swal.fire({
        icon: 'info',
        title: 'No Data',
        text: 'Data Not Found..',
      });
    } finally {
      setIsLoading(false);
    }
  }, [SourceApi, appliedSearch, page, sortKey, sortOrder]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearch = () => {
    const trimmed = search.trim();

    setPage(1);
    setAppliedSearch(trimmed);
  };

  const handleDelete = async (rowId: number, name: string) => {
    const result = await Swal.fire({
      title: 'Delete Source Tank?',
      html: `You want to delete source tank: <strong>${escapeHtml(
        name
      )}</strong>`,
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

    try {
      setIsLoading(true);

      // await SourceApi.delete(`deleteSourceTank/${rowId}`);

      await SourceApi.post(
        `deleteSourceTank/${encodeURIComponent(String(rowId))}`,
        null
      );

      Swal.fire({
        icon: 'success',
        title: 'Deleted Successfully',
        text: `Source tank "${name}" has been deleted.`,
      });

      fetchItems();
    } catch (err) {
      console.error('Delete failed:', err);

      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: 'Could not delete the selected source tank.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: keyof SourceTank) => {
    if (sortKey === key) {
      setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Source Tank List
      </h1>

      <div className="p-4">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-[600px] border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
                aria-label="Search tanks"
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
          </div>

          <button
            type="button"
            onClick={() => navigate('/manage-source-tank')}
            className="px-3 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none"
            title="Add Tank"
            aria-label="Add Tank"
          >
            Add Source Tank
          </button>
        </div>

        <DataTable<SourceTank>
          columns={[
            {
              label: 'Tank No',
              accessor: 'tankNo' as keyof SourceTank,
              sortable: true,
            },
            {
              label: 'Tank Description',
              accessor: 'tankDescription' as keyof SourceTank,
              sortable: true,
            },
            {
              label: 'Actions',
              accessor: 'actions' as unknown as any,
              render: (row: SourceTank) => {
                return (
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() =>
                        navigate(`/manage-source-tank/${row.rowId}`)
                      }
                      className="text-sky-600 hover:text-sky-700"
                      title="Edit tank"
                      aria-label={`Edit ${row.tankDescription}`}
                    >
                      <BiEdit className="text-xl me-2" />
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(row.rowId, row.tankDescription ?? '')
                      }
                      className="text-red-500 hover:text-red-700"
                      title="Delete tank"
                      aria-label={`Delete ${row.tankDescription}`}
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
          handleSort={(key) => handleSort(key as keyof SourceTank)}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}

// small helper to avoid XSS in inserted HTML for Swal
function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
