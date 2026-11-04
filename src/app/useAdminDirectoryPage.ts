import { useCallback, useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";
import type { Vendor } from "./components/types";
import type { UserProfileCollection } from "./userManagementApi";
import type { RecordSort } from "./useRecordPagination";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  collectionName: UserProfileCollection;
  createdAt: Date | null;
  role?: "customer" | "vendor" | "admin";
  isAccountDisabled?: boolean;
}

export interface DirectorySummary {
  accounts: number;
  customers: number;
  vendors: number;
  admins: number;
  listings: number;
  open: number;
  categories: string[];
}

interface DirectoryOptions {
  kind: "account" | "vendor";
  sort: RecordSort;
  search: string;
  role?: "all" | "customer" | "vendor" | "admin";
  status?: "All" | "Open" | "Closed";
  category?: string;
}

interface DirectoryResponse {
  version: number;
  records: Array<Record<string, unknown> & { id: string; createdAt: number | null }>;
  nextCursor: string | null;
  summary?: DirectorySummary;
}

function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "functions/not-found" || code === "functions/failed-precondition") {
    return "The user and vendor directory is not ready yet. Please try again shortly.";
  }
  if (code === "functions/permission-denied" || code === "functions/unauthenticated") {
    return "Unable to verify administrator access. Please sign in again.";
  }
  return "Unable to load this page. Check your connection and try again.";
}

// Only the active page is retained. Cursors let Previous re-query earlier pages
// without accumulating profiles in memory or fetching intervening records.
// Keep the page stable: refetch only for navigation, filters, or an explicit refresh.
export function useAdminDirectoryPage<T extends Vendor | UserAccount>(options: DirectoryOptions, enabled = true) {
  const [search, setSearch] = useState(options.search);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(options.search), 300);
    return () => window.clearTimeout(timer);
  }, [options.search]);
  const [pageSize, setPageSize] = useState(25);
  const queryKey = JSON.stringify({ ...options, search, pageSize });
  const [navigation, setNavigation] = useState<{ key: string; cursors: Array<string | null>; index: number }>({ key: queryKey, cursors: [null], index: 0 });
  useEffect(() => { setNavigation({ key: queryKey, cursors: [null], index: 0 }); }, [queryKey]);
  const current = navigation.key === queryKey ? navigation : { key: queryKey, cursors: [null], index: 0 };
  const cursor = current.cursors[current.index];
  const requestKey = JSON.stringify([queryKey, cursor]);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState<{ key: string; items: T[]; nextCursor: string | null }>({ key: "", items: [], nextCursor: null });
  const [summary, setSummary] = useState<DirectorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResult({ key: "", items: [], nextCursor: null });
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const fetchPage = httpsCallable<Record<string, unknown>, DirectoryResponse>(getFunctions(auth.app, "us-central1"), "getAdminDirectoryPage");
    void fetchPage({ ...JSON.parse(queryKey), cursor, includeSummary: true }).then(({ data }) => {
      if (!active) return;
      if (data.version !== 1 || !Array.isArray(data.records) || data.records.length > JSON.parse(queryKey).pageSize
        || data.records.some((record) => !record || typeof record.id !== "string" || (record.createdAt !== null && !Number.isFinite(record.createdAt)))
        || (data.nextCursor !== null && (typeof data.nextCursor !== "string" || !data.nextCursor || data.nextCursor === cursor))) {
        throw new Error("Invalid directory page response.");
      }
      const items = data.records.map((record) => ({ ...record, createdAt: record.createdAt === null ? null : new Date(record.createdAt) }) as T);
      setResult({ key: requestKey, items, nextCursor: data.nextCursor });
      if (data.summary) setSummary(data.summary);
      // Deleting the last record on the last page returns to the preceding page.
      if (!items.length && data.nextCursor === null) {
        setNavigation((previous) => previous.key === queryKey && previous.index > 0
          ? { ...previous, index: previous.index - 1 } : previous);
      }
    }).catch((failure: unknown) => {
      if (active) { console.error("Unable to load directory page:", failure); setError(errorMessage(failure)); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryKey, cursor, requestKey, revision, enabled]);

  const pending = enabled && (loading || result.key !== requestKey || search !== options.search);
  const items = enabled && result.key === requestKey && !error ? result.items : [];
  const nextCursor = result.key === requestKey ? result.nextCursor : null;
  return {
    items, summary, loading: pending && !error, error, refresh,
    page: current.index + 1, pageSize, hasNext: nextCursor !== null,
    onPageSizeChange: setPageSize,
    onPageChange: (page: number) => {
      if (pending || error) return;
      if (page === current.index + 2 && nextCursor) {
        setNavigation({ key: queryKey, index: current.index + 1, cursors: [...current.cursors.slice(0, current.index + 1), nextCursor] });
      } else if (page >= 1 && page <= current.index + 1) setNavigation({ ...current, index: page - 1 });
    },
  };
}
