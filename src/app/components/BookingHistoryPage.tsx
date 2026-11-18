import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  History,
  ReceiptText,
  RefreshCw,
  Search,
  Store,
  Wallet,
} from "lucide-react";
import { getBookingHistory, downloadBookingReceipt } from "../bookingHistoryApi";
import { getRecordCreatedAt } from "../dateUtils";
import { RecordPagination, RecordSortSelect } from "./RecordPagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { sortRecords, useRecordPagination, type RecordSort } from "../useRecordPagination";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

interface BookingRecord {
  id: string;
  reference: string;
  paymentReference: string;
  itemsSummary: string;
  customer: string;
  vendor: string;
  status: string;
  bookingStage: string;
  date: Date | null;
  amount: string;
  searchText: string;
  receiptPaidAt: Date | null;
  refundedCents: number;
  receiptItems: ReceiptItem[];
  totalCents: number | null;
  hasReceipt: boolean;
  emailStatus: string;
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
  return getRecordCreatedAt(data) ?? parseDate(data.paymentPaidAt);
}

function getCents(data: Record<string, unknown>): number | null {
  const centsValue = data.totalCents ?? data.amountCents ?? data.priceCents;
  if (typeof centsValue === "number" && Number.isFinite(centsValue)) {
    return Math.round(centsValue);
  }
  const value = data.amount ?? data.totalAmount ?? data.bookingAmount ?? data.paymentAmount ?? data.total ?? data.price;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function getAmount(data: Record<string, unknown>): string {
  const centsValue = data.totalCents ?? data.amountCents ?? data.priceCents;
  if (typeof centsValue === "number" && Number.isFinite(centsValue)) {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: typeof data.currency === "string" ? data.currency : "MYR",
    }).format(centsValue / 100);
  }
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

