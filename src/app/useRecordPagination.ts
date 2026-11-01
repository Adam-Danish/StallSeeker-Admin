import { useState } from "react";

export type RecordSort = "newest" | "oldest" | "name-asc" | "name-desc";

export function sortRecords<T>(
  records: T[],
  sort: RecordSort,
  describe: (record: T) => { id: string; name: string; date?: Date | number | null }
): T[] {
  return [...records].sort((first, second) => {
    const a = describe(first);
    const b = describe(second);
    let comparison = 0;
    if (sort === "name-asc" || sort === "name-desc") {
      comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
      if (sort === "name-desc") comparison *= -1;
    } else {
      const aTime = a.date instanceof Date ? a.date.getTime() : a.date;
      const bTime = b.date instanceof Date ? b.date.getTime() : b.date;
      const aValid = typeof aTime === "number" && Number.isFinite(aTime);
      const bValid = typeof bTime === "number" && Number.isFinite(bTime);
      // Undated records stay accessible at the end in either date order.
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid) comparison = sort === "newest" ? bTime - aTime : aTime - bTime;
    }
    return comparison || a.id.localeCompare(b.id);
  });
}

export function useRecordPagination<T>(records: T[], resetKey: string) {
  const [state, setState] = useState({ page: 1, pageSize: 25, resetKey });
  const pageCount = Math.max(1, Math.ceil(records.length / state.pageSize));
  const page = state.resetKey === resetKey ? Math.min(state.page, pageCount) : 1;
  if (state.resetKey !== resetKey || state.page !== page) {
    setState({ ...state, resetKey, page });
  }
  return {
    items: records.slice((page - 1) * state.pageSize, page * state.pageSize),
    page,
    pageSize: state.pageSize,
    pageCount,
    total: records.length,
    onPageChange: (nextPage: number) => setState({
      ...state, resetKey, page: Math.max(1, Math.min(nextPage, pageCount)),
    }),
    onPageSizeChange: (pageSize: number) => setState({ page: 1, pageSize, resetKey }),
  };
}
