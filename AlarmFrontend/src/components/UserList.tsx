// src/pages/UserList.tsx
import React from 'react';
import Swal from 'sweetalert2';
import { BiEdit, BiSolidTrash } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { createCrudApi } from '../features/lib/createCrudApi';
import type { User } from '../features/interfaces/user-types';

export default function UserList() {
  const userApi = React.useMemo(() => createCrudApi('Users'), []);
  const [users, setUsers] = React.useState<User[]>([]);
  const [search, setSearch] = React.useState('');
  const [error, setError] = React.useState('');
  const [sortKey, setSortKey] = React.useState<keyof User>('firstName');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const navigate = useNavigate();

  const handleSearch = () => {
    setPage(1);
    fetchUsers(search.trim());
  };

  const handleClear = () => {
    setSearch('');
    setPage(1);
    fetchUsers('');
  };

  // Auto re-fetch only on page / sort change — NOT on typing.
  React.useEffect(() => {
    fetchUsers(search.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortOrder]);

  const fetchUsers = async (searchTerm?: string) => {
    try {
      const term = searchTerm !== undefined ? searchTerm : search.trim();
      const res = await userApi.get<{ users: User[]; total: number }>(
        `GetUsers?search=${encodeURIComponent(term)}&page=${page}&limit=10&sortKey=${sortKey}&sortOrder=${sortOrder}`
      );
      setUsers(res.data.users);
      setTotalPages(Math.ceil(res.data.total / 10));
      setError('');
    } catch (err: any) {
      console.error('Failed to load users:', err);
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        'Something went wrong while fetching users.';
      setError(backendMessage);
      setUsers([]);
      Swal.fire('Warning', backendMessage, 'warning');
    }
  };

  const remove = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `You want to delete user: <strong>${name}</strong>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      customClass: {
        confirmButton:
          'bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded',
        cancelButton:
          'ms-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded',
      },
    });

    if (!result.isConfirmed) return;

    try {
      await userApi.post(
        `DeleteUserAccount/${encodeURIComponent(String(id))}`,
        null
      );
      Swal.fire('Deleted', 'User has been deleted', 'success');
      fetchUsers(search.trim());
    } catch (err: any) {
      console.error('Delete failed:', err);
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Delete failed';
      Swal.fire('Error', backendMessage, 'error');
    }
  };

  const handleSort = (key: keyof User) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const capitalize = (s?: string) =>
    !s
      ? 'N/A'
      : s
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase">
        User List
      </h1>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                title="Clear Search"
                aria-label="Clear Search"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* {error && (
          <div className="bg-red-100 text-red-700 p-2 mb-4 text-sm rounded text-center">
            {error}
          </div>
        )} */}

        <DataTable<User>
          columns={[
            { label: 'First Name', accessor: 'firstName', sortable: true },
            { label: 'Last Name', accessor: 'lastName', sortable: true },
            { label: 'Email', accessor: 'email', sortable: true },
            { label: 'Username', accessor: 'username', sortable: true },
            { label: 'Phone', accessor: 'phone', sortable: true },
            {
              label: 'Role',
              accessor: 'role',
              sortable: true,
              render: (r: User) => capitalize(r.role),
            },
            {
              label: 'Actions',
              accessor: 'actions',
              render: (row: User) => {
                const currentRole = (
                  localStorage.getItem('role') || ''
                ).toLowerCase();
                const currentUserId = Number(localStorage.getItem('userId'));
                const isSuperAdmin = currentRole === 'superadmin';
                const isOwnAccount = currentUserId === row.id;
                const targetRole = (row.role || '').toLowerCase();
                const canEdit =
                  isSuperAdmin ||
                  isOwnAccount ||
                  (currentRole === 'manager' && targetRole === 'engineer');
                const canDelete = isSuperAdmin;
                return (
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => navigate(`/manage-user/${row.id}`)}
                      disabled={!canEdit}
                      className="text-sky-600 hover:text-sky-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title={
                        canEdit
                          ? 'Edit user'
                          : currentRole === 'manager'
                            ? 'Manager can edit own account and engineers only'
                            : 'You can only edit your own account (unless you are SuperAdmin)'
                      }
                    >
                      <BiEdit className="text-xl me-2" />
                    </button>
                    <button
                      onClick={() => remove(row.id, row.firstName)}
                      disabled={!canDelete}
                      className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title={
                        canDelete
                          ? 'Delete user'
                          : 'Only SuperAdmin can delete users'
                      }
                    >
                      <BiSolidTrash className="text-xl" />
                    </button>
                  </div>
                );
              },
            },
          ]}
          paginatedData={users ?? []}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          sortOrder={sortOrder}
          handleSort={handleSort}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
        />
      </div>
    </>
  );
}