function getItemsSummary(data: Record<string, unknown>): string {
  if (!Array.isArray(data.items)) return "";
  return data.items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
      return name ? `${quantity}× ${name}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function getStatusTone(status: string): { color: string; background: string } {
  const normalized = status.toLowerCase();
  if (["paid", "completed", "complete", "success", "successful", "approved", "collected"].some((value) => normalized.includes(value))) {
    return { color: "#22845b", background: "#eaf6ef" };
  }
  if (["pending", "processing", "unpaid", "waiting", "awaiting"].some((value) => normalized.includes(value))) {
    return { color: "#9b5f26", background: "#fbf3e8" };
  }
  if (["failed", "cancel", "reject", "refund", "error"].some((value) => normalized.includes(value))) {
    return { color: "#b54740", background: "#fff0ed" };
  }
  return { color: "#655848", background: "#f4efe7" };
}

function isPaidStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["paid", "completed", "complete", "success", "successful", "approved", "collected"].some((value) => normalized.includes(value));
}

function isPendingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["pending", "processing", "unpaid", "waiting", "awaiting"].some((value) => normalized.includes(value));
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

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(cents / 100);
}

function getReceiptItems(data: Record<string, unknown>): ReceiptItem[] {
  if (!Array.isArray(data.items)) return [];
  return data.items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.name === "string" && typeof item.quantity === "number" && typeof item.unitPriceCents === "number")
    .map((item) => ({
      name: String(item.name),
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unitPriceCents),
    }));
}

function mapBooking(id: string, data: Record<string, unknown>): BookingRecord {
  const reference = firstString(data, ["bookingId", "bookingID", "reference", "transactionId", "paymentId"], id);
  const paymentReference = firstString(data, ["paymentReference"], "");
  const itemsSummary = getItemsSummary(data);
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
  const status = firstString(data, ["paymentStatus", "bookingStatus", "status", "state"], "Unknown");
  const bookingStage = firstString(data, ["status", "bookingStatus", "state"], "");
  const date = getBookingDate(data);
  const amount = getAmount(data);
  const receiptPaidAt = parseDate(data.paymentPaidAt);
  const refundedCents = typeof data.paymentRefundedCents === "number" ? data.paymentRefundedCents : 0;
  const totalCents = getCents(data);
  const receiptItems = getReceiptItems(data);
  const hasReceipt = receiptPaidAt !== null;

  return {
    id,
    reference,
    paymentReference,
    itemsSummary,
    customer,
    vendor,
    status,
    bookingStage,
    date,
    amount,
    searchText: [reference, paymentReference, itemsSummary, customer, vendor, status, bookingStage, amount].join(" ").toLowerCase(),
    receiptPaidAt,
    refundedCents,
    receiptItems,
    totalCents,
    hasReceipt,
    emailStatus: firstString(data, ["transactionEmailStatus"], "Not recorded"),
  };
}

function BookingReceiptDetails({ booking }: { booking: BookingRecord }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  async function downloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try { await downloadBookingReceipt(booking.id); }
    catch (_) { setDownloadError("Could not download the PDF receipt. Please try again."); }
    finally { setDownloading(false); }
  }
  const remainingCents = booking.totalCents === null ? null : Math.max(0, booking.totalCents - booking.refundedCents);
  return (
    <div className="space-y-4 text-sm" style={{ color: "#433a31" }}>
      <button type="button" onClick={downloadPdf} disabled={downloading}
        className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-60">
        {downloading ? "Preparing PDF…" : "Download PDF"}
      </button>
      {downloadError && <p role="alert">{downloadError}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><div className="text-xs" style={{ color: "#82766a" }}>Customer</div><div>{booking.customer}</div></div>
        <div><div className="text-xs" style={{ color: "#82766a" }}>Stall</div><div>{booking.vendor}</div></div>
        <div><div className="text-xs" style={{ color: "#82766a" }}>Paid on</div><div>{formatDate(booking.receiptPaidAt)}</div></div>
        <div><div className="text-xs" style={{ color: "#82766a" }}>Booking ID</div><div className="break-all">{booking.id}</div></div>
      </div>
      {booking.paymentReference && (
        <div><div className="text-xs" style={{ color: "#82766a" }}>Payment reference</div><div className="break-all">{booking.paymentReference}</div></div>
      )}
      <div className="border-t pt-4" style={{ borderColor: "#e9e5dd" }}>
        <h4 className="mb-3 font-semibold">Items</h4>
        {booking.receiptItems.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex justify-between gap-4 py-1">
            <div>{item.quantity} × {item.name}<div className="text-xs" style={{ color: "#82766a" }}>{formatMoney(item.unitPriceCents)} each</div></div>
            <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t pt-4 font-semibold" style={{ borderColor: "#e9e5dd" }}>
        <div className="flex justify-between gap-4"><span>Amount paid</span><span>{booking.amount}</span></div>
        {booking.refundedCents > 0 && (
          <>
            <div className="flex justify-between gap-4"><span>Refunded</span><span>{formatMoney(booking.refundedCents)}</span></div>
            {remainingCents !== null && <div className="flex justify-between gap-4"><span>Remaining paid</span><span>{formatMoney(remainingCents)}</span></div>}
          </>
        )}
      </div>
      {(booking.status !== "paid" || booking.refundedCents > 0) && <p>Current status: {booking.status}</p>}
      <p className="text-xs" style={{ color: "#82766a" }}>Stripe payment</p>
    </div>
  );
}

interface VendorPayoutSummary {
  vendor: string;
  totalBookings: number;
  paidBookings: number;
  grossCents: number;
  refundedCents: number;
  netCents: number;
}

export function BookingHistoryPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"bookings" | "payouts">("bookings");
  const [payoutSearch, setPayoutSearch] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sort, setSort] = useState<RecordSort>("newest");
  const [loadedCount, setLoadedCount] = useState(0);
  const [selectedReceipt, setSelectedReceipt] = useState<BookingRecord | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLoadedCount(0);
    getBookingHistory({ signal: controller.signal, onProgress: (count) => { if (active) setLoadedCount(count); } })
      .then((records) => {
        if (!active) return;
        const mappedRecords = records.map((booking) => mapBooking(booking.id, booking.data));
        setBookings(mappedRecords);
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
            ? "Your account does not have permission to view booking history."
            : code === "functions/unauthenticated"
              ? "Your admin session has expired. Sign in again to view booking history."
              : "Booking history is currently unavailable. Please try again later."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const statuses = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.status))).sort(),
    [bookings]
  );
  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return sortRecords(bookings.filter((booking) =>
      (statusFilter === "all" || booking.status === statusFilter) &&
      (!normalizedSearch || booking.searchText.includes(normalizedSearch))
    ), sort, (booking) => ({ id: booking.id, name: booking.customer, date: booking.date }));
  }, [bookings, search, statusFilter, sort]);
  const pagination = useRecordPagination(filteredBookings, JSON.stringify([search, statusFilter, sort]));
  const paidCount = bookings.filter((booking) => isPaidStatus(booking.status)).length;
  const pendingCount = bookings.filter((booking) => isPendingStatus(booking.status)).length;

  const totalGrossCents = useMemo(() => {
    return bookings
      .filter((b) => isPaidStatus(b.status))
      .reduce((sum, b) => sum + (b.totalCents ?? 0), 0);
  }, [bookings]);

  const totalRefundedCents = useMemo(() => {
    return bookings.reduce((sum, b) => sum + b.refundedCents, 0);
  }, [bookings]);

  const totalPendingCents = useMemo(() => {
    return bookings
      .filter((b) => isPendingStatus(b.status))
      .reduce((sum, b) => sum + (b.totalCents ?? 0), 0);
  }, [bookings]);

  const totalNetPayoutCents = Math.max(0, totalGrossCents - totalRefundedCents);

  const vendorPayouts = useMemo<VendorPayoutSummary[]>(() => {
    const map = new Map<string, VendorPayoutSummary>();
    for (const b of bookings) {
      const v = b.vendor || "Unknown vendor";
      if (!map.has(v)) {
        map.set(v, {
          vendor: v,
          totalBookings: 0,
          paidBookings: 0,
          grossCents: 0,
          refundedCents: 0,
          netCents: 0,
        });
      }
      const entry = map.get(v)!;
      entry.totalBookings += 1;
      entry.refundedCents += b.refundedCents;
      if (isPaidStatus(b.status)) {
        entry.paidBookings += 1;
        entry.grossCents += b.totalCents ?? 0;
      }
    }
    for (const entry of map.values()) {
      entry.netCents = Math.max(0, entry.grossCents - entry.refundedCents);
    }
    return Array.from(map.values()).sort((a, b) => b.netCents - a.netCents);
  }, [bookings]);

  const filteredVendorPayouts = useMemo(() => {
    const q = payoutSearch.trim().toLowerCase();
    if (!q) return vendorPayouts;
    return vendorPayouts.filter((p) => p.vendor.toLowerCase().includes(q));
  }, [vendorPayouts, payoutSearch]);

  const bookingSummaryCards = [
    { label: "Total bookings", value: String(bookings.length), icon: <CalendarDays size={18} />, color: "#d95316", background: "#fff0e8" },
    { label: "Pending payment", value: String(pendingCount), icon: <Clock3 size={18} />, color: "#9b5f26", background: "#fbf3e8" },
    { label: "Paid / completed", value: String(paidCount), icon: <CheckCircle2 size={18} />, color: "#22845b", background: "#eaf6ef" },
    { label: "Other statuses", value: String(bookings.length - paidCount - pendingCount), icon: <CreditCard size={18} />, color: "#785333", background: "#f4efe7" },
  ];

  const payoutSummaryCards = [
    { label: "Gross revenue collected", value: formatMoney(totalGrossCents), icon: <Wallet size={18} />, color: "#22845b", background: "#eaf6ef" },
    { label: "Net vendor payouts", value: formatMoney(totalNetPayoutCents), icon: <Store size={18} />, color: "#d95316", background: "#fff0e8" },
    { label: "Total refunded", value: formatMoney(totalRefundedCents), icon: <CircleAlert size={18} />, color: "#b54740", background: "#fff0ed" },
    { label: "Pending settlements", value: formatMoney(totalPendingCents), icon: <Clock3 size={18} />, color: "#9b5f26", background: "#fbf3e8" },
  ];

  const summaryCards = activeTab === "bookings" ? bookingSummaryCards : payoutSummaryCards;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
          {activeTab === "bookings" ? "Booking history" : "Vendor payouts"}
        </h2>
        <p className="admin-intro mt-1.5" style={{ color: "#82766a" }}>
          {activeTab === "bookings"
            ? "Review individual customer booking records, orders, and payment statuses."
            : "Review financial settlement totals, refunds, and net payout balances per stall."}
        </p>
      </div>

      <div className="flex border-b" style={{ borderColor: "#e9e5dd" }}>
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className="flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition"
          style={{
            borderColor: activeTab === "bookings" ? "#d95316" : "transparent",
            color: activeTab === "bookings" ? "#d95316" : "#75685b",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <History size={16} />
          <span>All bookings ({bookings.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payouts")}
          className="flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition"
          style={{
            borderColor: activeTab === "payouts" ? "#d95316" : "transparent",
            color: activeTab === "payouts" ? "#d95316" : "#75685b",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Wallet size={16} />
          <span>Payout summary ({vendorPayouts.length} vendors)</span>
        </button>
      </div>

      <div className="admin-metrics">
        {summaryCards.map((card) => (
          <div key={card.label} className="admin-metric" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="admin-metric-icon flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: card.color, background: card.background }}>
                {card.icon}
              </span>
              <strong className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "#2d241d" }}>{card.value}</strong>
            </div>
            <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>{card.label}</p>
          </div>
        ))}
      </div>

      {activeTab === "payouts" ? (
        <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Vendor payouts summary">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{ borderColor: "#f0ede7" }}>
            <div className="flex items-center gap-2">
              <Store size={17} color="#d95316" />
              <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>Vendor payout breakdown</h3>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: "#faf8f4", border: "1px solid #e9e5dd" }}>
                <Search size={14} color="#a17b58" />
                <input
                  type="search"
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  placeholder="Filter by vendor / stall..."
                  className="bg-transparent text-xs outline-none"
                  style={{ color: "#433a31", width: "180px" }}
                />
              </label>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "#e9e5dd", color: "#655848", background: "#fff" }}
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <p role="status" className="px-6 py-10 text-center text-sm" style={{ color: "#82766a" }}>Loading payout summary…</p>
          ) : error ? (
            <div className="px-6 py-8 text-center" role="alert">
              <CircleAlert size={20} className="mx-auto mb-2" color="#b54740" />
              <p className="text-sm" style={{ color: "#b54740" }}>{error}</p>
            </div>
          ) : filteredVendorPayouts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead style={{ color: "#7a6c5d", background: "#faf8f4" }}>
                  <tr>
                    <th className="px-5 py-3 font-semibold sm:px-6">Vendor / Stall</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Total Bookings</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Paid Bookings</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Gross Volume</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Refunded</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Net Payout Due</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendorPayouts.map((vp) => (
                    <tr key={vp.vendor} className="border-t" style={{ borderColor: "#f0ede7" }}>
                      <td className="px-5 py-4 font-semibold" style={{ color: "#433a31" }}>
                        <div className="flex items-center gap-2">
                          <Store size={15} color="#d95316" />
                          <span>{vp.vendor}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{vp.totalBookings}</td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{vp.paidBookings}</td>
                      <td className="px-5 py-4 font-medium" style={{ color: "#433a31" }}>{formatMoney(vp.grossCents)}</td>
                      <td className="px-5 py-4" style={{ color: vp.refundedCents > 0 ? "#b54740" : "#655848" }}>
                        {vp.refundedCents > 0 ? formatMoney(vp.refundedCents) : "—"}
                      </td>
                      <td className="px-5 py-4 font-semibold" style={{ color: vp.netCents > 0 ? "#22845b" : "#433a31" }}>
                        {formatMoney(vp.netCents)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            color: vp.netCents > 0 ? "#22845b" : "#655848",
                            background: vp.netCents > 0 ? "#eaf6ef" : "#f4efe7",
                          }}
                        >
                          {vp.netCents > 0 ? "Ready for payout" : "No balance"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Store size={20} className="mb-2 text-[#a17b58]" />
              <p className="text-sm font-semibold" style={{ color: "#433a31" }}>No vendor payout records found</p>
            </div>
          )}
        </section>
      ) : (
        <>
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
              <RecordSortSelect label="bookings" nameLabel="Customer" value={sort} onChange={setSort} />
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
          <span className="text-xs" style={{ color: "#82766a" }}>
            {loading ? "Loading records…" : error ? "History unavailable" : `${filteredBookings.length} matching · ${bookings.length} total`}
          </span>
        </div>

        {loading ? (
          <p role="status" className="px-6 py-10 text-center text-sm" style={{ color: "#82766a" }}>Loading bookings… {loadedCount} records loaded</p>
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
                {pagination.items.map((booking) => {
                  const tone = getStatusTone(booking.status);
                  return (
                    <tr key={booking.id} className="border-t" style={{ borderColor: "#f0ede7" }}>
                      <td className="px-5 py-4 font-semibold" style={{ color: "#433a31" }}>
                        <div>{booking.reference}</div>
                        {booking.itemsSummary && (
                          <div className="mt-0.5 text-xs font-normal" style={{ color: "#655848" }}>
                            {booking.itemsSummary}
                          </div>
                        )}
                        {booking.paymentReference && booking.paymentReference !== booking.reference && (
                          <div className="mt-0.5 max-w-xs truncate text-xs font-normal" style={{ color: "#82766a" }} title={booking.paymentReference}>
                            Ref: {booking.paymentReference}
                          </div>
                        )}
                        {booking.hasReceipt && (
                          <button type="button" onClick={() => setSelectedReceipt(booking)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline"
                            style={{ color: "#d95316" }}>
                            <ReceiptText size={14} /> View receipt
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>
                        {booking.customer}
                        <div className="mt-1 text-xs">Email: {booking.emailStatus.replaceAll('_', ' ')}</div>
                      </td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{booking.vendor}</td>
                      <td className="px-5 py-4" style={{ color: "#655848" }}>{formatDate(booking.date)}</td>
                      <td className="px-5 py-4 font-medium" style={{ color: "#433a31" }}>{booking.amount}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={tone}>
                            {booking.status}
                          </span>
                          {booking.bookingStage && booking.bookingStage.toLowerCase() !== booking.status.toLowerCase() && (
                            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: "#655848", background: "#f4efe7" }}>
                              {booking.bookingStage}
                            </span>
                          )}
                        </div>
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
                : "New bookings will appear here."}
            </p>
          </div>
        )}
        {!loading && !error && <RecordPagination label="bookings" {...pagination} />}
      </section>
      </>
      )}
      <Dialog open={selectedReceipt !== null} onOpenChange={(open) => { if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
            <DialogDescription>StallSeeker booking payment record</DialogDescription>
          </DialogHeader>
          {selectedReceipt && <BookingReceiptDetails key={selectedReceipt.id} booking={selectedReceipt} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
