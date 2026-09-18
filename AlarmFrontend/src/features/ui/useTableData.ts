import { useState, useMemo } from "react";

type SortOrder = "asc" | "desc";

interface UseTableDataOptions<T> {
  searchableFields?: (keyof T)[];
  rowsPerPage?: number;
}

export function useTableData<T extends object>(
  rawData: T[] | undefined | null,
  options: UseTableDataOptions<T> = {}
) {
  const { searchableFields = [], rowsPerPage = 10 } = options;

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);

  // ✅ Safely fallback to empty array if data is not valid
  const data = Array.isArray(rawData) ? rawData : [];

  const filtered = useMemo(() => {
    if (!searchableFields.length) return data;

    return data.filter((row) =>
      searchableFields.some((field) =>
        String(row[field] ?? "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    );
  }, [data, search, searchableFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortKey] ?? "");
      const bVal = String(b[sortKey] ?? "");

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortOrder]);

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return {
    search,
    setSearch,
    sortKey,
    sortOrder,
    handleSort,
    page,
    setPage,
    totalPages,
    paginatedData: paginated,
  };
}
