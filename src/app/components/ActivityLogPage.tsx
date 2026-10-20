import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw, Search, Store, UserRound } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

export type ActivityAction =
  | "vendor.updated"
  | "vendor.deleted"
  | "account.disabled"
  | "account.enabled"
  | "account.deleted";

export interface ActivityEvent {
  action: ActivityAction;
  entityType: "vendor" | "user";
  entityId: string;
  entityName: string;
  summary: string;
}

interface ActivityEntry extends ActivityEvent {
  id: string;
  actorName: string;
  actorEmail: string;
  createdAt: number | null;
}

interface ActivityResponse {
  entries: ActivityEntry[];
}

const ACTION_LABELS: Record<ActivityAction, string> = {
  "vendor.updated": "Vendor listing updated",
  "vendor.deleted": "Vendor listing deleted",
  "account.disabled": "Account disabled",
  "account.enabled": "Account re-enabled",
  "account.deleted": "Account deleted",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e9e5dd",
  borderRadius: "18px",
  boxShadow: "0 8px 24px rgba(45, 26, 14, 0.045)",
};

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null) return "Time unavailable";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | ActivityAction>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const getActivity = httpsCallable<{ limit: number }, ActivityResponse>(
      getFunctions(undefined, "us-central1"),
      "getAdminActivity"
    );

    getActivity({ limit: 100 })
      .then(({ data }) => {
        if (active) setEntries(data.entries);
      })
      .catch((loadError: unknown) => {
        console.error("Error loading admin activity:", loadError);
        if (active) setError("Activity could not be loaded. Check your admin access and Cloud Functions deployment.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (!normalizedSearch) return true;
      return [
        entry.entityName,
        entry.summary,
        entry.actorName,
        entry.actorEmail,
        ACTION_LABELS[entry.action],
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [actionFilter, entries, search]);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#a17b58" }}>
            Admin records
          </p>
          <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
            Activity log
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "#82766a" }}>
            Review recent vendor and account changes made by administrators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ border: "1px solid #e9e5dd", color: "#655848", background: "#fff" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ background: "#faf8f4", border: "1px solid #e9e5dd" }}>
            <Search size={16} color="#a17b58" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, record, or admin..."
              className="w-full bg-transparent py-3 text-sm outline-none"
              style={{ color: "#433a31" }}
            />
          </label>
          <select
            aria-label="Filter activity by action"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as "all" | ActivityAction)}
            className="rounded-xl px-3 py-3 text-sm outline-none"
            style={{ color: "#433a31", background: "#faf8f4", border: "1px solid #e9e5dd" }}
          >
            <option value="all">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Recent administrator activity">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 sm:px-6" style={{ borderColor: "#f0ede7" }}>
          <div className="flex items-center gap-2">
            <History size={17} color="#d95316" />
            <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>Recent activity</h3>
          </div>
          <span className="text-xs" style={{ color: "#82766a" }}>
            Showing up to 100 latest records
          </span>
        </div>

        {loading ? (
          <p className="px-6 py-10 text-center text-sm" style={{ color: "#82766a" }}>Loading activity…</p>
        ) : error ? (
          <div className="px-6 py-8 text-center" role="alert">
            <p className="text-sm" style={{ color: "#b54740" }}>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-3 text-sm font-semibold underline"
              style={{ color: "#d95316" }}
            >
              Try again
            </button>
          </div>
        ) : filteredEntries.length ? (
          <div className="divide-y" style={{ borderColor: "#f0ede7" }}>
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: "#d95316", background: "#fff0e8" }}>
                    {entry.entityType === "vendor"
                      ? <Store size={16} aria-hidden="true" />
                      : <UserRound size={16} aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "#433a31" }}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="mt-1 break-words text-sm" style={{ color: "#655848" }}>{entry.summary}</p>
                    <p className="mt-1 truncate text-xs" style={{ color: "#948779" }}>
                      {entry.entityType}: {entry.entityName} · Admin: {entry.actorName}
                      {entry.actorEmail ? ` (${entry.actorEmail})` : ""}
                    </p>
                  </div>
                </div>
                <time className="flex-shrink-0 text-xs sm:pl-4" style={{ color: "#82766a" }}>
                  {formatTimestamp(entry.createdAt)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: "#a17b58", background: "#f4efe7" }}>
              <History size={20} />
            </span>
            <p className="text-sm font-semibold" style={{ color: "#433a31" }}>
              {entries.length ? "No activity matches these filters" : "No activity recorded yet"}
            </p>
            <p className="mt-1 max-w-md text-sm" style={{ color: "#82766a" }}>
              Successful vendor and account changes will appear here after activity logging is deployed.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
