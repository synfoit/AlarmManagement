// src/pages/ConnectionString.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';
import { notifyCollectorsChanged } from '../features/lib/collectorEvents';

/* -------------------------------------------------------------------------- */
/* Route paths — apna router ma je path set karyo hoy te mujab badlo          */
/*   <Route path="/connector-settings" element={<ConnectorSettings />} />     */
/*   <Route path="/connector-settings/:id" element={<ConnectorSettings />} /> */
/* -------------------------------------------------------------------------- */
const CONNECTOR_SETTINGS_PATH = '/connection-setting';

type Connector = {
  id: number; // Required by DataTable
  collectorId: number;
  collectorName: string;
  actions?: string;
};

const PAGE_SIZE = 10;

const ConnectionList: React.FC = () => {
  const navigate = useNavigate();
  const api = useMemo(() => createCrudApi('collector-configs'), []);

  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Connector>('collectorName');
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
  // GET ALL CONNECTORS
  // GET /collector-configs/data?includeInactive=false
  // ------------------------------------------------------------
  const fetchConnectors = async () => {
    setListLoading(true);
    try {
      const res = await api.get<any>('data?includeInactive=false');
      const responseData = res?.data;

      const rawList = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const list: Connector[] = rawList.map((c: any) => ({
        ...c,
        id: c.collectorId,
      }));

      setConnectors(list);
    } catch (err: any) {
      console.error('Failed to load connectors:', err);
      setConnectors([]);
      Swal.fire(
        'Warning',
        getBackendMessage(
          err,
          'Something went wrong while fetching connectors.'
        ),
        'warning'
      );
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // ADD / EDIT -> open Connector Settings screen
  // ------------------------------------------------------------
  const handleAdd = () => navigate(CONNECTOR_SETTINGS_PATH);

  const handleEdit = (collectorId: number) =>
    navigate(`${CONNECTOR_SETTINGS_PATH}/${collectorId}`);

  // ------------------------------------------------------------
  // DELETE
  // DELETE /collector-configs/{id}
  // ------------------------------------------------------------
  const handleDelete = async (collectorId: number, collectorName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete connector: <strong>${collectorName}</strong>`,
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
      await api.delete(`${collectorId}`);

      await Swal.fire(
        'Deleted',
        'Connector has been deleted successfully.',
        'success'
      );

      await fetchConnectors();
      notifyCollectorsChanged();
    } catch (err: any) {
      console.error('Delete connector failed:', err);
      Swal.fire('Error', getBackendMessage(err, 'Delete failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------
  const filteredConnectors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return connectors;

    return connectors.filter((c) =>
      (c.collectorName || '').toLowerCase().includes(term)
    );
  }, [connectors, search]);

  // ------------------------------------------------------------
  // SORT
  // ------------------------------------------------------------
  const sortedConnectors = useMemo(() => {
    const result = [...filteredConnectors];

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
  }, [filteredConnectors, sortKey, sortOrder]);

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(sortedConnectors.length / PAGE_SIZE)
  );

  const paginatedConnectors = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedConnectors.slice(start, start + PAGE_SIZE);
  }, [sortedConnectors, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSearch = () => setPage(1);

  const handleClear = () => {
    setSearch('');
    setPage(1);
  };

  const handleSort = (key: keyof Connector) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        Connection List
      </h1>

      <div className="p-4">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                placeholder="Search connection..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="w-72 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAdd}
                className="px-4 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none"
              >
                Add Connection
              </button>
            </div>
          </div>

          {listLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading connections...
            </div>
          ) : (
            <DataTable<Connector>
              columns={[
                {
                  label: 'Connection Name',
                  accessor: 'collectorName',
                  sortable: true,
                },
                {
                  label: 'Actions',
                  accessor: 'actions',
                  render: (row: Connector) => (
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(row.collectorId)}
                        disabled={loading}
                        className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit connection"
                      >
                        <BiEdit className="text-xl me-2" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(row.collectorId, row.collectorName)
                        }
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete connection"
                      >
                        <BiSolidTrash className="text-xl" />
                      </button>
                    </div>
                  ),
                },
              ]}
              paginatedData={paginatedConnectors}
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

export default ConnectionList;
