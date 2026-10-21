import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  History,
  RefreshCw,
  Search,
} from "lucide-react";
import { getBookingHistory } from "../bookingHistoryApi";
import { getRecordCreatedAt } from "../dateUtils";

interface BookingRecord {
  id: string;
  reference: string;
  customer: string;
  vendor: string;
  status: string;
  date: Date | null;
  amount: string;
  searchText: string;
}

interface BookingHistoryPageProps {
  previewMode?: boolean;
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e9e5dd",
  borderRadius: "18px",
  boxShadow: "0 8px 24px rgba(45, 26, 14, 0.045)",
};

function firstString(data: Record<string, unknown>, fields: string[], fallback: string): string {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    const date: unknown = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function getBookingDate(data: Record<string, unknown>): Date | null {
  for (const field of ["bookingDate", "booking_date", "appointmentDate", "date", "paymentDate"]) {
    const date = parseDate(data[field]);
    if (date) return date;
  }
  return getRecordCreatedAt(data);
}

function getAmount(data: Record<string, unknown>): string {
  const value = data.amount ?? data.totalAmount ?? data.bookingAmount ?? data.paymentAmount ?? data.total ?? data.price;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: typeof data.currency === "string" ? data.currency : "MYR",
    }).format(value);
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return "—";
}

function getStatusTone(status: string): { color: string; background: string } {
  const normalized = status.toLowerCase();
  if (["paid", "completed", "complete", "success", "successful", "approved"].some((value) => normalized.includes(value))) {
    return { color: "#22845b", background: "#eaf6ef" };
  }
  if (["pending", "processing", "unpaid", "waiting"].some((value) => normalized.includes(value))) {
    return { color: "#9b5f26", background: "#fbf3e8" };
  }
  if (["failed", "cancel", "reject", "refund", "error"].some((value) => normalized.includes(value))) {
    return { color: "#b54740", background: "#fff0ed" };
  }
  return { color: "#655848", background: "#f4efe7" };
}

function isPaidStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["paid", "completed", "complete", "success", "successful", "approved"].some((value) => normalized.includes(value));
}

function isPendingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["pending", "processing", "unpaid", "waiting"].some((value) => normalized.includes(value));
}

