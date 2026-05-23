import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const paged = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return {
    page,
    setPage,
    pageCount,
    pageSize,
    total,
    paged,
    rangeFrom: total === 0 ? 0 : (page - 1) * pageSize + 1,
    rangeTo: Math.min(page * pageSize, total),
  };
}
