import type { BookingHistoryItem } from "./bookingHistoryApi";

export interface VendorPayoutDetailsRecord {
  vendorId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  duitNowId: string;
  notes: string;
  updatedAt: Date | null;
}

export type VendorPayoutStatus = "pending" | "paid" | "rejected";

export interface VendorPayoutLedgerRecord {
  id: string;
  vendorId: string;
  stallName: string;
  amountCents: number;
  status: VendorPayoutStatus;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  duitNowId: string;
  vendorNote: string;
  transferReference: string;
  adminNote: string;
  requestedBy: string;
  settledByUid: string;
  settledByEmail: string;
  requestedAt: Date | null;
  settledAt: Date | null;
  updatedAt: Date | null;
}

export interface VendorEarningsSummary {
  liveNetSalesCents: number;
  livePaidOrdersCount: number;
  testNetSalesCents: number;
  paidOutCents: number;
  pendingCents: number;
  unsettledLiveCents: number;
  availableToRequestCents: number;
}

export function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const maybe = value as { toDate?: () => Date; toMillis?: () => number; seconds?: number };
    if (typeof maybe.toDate === "function") return maybe.toDate();
    if (typeof maybe.toMillis === "function") return new Date(maybe.toMillis());
    if (typeof maybe.seconds === "number" && Number.isFinite(maybe.seconds)) {
      return new Date(maybe.seconds * 1000);
    }
  }
  return null;
}

export function formatRmFromCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return `RM ${(safe / 100).toFixed(2)}`;
}

export function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/[\s-]+/g, "").trim();
  if (cleaned.length <= 4) return cleaned;
  return `•••• ${cleaned.slice(-4)}`;
}

