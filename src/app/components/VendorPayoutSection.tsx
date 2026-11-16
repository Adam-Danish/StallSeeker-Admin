import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Landmark, Copy, Check, Send, AlertTriangle } from "lucide-react";
import { db } from "../../firebase";
import { getBookingHistory, type BookingHistoryItem } from "../bookingHistoryApi";
import {
  formatRmFromCents,
  parsePayoutDetailsDoc,
  parsePayoutLedgerDoc,
  summarizeVendorEarnings,
  type VendorPayoutDetailsRecord,
  type VendorPayoutLedgerRecord,
} from "../payoutUtils";
import { PayoutActionDialogs, type PayoutModalState } from "./PayoutActionDialogs";

interface VendorPayoutSectionProps {
  vendorId: string;
  stallName: string;
}

export const VendorPayoutSection: React.FC<VendorPayoutSectionProps> = ({
  vendorId,
  stallName,
}) => {
  const [bankDetails, setBankDetails] = useState<VendorPayoutDetailsRecord | null>(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [payouts, setPayouts] = useState<VendorPayoutLedgerRecord[]>([]);
  const [bookings, setBookings] = useState<BookingHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [modal, setModal] = useState<PayoutModalState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    setDetailsLoaded(false);
    setLoadError(null);

    const unsubDetails = onSnapshot(
      doc(db, "vendorPayoutDetails", vendorId),
      (snapshot) => {
        setBankDetails(
          snapshot.exists()
            ? parsePayoutDetailsDoc(snapshot.id, snapshot.data() as Record<string, unknown>)
            : null
        );
        setDetailsLoaded(true);
      },
      (error) => {
        console.error("Unable to load vendor bank details:", error);
        setDetailsLoaded(true);
        setLoadError("Bank details could not be loaded.");
      }
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "vendorPayouts"), where("vendorId", "==", vendorId)),
      (snapshot) => {
        const items = snapshot.docs.map((d) =>
          parsePayoutLedgerDoc(d.id, d.data() as Record<string, unknown>)
        );
        items.sort((a, b) => {
          const aTime = (a.settledAt ?? a.requestedAt ?? a.updatedAt)?.getTime() ?? 0;
          const bTime = (b.settledAt ?? b.requestedAt ?? b.updatedAt)?.getTime() ?? 0;
          return bTime - aTime;
        });
        setPayouts(items);
      },
      (error) => {
        console.error("Unable to load vendor payout history:", error);
        setLoadError("Payout history could not be loaded.");
      }
    );

    let active = true;
    const controller = new AbortController();
    getBookingHistory({ signal: controller.signal })
      .then((records) => {
        if (active) setBookings(records);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Unable to load booking totals for vendor:", error);
        }
      });

    return () => {
      active = false;
      controller.abort();
      unsubDetails();
      unsubPayouts();
    };
  }, [vendorId]);

  const summary = useMemo(
    () => summarizeVendorEarnings(vendorId, bookings, payouts),
    [vendorId, bookings, payouts]
  );

  const pendingPayouts = payouts.filter((p) => p.status === "pending");

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField((current) => (current === key ? null : current)), 1800);
    } catch {
      setLoadError("Unable to copy to clipboard. Copy the number manually.");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #EDD9C6", padding: "24px", marginBottom: "24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "#FDF0E8", padding: "8px", borderRadius: "8px", color: "#F05A1A" }}>
            <Landmark size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#2D1A0E" }}>Bank Details &amp; Payouts</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#C7A98A" }}>
              Where to transfer this vendor&apos;s Stripe earnings
            </p>
          </div>
        </div>
        {bankDetails && (
          <button
            type="button"
            onClick={() =>
              setModal({
                kind: "direct",
                vendorId,
                stallName,
                bankDetails,
                defaultCents: summary.unsettledLiveCents,
              })
            }
            style={{
              background: "#F05A1A",
              color: "#fff",
              border: "none",
              padding: "9px 14px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Send size={14} /> Record Bank Transfer
          </button>
        )}
      </div>

      {loadError && (
        <p role="alert" style={{ color: "#B42318", fontSize: "13px", margin: "0 0 12px" }}>{loadError}</p>
      )}
      {feedback && (
        <p role="status" style={{ color: "#22845b", background: "#eaf6ef", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", margin: "0 0 12px" }}>
          {feedback}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "#FDF0E8", padding: "12px 14px", borderRadius: "10px", border: "1px solid #EDD9C6" }}>
          <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#7A5C2E", fontWeight: 600 }}>LIVE PAID SALES</p>
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#2D1A0E" }}>
            {formatRmFromCents(summary.liveNetSalesCents)}
          </p>
        </div>
        <div style={{ background: "#FDF0E8", padding: "12px 14px", borderRadius: "10px", border: "1px solid #EDD9C6" }}>
          <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#7A5C2E", fontWeight: 600 }}>PAID OUT</p>
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#2E7D32" }}>
            {formatRmFromCents(summary.paidOutCents)}
          </p>
        </div>
        <div style={{ background: "#FDF0E8", padding: "12px 14px", borderRadius: "10px", border: "1px solid #EDD9C6" }}>
          <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#7A5C2E", fontWeight: 600 }}>PENDING REQUESTS</p>
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#946000" }}>
            {formatRmFromCents(summary.pendingCents)}
          </p>
        </div>
        <div style={{ background: "#FDF0E8", padding: "12px 14px", borderRadius: "10px", border: "1px solid #EDD9C6" }}>
          <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#7A5C2E", fontWeight: 600 }}>BALANCE OWED</p>
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#F05A1A" }}>
            {formatRmFromCents(summary.unsettledLiveCents)}
          </p>
        </div>
      </div>

      {summary.testNetSalesCents > 0 && (
        <p style={{ fontSize: "12px", color: "#82766a", margin: "0 0 14px" }}>
          Note: Vendor also has {formatRmFromCents(summary.testNetSalesCents)} in Stripe Test mode orders (excluded from transferable balance).
        </p>
      )}

      {!detailsLoaded ? (
        <p style={{ fontSize: "13px", color: "#82766a" }}>Loading bank details…</p>
      ) : !bankDetails ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "10px", background: "#fff9ef", border: "1px solid #EDD9C6" }}>
          <AlertTriangle size={18} color="#c47a17" />
          <p style={{ margin: 0, fontSize: "13px", color: "#7A5C2E" }}>
            This vendor has not submitted their payout bank details in the StallSeeker app yet.
          </p>
        </div>
      ) : (
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid #EDD9C6", background: "#faf8f4" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "12px" }}>
            <BankDetailField label="BANK NAME" value={bankDetails.bankName} />
            <BankDetailField label="ACCOUNT HOLDER" value={bankDetails.accountHolderName} />
            <BankDetailField
              label="ACCOUNT NUMBER"
              value={bankDetails.accountNumber}
              monospace
              copied={copiedField === "account"}
              copyAriaLabel="Copy bank account number"
              onCopy={() => void copyValue("account", bankDetails.accountNumber)}
            />
            {bankDetails.duitNowId && (
              <BankDetailField
                label="DUITNOW ID"
                value={bankDetails.duitNowId}
                monospace
                copied={copiedField === "duitnow"}
                copyAriaLabel="Copy DuitNow ID"
                onCopy={() => void copyValue("duitnow", bankDetails.duitNowId)}
              />
            )}
          </div>
          {bankDetails.notes && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#7A5C2E" }}>
              Vendor note: {bankDetails.notes}
            </p>
          )}
        </div>
      )}

      {pendingPayouts.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "#2D1A0E" }}>
            Pending Payout Requests ({pendingPayouts.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingPayouts.map((req) => (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #EDD9C6",
                  background: "#fff9ef",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#2D1A0E", fontSize: "14px" }}>
                    {formatRmFromCents(req.amountCents)} — {req.bankName} ({req.accountNumber})
                  </div>
                  <div style={{ fontSize: "12px", color: "#7A5C2E" }}>
                    Holder: {req.accountHolderName}
                    {req.requestedAt ? ` • Requested ${req.requestedAt.toLocaleString()}` : ""}
                    {req.vendorNote ? ` • Note: ${req.vendorNote}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "settle", record: req })}
                    style={{ background: "#22845b", color: "#fff", border: "none", padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Mark Transferred
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "reject", record: req })}
                    style={{ background: "#fff", color: "#B42318", border: "1px solid #f2d1cb", padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PayoutActionDialogs
        modal={modal}
        onClose={() => setModal(null)}
        onSuccess={(message) => setFeedback(message)}
      />
    </div>
  );
};

interface BankDetailFieldProps {
  label: string;
  value: string;
  monospace?: boolean;
  copied?: boolean;
  copyAriaLabel?: string;
  onCopy?: () => void;
}

function BankDetailField({
  label,
  value,
  monospace = false,
  copied = false,
  copyAriaLabel,
  onCopy,
}: BankDetailFieldProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #EDD9C6",
        background: "#fff",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 3px",
            fontSize: "11px",
            color: "#7A5C2E",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 700,
            color: "#2D1A0E",
            fontFamily: monospace ? "monospace" : undefined,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copyAriaLabel ?? `Copy ${label.toLowerCase()}`}
          style={{
            minHeight: "34px",
            flexShrink: 0,
            whiteSpace: "nowrap",
            border: "1px solid #EDD9C6",
            background: "#faf8f4",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#433a31",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {copied ? <Check size={13} color="#22845b" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