function formatDate(date: Date | null): string {
  if (!date) return "Date unavailable";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapBooking(id: string, data: Record<string, unknown>): BookingRecord {
  const reference = firstString(data, ["bookingId", "bookingID", "reference", "transactionId", "paymentId"], id);
  const customer = firstString(
    data,
    ["customerName", "userName", "fullName", "name", "customerEmail", "userEmail", "userId", "customerId"],
    "Customer unavailable"
  );
  const vendor = firstString(
    data,
    ["vendorName", "stallName", "businessName", "vendorId", "stallId"],
    "Vendor unavailable"
  );
  const status = firstString(data, ["bookingStatus", "paymentStatus", "status", "state"], "Unknown");
  const date = getBookingDate(data);
  const amount = getAmount(data);

  return {
    id,
    reference,
    customer,
    vendor,
    status,
    date,
    amount,
    searchText: [reference, customer, vendor, status, amount].join(" ").toLowerCase(),
  };
}

export function BookingHistoryPage({ previewMode = false }: BookingHistoryPageProps) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (previewMode) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    getBookingHistory()
      .then((records) => {
        if (!active) return;
        const mappedRecords = records.map((booking) => mapBooking(booking.id, booking.data));
        setBookings(mappedRecords.sort((first, second) => (second.date?.getTime() ?? 0) - (first.date?.getTime() ?? 0)));
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Unable to load booking history:", loadError);
        const code =
          typeof loadError === "object" && loadError !== null && "code" in loadError
            ? String(loadError.code)
            : "";
        setError(
          code === "functions/permission-denied"
            ? "Your Firebase profile does not have the admin role needed to view booking history."
            : code === "functions/unauthenticated"
              ? "Your admin session has expired. Sign in again to view booking history."
              : "Booking history could not be loaded. Confirm the getBookingHistory Firebase Function is deployed, then try again."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [previewMode, reloadKey]);

  const statuses = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.status))).sort(),
    [bookings]
  );
  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return bookings.filter((booking) =>
      (statusFilter === "all" || booking.status === statusFilter) &&
      (!normalizedSearch || booking.searchText.includes(normalizedSearch))
    );
  }, [bookings, search, statusFilter]);
  const paidCount = bookings.filter((booking) => isPaidStatus(booking.status)).length;
  const pendingCount = bookings.filter((booking) => isPendingStatus(booking.status)).length;
  const summaryCards = [
    { label: "Booking records loaded", value: bookings.length, icon: <CalendarDays size={18} />, color: "#d95316", background: "#fff0e8" },
    { label: "Pending payment", value: pendingCount, icon: <Clock3 size={18} />, color: "#9b5f26", background: "#fbf3e8" },
    { label: "Paid / completed", value: paidCount, icon: <CheckCircle2 size={18} />, color: "#22845b", background: "#eaf6ef" },
    { label: "Other statuses", value: bookings.length - paidCount - pendingCount, icon: <CreditCard size={18} />, color: "#785333", background: "#f4efe7" },
  ];

  if (previewMode) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-10">
        <section className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
          <div className="flex items-center gap-3">
            <History size={20} color="#d95316" />
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>Booking history</h2>
          </div>
          <p className="mt-3 text-sm" style={{ color: "#655848" }}>
            Booking records require an authenticated Firebase administrator session. Sign out of preview and sign in with your admin account to load the bookingPayment collection.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-10">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#a17b58" }}>
          Marketplace records
        </p>
        <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>Booking history</h2>
        <p className="mt-1.5 text-sm" style={{ color: "#82766a" }}>
          Review booking records and their payment status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: card.color, background: card.background }}>
                {card.icon}
              </span>
              <strong className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>{card.value}</strong>
            </div>
            <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>{card.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ background: "#faf8f4", border: "1px solid #e9e5dd" }}>
            <Search size={16} color="#a17b58" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search booking, customer, or vendor..."
              className="w-full bg-transparent py-3 text-sm outline-none"
              style={{ color: "#433a31" }}
            />
          </label>
          <select
            aria-label="Filter bookings by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl px-3 py-3 text-sm outline-none"
            style={{ color: "#433a31", background: "#faf8f4", border: "1px solid #e9e5dd" }}
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ border: "1px solid #e9e5dd", color: "#655848", background: "#fff" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Booking history records">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6" style={{ borderColor: "#f0ede7" }}>
          <div className="flex items-center gap-2">
            <History size={17} color="#d95316" />
            <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>Booking records</h3>
          </div>
          <span className="text-xs" style={{ color: "#82766a" }}>Up to 500 records · {filteredBookings.length} shown</span>
        </div>

        {loading ? (
          <p className="px-6 py-10 text-center text-sm" style={{ color: "#82766a" }}>Loading bookings…</p>
        ) : error ? (
          <div className="px-6 py-8 text-center" role="alert">
            <CircleAlert size={20} className="mx-auto mb-2" color="#b54740" />
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
        ) : filteredBookings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead style={{ color: "#7a6c5d", background: "#faf8f4" }}>
                <tr>
                  <th className="px-5 py-3 font-semibold sm:px-6">Booking</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Customer</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Vendor</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Date</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Amount</th>
                  <th className="px-5 py-3 font-semibold sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const tone = getStatusTone(booking.status);
                  return (
                    <tr key={booking.id} className="border-t" style={{ borderColor: "#f0ede7" }}>
                      <td className="px-5 py-4 font-semibold" style={{ color: "#433a31" }}>{booking.reference}</td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{booking.customer}</td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{booking.vendor}</td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{formatDate(booking.date)}</td>
                      <td className="px-5 py-4 font-medium" style={{ color: "#433a31" }}>{booking.amount}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={tone}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: "#a17b58", background: "#f4efe7" }}>
              <CalendarDays size={20} />
            </span>
            <p className="text-sm font-semibold" style={{ color: "#433a31" }}>
              {bookings.length ? "No bookings match these filters" : "No booking records found"}
            </p>
            <p className="mt-1 max-w-md text-sm" style={{ color: "#82766a" }}>
              {bookings.length
                ? "Try another search term or status."
                : "New records saved to the bookingPayment collection will appear here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