export function parsePayoutDetailsDoc(
  vendorId: string,
  data: Record<string, unknown>
): VendorPayoutDetailsRecord {
  return {
    vendorId: typeof data.vendorId === "string" && data.vendorId.trim() ? data.vendorId.trim() : vendorId,
    bankName: typeof data.bankName === "string" ? data.bankName.trim() : "",
    accountHolderName: typeof data.accountHolderName === "string" ? data.accountHolderName.trim() : "",
    accountNumber: typeof data.accountNumber === "string" ? data.accountNumber.trim() : "",
    duitNowId: typeof data.duitNowId === "string" ? data.duitNowId.trim() : "",
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function parsePayoutLedgerDoc(
  id: string,
  data: Record<string, unknown>
): VendorPayoutLedgerRecord {
  const rawStatus = typeof data.status === "string" ? data.status.trim().toLowerCase() : "pending";
  const status: VendorPayoutStatus =
    rawStatus === "paid" || rawStatus === "rejected" ? rawStatus : "pending";
  const rawAmount = Number(data.amountCents ?? 0);
  return {
    id,
    vendorId: typeof data.vendorId === "string" ? data.vendorId.trim() : "",
    stallName: typeof data.stallName === "string" ? data.stallName.trim() : "",
    amountCents: Number.isFinite(rawAmount) ? Math.round(rawAmount) : 0,
    status,
    bankName: typeof data.bankName === "string" ? data.bankName.trim() : "",
    accountHolderName: typeof data.accountHolderName === "string" ? data.accountHolderName.trim() : "",
    accountNumber: typeof data.accountNumber === "string" ? data.accountNumber.trim() : "",
    duitNowId: typeof data.duitNowId === "string" ? data.duitNowId.trim() : "",
    vendorNote: typeof data.vendorNote === "string" ? data.vendorNote.trim() : "",
    transferReference: typeof data.transferReference === "string" ? data.transferReference.trim() : "",
    adminNote: typeof data.adminNote === "string" ? data.adminNote.trim() : "",
    requestedBy: typeof data.requestedBy === "string" ? data.requestedBy.trim() : "",
    settledByUid: typeof data.settledByUid === "string" ? data.settledByUid.trim() : "",
    settledByEmail: typeof data.settledByEmail === "string" ? data.settledByEmail.trim() : "",
    requestedAt: toDateOrNull(data.requestedAt),
    settledAt: toDateOrNull(data.settledAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function getBookingNetPaidCents(data: Record<string, unknown>): {
  vendorId: string;
  cents: number;
  mode: "live" | "test" | "other";
} {
  const vendorId =
    typeof data.vendorId === "string" && data.vendorId.trim()
      ? data.vendorId.trim()
      : typeof data.stallId === "string"
        ? data.stallId.trim()
        : "";
  const paymentStatus = typeof data.paymentStatus === "string" ? data.paymentStatus.trim().toLowerCase() : "";
  const paymentPaidAt = toDateOrNull(data.paymentPaidAt);
  const rawMode = typeof data.paymentMode === "string" ? data.paymentMode.trim().toLowerCase() : "";
  const mode: "live" | "test" | "other" = rawMode === "live" ? "live" : rawMode === "test" ? "test" : "other";

  if (!vendorId || paymentStatus !== "paid" || !paymentPaidAt || (mode !== "live" && mode !== "test")) {
    return { vendorId, cents: 0, mode };
  }

  let totalCents = Number(data.totalCents);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    const fallbackAmount = Number(data.amount ?? data.totalAmount ?? data.bookingAmount ?? 0);
    totalCents = Number.isFinite(fallbackAmount) && fallbackAmount > 0 ? Math.round(fallbackAmount * 100) : 0;
  } else {
    totalCents = Math.round(totalCents);
  }

  const refundedRaw = Number(data.paymentRefundedCents ?? 0);
  const refundedCents = Number.isFinite(refundedRaw) ? Math.max(0, Math.round(refundedRaw)) : 0;
  const netCents = Math.max(0, Math.min(totalCents, totalCents - refundedCents));
  return { vendorId, cents: netCents, mode };
}

function emptySummary(): VendorEarningsSummary {
  return {
    liveNetSalesCents: 0,
    livePaidOrdersCount: 0,
    testNetSalesCents: 0,
    paidOutCents: 0,
    pendingCents: 0,
    unsettledLiveCents: 0,
    availableToRequestCents: 0,
  };
}

export function summarizeAllVendorsEarnings(
  bookings: BookingHistoryItem[],
  payouts: VendorPayoutLedgerRecord[]
): Map<string, VendorEarningsSummary> {
  const byVendor = new Map<string, VendorEarningsSummary>();
  const ensure = (vendorId: string): VendorEarningsSummary => {
    let entry = byVendor.get(vendorId);
    if (!entry) {
      entry = emptySummary();
      byVendor.set(vendorId, entry);
    }
    return entry;
  };

  for (const record of bookings) {
    const { vendorId, cents, mode } = getBookingNetPaidCents(record.data);
    if (!vendorId || cents <= 0) continue;
    const summary = ensure(vendorId);
    if (mode === "live") {
      summary.liveNetSalesCents += cents;
      summary.livePaidOrdersCount += 1;
    } else if (mode === "test") {
      summary.testNetSalesCents += cents;
    }
  }

  for (const payout of payouts) {
    if (!payout.vendorId || payout.amountCents <= 0) continue;
    const summary = ensure(payout.vendorId);
    if (payout.status === "paid") {
      summary.paidOutCents += payout.amountCents;
    } else if (payout.status === "pending") {
      summary.pendingCents += payout.amountCents;
    }
  }

  for (const summary of byVendor.values()) {
    summary.unsettledLiveCents = Math.max(0, summary.liveNetSalesCents - summary.paidOutCents);
    summary.availableToRequestCents = Math.max(
      0,
      summary.liveNetSalesCents - summary.paidOutCents - summary.pendingCents
    );
  }

  return byVendor;
}

export function summarizeVendorEarnings(
  vendorId: string,
  bookings: BookingHistoryItem[],
  payouts: VendorPayoutLedgerRecord[]
): VendorEarningsSummary {
  return summarizeAllVendorsEarnings(bookings, payouts).get(vendorId) ?? emptySummary();
}

export function parseRmInputToCents(input: string): number | null {
  const parsed = Number(input.trim());
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  if (cents < 100 || cents > 50_000_000) return null;
  return cents;
}

export function validateTransferReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (trimmed.length < 2) return "Enter the bank / DuitNow transfer reference (at least 2 characters).";
  if (trimmed.length > 120) return "Transfer reference must be 120 characters or fewer.";
  return null;
}

export function validateRejectionNote(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length < 2) return "Provide a reason for rejecting this payout request.";
  if (trimmed.length > 240) return "Rejection note must be 240 characters or fewer.";
  return null;
}
