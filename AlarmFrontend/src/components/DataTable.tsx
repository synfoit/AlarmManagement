import React, { useEffect, useRef } from 'react';
import { BiSolidLeftArrow, BiSolidRightArrow } from 'react-icons/bi';

export type Column<T> = {
  label: string;
  accessor: keyof T | 'actions';
  sortable?: boolean;
  render?: (row: T, rowIndex: number) => React.ReactNode;
};

export function DataTable<T extends { id: number | string }>(props: {
  columns: Column<T>[];
  paginatedData: T[];
  search?: string;
  setSearch?: (s: string) => void;
  sortKey?: keyof T;
  sortOrder?: 'asc' | 'desc';
  handleSort?: (key: keyof T) => void;
  page?: number;
  setPage?: (p: number) => void;
  totalPages?: number;
  enablePagination?: boolean;
  enableInfiniteScroll?: boolean;
  isLoading?: boolean;
  onLoadMore?: () => void;
}) {
  const {
    columns,
    paginatedData,
    sortKey,
    sortOrder,
    handleSort,
    page = 1,
    setPage,
    totalPages = 1,
    enablePagination = true,
    enableInfiniteScroll = false,
    isLoading = false,
    onLoadMore,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);

  // infinite‐scroll listener
  useEffect(() => {
    if (!enableInfiniteScroll || !onLoadMore) return;
    const el = scrollRef.current!;
    const onScroll = () => {
      const threshold = 100;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold &&
        !isLoading
      ) {
        onLoadMore();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [enableInfiniteScroll, isLoading, onLoadMore]);

  return (
    <div
      ref={scrollRef}
      className={`table-auto ${
        enableInfiniteScroll ? 'h-96 overflow-auto' : 'overflow-x-auto'
      }`}
    >
      <table className="w-full border-gray-300 text-sm bg-white text-center border border-collapse rounded-lg">
        <thead>
          <tr className="bg-gray-200 text-sm">
            {columns.map((col, colIndex) => (
              <th
                key={String(col.accessor) + '-' + colIndex}
                className="p-2 border border-gray-300 font-medium cursor-pointer"
                onClick={() =>
                  col.sortable && handleSort?.(col.accessor as keyof T)
                }
              >
                {col.label}
                {col.sortable &&
                  sortKey === col.accessor &&
                  (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center text-gray-500 text-lg py-4 font-medium"
              >
                Data not found..
              </td>
            </tr>
          ) : (
            paginatedData.map((row, rowIndex) => (
              <tr
                key={`${row.id}-${rowIndex}`}
                className="hover:bg-gray-50 text-sm border-t"
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={`${row.id}-${colIndex}`}
                    className="p-2 border text-center"
                  >
                    {col.render
                      ? col.render(row, rowIndex)
                      : (row as any)[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* classic pagination */}
      {enablePagination && setPage && (
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button
            className="px-3 py-1 bg-sky-600 text-white rounded disabled:opacity-50 flex items-center gap-1"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            <BiSolidLeftArrow /> Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              onClick={() => setPage(pg)}
              className={`px-3 py-1 rounded border ${
                pg === page
                  ? 'bg-sky-700 text-white'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {pg}
            </button>
          ))}
          <button
            className="px-3 py-1 bg-sky-600 text-white rounded disabled:opacity-50 flex items-center gap-1"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next <BiSolidRightArrow />
          </button>
        </div>
      )}

      {/* infinite‑scroll loader */}
      {enableInfiniteScroll && isLoading && (
        <div className="py-2 text-center text-gray-500">Loading…</div>
      )}
    </div>
  );
}
