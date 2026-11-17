import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Landmark,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock3,
  Copy,
  Check,
  AlertTriangle,
  Send,
} from "lucide-react";
import { db } from "../../firebase";
import { getBookingHistory, type BookingHistoryItem } from "../bookingHistoryApi";
import {
  formatRmFromCents,
  parsePayoutDetailsDoc,
  parsePayoutLedgerDoc,
  summarizeAllVendorsEarnings,
  type VendorPayoutDetailsRecord,
  type VendorPayoutLedgerRecord,
} from "../payoutUtils";
import { PayoutActionDialogs, type PayoutModalState } from "./PayoutActionDialogs";

interface VendorProfileSummary {
  id: string;
  stallName: string;
  phoneNumber: string;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e9e5dd",
  boxShadow: "0 1px 4px rgba(45, 26, 14, 0.04)",
};

export function PayoutsPage() {
  const [vendors, setVendors] = useState<VendorProfileSummary[]>([]);
  const [detailsMap, setDetailsMap] = useState<Map<string, VendorPayoutDetailsRecord>>(new Map());
  const [payouts, setPayouts] = useState<VendorPayoutLedgerRecord[]>([]);
  const [bookings, setBookings] = useState<BookingHistoryItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "owed" | "saved" | "missing">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modal, setModal] = useState<PayoutModalState | null>(null);

  useEffect(() => {
    const unsubVendors = onSnapshot(
      collection(db, "vendors"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          const stallName =
            typeof data.stallName === "string" && data.stallName.trim()
              ? data.stallName.trim()
              : typeof data.name === "string" && data.name.trim()
                ? data.name.trim()
                : "Unnamed stall";
          const phoneNumber =
            typeof data.phoneNumber === "string" ? data.phoneNumber.trim() : "";
          return { id: d.id, stallName, phoneNumber };
        });
        list.sort((a, b) => a.stallName.localeCompare(b.stallName));
        setVendors(list);
      },
      (err) => {
        console.error("Failed to load vendors list:", err);
        setError("Vendors could not be loaded.");
      }
    );

    const unsubDetails = onSnapshot(
      collection(db, "vendorPayoutDetails"),
      (snapshot) => {
        const next = new Map<string, VendorPayoutDetailsRecord>();
        for (const d of snapshot.docs) {
          next.set(d.id, parsePayoutDetailsDoc(d.id, d.data() as Record<string, unknown>));
        }
        setDetailsMap(next);
      },
      (err) => {
        console.error("Failed to load vendor bank details:", err);
        setError("Vendor bank details could not be loaded. Check Firestore permissions.");
      }
    );

    const unsubPayouts = onSnapshot(
      collection(db, "vendorPayouts"),
      (snapshot) => {
        const next = snapshot.docs.map((d) =>
          parsePayoutLedgerDoc(d.id, d.data() as Record<string, unknown>)
        );
        next.sort((a, b) => {
          const aMs = (a.settledAt ?? a.requestedAt ?? a.updatedAt)?.getTime() ?? 0;
          const bMs = (b.settledAt ?? b.requestedAt ?? b.updatedAt)?.getTime() ?? 0;
          return bMs - aMs;
        });
        setPayouts(next);
      },
      (err) => {
        console.error("Failed to load vendor payouts:", err);
        setError("Payout records could not be loaded.");
      }
    );

    return () => {
      unsubVendors();
      unsubDetails();
      unsubPayouts();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setBookingsLoading(true);
    setError(null);
    getBookingHistory({ signal: controller.signal })
      .then((records) => {
        if (active) setBookings(records);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("Unable to load booking history for payouts:", err);
        setError("Paid booking totals could not be loaded. Retry to refresh balances.");
      })
      .finally(() => {
        if (active) setBookingsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const earningsByVendor = useMemo(
    () => summarizeAllVendorsEarnings(bookings, payouts),
    [bookings, payouts]
  );

  const vendorNameById = useMemo(
    () => new Map(vendors.map((v) => [v.id, v.stallName])),
    [vendors]
  );

  const pendingRequests = useMemo(
    () => payouts.filter((p) => p.status === "pending"),
    [payouts]
  );

  const vendorRows = useMemo(() => {
    const knownIds = new Set<string>(vendors.map((v) => v.id));
    for (const id of detailsMap.keys()) knownIds.add(id);
    for (const id of earningsByVendor.keys()) knownIds.add(id);

    const rows = Array.from(knownIds).map((id) => {
      const profile = vendors.find((v) => v.id === id);
      const bankDetails = detailsMap.get(id) ?? null;
      const summary = earningsByVendor.get(id) ?? {
        liveNetSalesCents: 0,
        livePaidOrdersCount: 0,
        testNetSalesCents: 0,
        paidOutCents: 0,
        pendingCents: 0,
        unsettledLiveCents: 0,
        availableToRequestCents: 0,
      };
      return {
        id,
        stallName: profile?.stallName || bankDetails?.accountHolderName || id,
        phoneNumber: profile?.phoneNumber || "",
        bankDetails,
        summary,
      };
    });

    rows.sort((a, b) => {
      if (b.summary.unsettledLiveCents !== a.summary.unsettledLiveCents) {
        return b.summary.unsettledLiveCents - a.summary.unsettledLiveCents;
      }
      return a.stallName.localeCompare(b.stallName);
    });
    return rows;
  }, [vendors, detailsMap, earningsByVendor]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendorRows.filter((row) => {
      if (filter === "owed" && row.summary.unsettledLiveCents <= 0) return false;
      if (filter === "saved" && !row.bankDetails) return false;
      if (filter === "missing" && row.bankDetails) return false;
      if (!q) return true;
      const haystack = [
        row.stallName,
        row.id,
        row.bankDetails?.bankName ?? "",
        row.bankDetails?.accountHolderName ?? "",
        row.bankDetails?.accountNumber ?? "",
        row.bankDetails?.duitNowId ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [vendorRows, filter, search]);

  const totals = useMemo(() => {
    let totalOwed = 0;
    let totalPaid = 0;
    let pendingAmount = 0;
    let savedBanks = 0;
    for (const row of vendorRows) {
      totalOwed += row.summary.unsettledLiveCents;
      totalPaid += row.summary.paidOutCents;
      if (row.bankDetails) savedBanks++;
    }
    for (const req of pendingRequests) {
      pendingAmount += req.amountCents;
    }
    return {
      totalOwed,
      totalPaid,
      pendingAmount,
      savedBanks,
      totalVendors: vendorRows.length,
    };
  }, [vendorRows, pendingRequests]);

  const copyAccount = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      setError("Unable to copy to clipboard. Copy the number manually.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
          Vendor Payouts
        </h2>
        <p className="admin-intro mt-1.5" style={{ color: "#82766a" }}>
          Inspect vendor bank accounts, settle payout requests, and log Stripe-to-bank transfers.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ color: "#B42318", background: "#fff0ed", border: "1px solid #f2d1cb" }}>
          {error}
        </div>
      )}
      {feedback && (
        <div role="status" className="rounded-xl px-4 py-3 text-sm" style={{ color: "#22845b", background: "#eaf6ef", border: "1px solid #ccebd8" }}>
          {feedback}
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="admin-metrics">
        <div className="admin-metric" style={cardStyle}>
          <div className="flex items-center justify-between">
            <span className="admin-metric-icon flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "#9b5f26", background: "#fbf3e8" }}>
              <Clock3 size={18} />
            </span>
            <strong className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
              {pendingRequests.length} ({formatRmFromCents(totals.pendingAmount)})
            </strong>
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>Pending payout requests</p>
        </div>

        <div className="admin-metric" style={cardStyle}>
          <div className="flex items-center justify-between">
            <span className="admin-metric-icon flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "#d95316", background: "#fff0e8" }}>
              <Landmark size={18} />
            </span>
            <strong className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
              {formatRmFromCents(totals.totalOwed)}
            </strong>
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>Unsettled Live balance owed</p>
        </div>

        <div className="admin-metric" style={cardStyle}>
          <div className="flex items-center justify-between">
            <span className="admin-metric-icon flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "#22845b", background: "#eaf6ef" }}>
              <CheckCircle2 size={18} />
            </span>
            <strong className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
              {formatRmFromCents(totals.totalPaid)}
            </strong>
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>Total transferred to vendors</p>
        </div>

        <div className="admin-metric" style={cardStyle}>
          <div className="flex items-center justify-between">
            <span className="admin-metric-icon flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "#785333", background: "#f4efe7" }}>
              <Send size={18} />
            </span>
            <strong className="text-2xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
              {totals.savedBanks} / {totals.totalVendors}
            </strong>
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>Vendors with bank details saved</p>
        </div>
      </div>

      {/* Pending Requests Queue */}
      {pendingRequests.length > 0 && (
        <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Pending payout requests">
          <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6" style={{ borderColor: "#f0ede7" }}>
            <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>
              Pending Payout Requests ({pendingRequests.length})
            </h3>
            <span className="text-xs" style={{ color: "#82766a" }}>
              Verify Live balance before sending DuitNow / bank transfer
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "#f0ede7" }}>
            {pendingRequests.map((req) => {
              const summary = earningsByVendor.get(req.vendorId);
              const unsettled = summary?.unsettledLiveCents ?? 0;
              const overBalance = !bookingsLoading && req.amountCents > unsettled;
              const stall = req.stallName || vendorNameById.get(req.vendorId) || req.vendorId;
              return (
                <div key={req.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold" style={{ color: "#2d241d" }}>
                        {stall}
                      </span>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: "#9b5f26", background: "#fbf3e8" }}>
                        {formatRmFromCents(req.amountCents)}
                      </span>
                      {overBalance && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: "#B42318", background: "#fff0ed" }}>
                          <AlertTriangle size={12} /> Exceeds verified unsettled ({formatRmFromCents(unsettled)})
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: "#433a31" }}>
                      <strong>{req.bankName}</strong> · <span style={{ fontFamily: "monospace" }}>{req.accountNumber}</span> · {req.accountHolderName}
                      {req.duitNowId ? ` · DuitNow: ${req.duitNowId}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "#82766a" }}>
                      {req.requestedAt ? `Requested ${req.requestedAt.toLocaleString()}` : "Requested just now"}
                      {req.vendorNote ? ` · Note: ${req.vendorNote}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyAccount(`req-${req.id}`, req.accountNumber)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ border: "1px solid #e9e5dd", background: "#fff", color: "#433a31", cursor: "pointer" }}
                    >
                      {copiedId === `req-${req.id}` ? <Check size={13} color="#22845b" /> : <Copy size={13} />}
                      {copiedId === `req-${req.id}` ? "Copied No." : "Copy Acct"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ kind: "settle", record: req })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ border: "none", background: "#22845b", cursor: "pointer" }}
                    >
                      Mark Transferred
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ kind: "reject", record: req })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ border: "1px solid #f2d1cb", background: "#fff", color: "#B42318", cursor: "pointer" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Filter Toolbar */}
      <section className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ background: "#faf8f4", border: "1px solid #e9e5dd" }}>
            <Search size={16} color="#a17b58" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stall, bank name, account holder, or account number..."
              className="w-full bg-transparent py-3 text-sm outline-none"
              style={{ color: "#433a31" }}
            />
          </label>
          <select
            aria-label="Filter vendors by payout state"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-xl px-3 py-3 text-sm outline-none"
            style={{ color: "#433a31", background: "#faf8f4", border: "1px solid #e9e5dd" }}
          >
            <option value="all">All vendors</option>
            <option value="owed">Has balance owed</option>
            <option value="saved">Bank details saved</option>
            <option value="missing">Missing bank details</option>
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={bookingsLoading}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-[#faf8f4]"
            style={{ border: "1px solid #e9e5dd", color: "#655848", background: "#fff", cursor: "pointer" }}
          >
            <RefreshCw size={15} className={bookingsLoading ? "animate-spin" : ""} />
            Refresh Sales
          </button>
        </div>
      </section>

      {/* Vendor Bank Directory & Balances Table */}
      <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Vendor payout directory">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6" style={{ borderColor: "#f0ede7" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>
            Vendor Bank Accounts &amp; Balances
          </h3>
          <span className="text-xs" style={{ color: "#82766a" }}>
            {bookingsLoading ? "Calculating balances…" : `${filteredVendors.length} vendors`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead style={{ color: "#7a6c5d", background: "#faf8f4" }}>
              <tr>
                <th className="px-5 py-3 font-semibold sm:px-6">Stall</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Bank Details</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Live Sales</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Paid Out</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Balance Owed</th>
                <th className="px-5 py-3 text-right font-semibold sm:px-6">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm" style={{ color: "#82766a" }}>
                    No vendors match these filters.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: "#f0ede7" }}>
                    <td className="px-5 py-4 font-semibold" style={{ color: "#2d241d" }}>
                      <div>{row.stallName}</div>
                      {row.phoneNumber && (
                        <div className="mt-0.5 text-xs font-normal" style={{ color: "#82766a" }}>
                          {row.phoneNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.bankDetails ? (
                        <div>
                          <div className="font-semibold" style={{ color: "#2d241d" }}>
                            {row.bankDetails.bankName} — {row.bankDetails.accountHolderName}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: "#655848" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                              {row.bankDetails.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => void copyAccount(`dir-${row.id}`, row.bankDetails!.accountNumber)}
                              aria-label={`Copy account number for ${row.stallName}`}
                              style={{ minHeight: "26px", border: "1px solid #e9e5dd", background: "#faf8f4", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 600, color: "#433a31", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              {copiedId === `dir-${row.id}` ? <Check size={11} color="#22845b" /> : <Copy size={11} />}
                              {copiedId === `dir-${row.id}` ? "Copied" : "Copy"}
                            </button>
                          </div>
                          {row.bankDetails.duitNowId && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "#82766a" }}>
                              <span>
                                DuitNow: <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#433a31" }}>{row.bankDetails.duitNowId}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyAccount(`dir-dn-${row.id}`, row.bankDetails!.duitNowId!)}
                                aria-label={`Copy DuitNow ID for ${row.stallName}`}
                                style={{ minHeight: "26px", border: "1px solid #e9e5dd", background: "#faf8f4", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 600, color: "#433a31", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                {copiedId === `dir-dn-${row.id}` ? <Check size={11} color="#22845b" /> : <Copy size={11} />}
                                {copiedId === `dir-dn-${row.id}` ? "Copied" : "Copy"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: "#9b5f26", background: "#fbf3e8" }}>
                          Not submitted
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4" style={{ color: "#433a31" }}>
                      <div>{formatRmFromCents(row.summary.liveNetSalesCents)}</div>
                      {row.summary.testNetSalesCents > 0 && (
                        <div className="text-xs" style={{ color: "#82766a" }}>
                          +{formatRmFromCents(row.summary.testNetSalesCents)} test
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-medium" style={{ color: "#22845b" }}>
                      {formatRmFromCents(row.summary.paidOutCents)}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: row.summary.unsettledLiveCents > 0 ? "#d95316" : "#655848" }}>
                      {formatRmFromCents(row.summary.unsettledLiveCents)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.bankDetails ? (
                        <button
                          type="button"
                          onClick={() =>
                            setModal({
                              kind: "direct",
                              vendorId: row.id,
                              stallName: row.stallName,
                              bankDetails: row.bankDetails!,
                              defaultCents: row.summary.unsettledLiveCents,
                            })
                          }
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                          style={{ border: "none", background: "#d95316", cursor: "pointer" }}
                        >
                          Record Transfer
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: "#82766a" }}>
                          Awaiting bank details
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settlement History */}
      <section className="overflow-hidden rounded-2xl" style={cardStyle} aria-label="Payout history">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4 sm:px-6" style={{ borderColor: "#f0ede7" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>
            Transfer &amp; Request History
          </h3>
          <span className="text-xs" style={{ color: "#82766a" }}>
            {payouts.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead style={{ color: "#7a6c5d", background: "#faf8f4" }}>
              <tr>
                <th className="px-5 py-3 font-semibold sm:px-6">Stall</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Destination Account</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Amount</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Status</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Reference / Notes</th>
                <th className="px-5 py-3 font-semibold sm:px-6">Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm" style={{ color: "#82766a" }}>
                    No payout requests or transfers recorded yet.
                  </td>
                </tr>
              ) : (
                payouts.map((entry) => {
                  const statusTone =
                    entry.status === "paid"
                      ? { color: "#22845b", background: "#eaf6ef" }
                      : entry.status === "rejected"
                        ? { color: "#B42318", background: "#fff0ed" }
                        : { color: "#9b5f26", background: "#fbf3e8" };
                  const displayDate = entry.settledAt ?? entry.requestedAt ?? entry.updatedAt;
                  return (
                    <tr key={entry.id} className="border-t" style={{ borderColor: "#f0ede7" }}>
                      <td className="px-5 py-3 font-semibold" style={{ color: "#2d241d" }}>
                        {entry.stallName || vendorNameById.get(entry.vendorId) || entry.vendorId}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#433a31" }}>
                        <div>{entry.bankName} · <span style={{ fontFamily: "monospace" }}>{entry.accountNumber}</span></div>
                        <div style={{ color: "#82766a" }}>{entry.accountHolderName}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: "#2d241d" }}>
                        {formatRmFromCents(entry.amountCents)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase" style={statusTone}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#655848" }}>
                        {entry.transferReference && <div className="font-semibold" style={{ color: "#22845b" }}>Ref: {entry.transferReference}</div>}
                        {entry.adminNote && <div>Admin: {entry.adminNote}</div>}
                        {entry.vendorNote && <div>Vendor: {entry.vendorNote}</div>}
                        {entry.settledByEmail && <div style={{ color: "#82766a" }}>By: {entry.settledByEmail}</div>}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#82766a" }}>
                        {displayDate ? displayDate.toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PayoutActionDialogs
        modal={modal}
        onClose={() => setModal(null)}
        onSuccess={(message) => setFeedback(message)}
      />
    </div>
  );
}
