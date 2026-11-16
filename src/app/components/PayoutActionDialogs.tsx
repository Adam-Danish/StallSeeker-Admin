import React, { useEffect, useState } from "react";
import {
  recordDirectVendorPayout,
  rejectPayoutRequest,
  settlePayoutRequest,
} from "../payoutActions";
import {
  formatRmFromCents,
  parseRmInputToCents,
  type VendorPayoutDetailsRecord,
  type VendorPayoutLedgerRecord,
} from "../payoutUtils";

export type PayoutModalState =
  | { kind: "settle"; record: VendorPayoutLedgerRecord }
  | { kind: "reject"; record: VendorPayoutLedgerRecord }
  | {
      kind: "direct";
      vendorId: string;
      stallName: string;
      bankDetails: VendorPayoutDetailsRecord;
      defaultCents: number;
    };

interface PayoutActionDialogsProps {
  modal: PayoutModalState | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const PayoutActionDialogs: React.FC<PayoutActionDialogsProps> = ({
  modal,
  onClose,
  onSuccess,
}) => {
  const [amountInput, setAmountInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modal) return;
    setError(null);
    setSubmitting(false);
    setReferenceInput("");
    setNoteInput("");
    if (modal.kind === "direct") {
      setAmountInput(modal.defaultCents >= 100 ? (modal.defaultCents / 100).toFixed(2) : "");
    }
  }, [modal]);

  if (!modal) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (modal.kind === "settle") {
        await settlePayoutRequest({
          payoutId: modal.record.id,
          transferReference: referenceInput,
          adminNote: noteInput,
        });
        onSuccess(`Marked ${formatRmFromCents(modal.record.amountCents)} as transferred.`);
      } else if (modal.kind === "reject") {
        await rejectPayoutRequest({
          payoutId: modal.record.id,
          adminNote: noteInput,
        });
        onSuccess("Payout request rejected.");
      } else {
        const cents = parseRmInputToCents(amountInput);
        if (cents === null) {
          throw new Error("Enter a valid payout amount between RM 1.00 and RM 500,000.00.");
        }
        await recordDirectVendorPayout({
          vendorId: modal.vendorId,
          stallName: modal.stallName,
          bankDetails: modal.bankDetails,
          amountCents: cents,
          transferReference: referenceInput,
          adminNote: noteInput,
        });
        onSuccess(`Recorded ${formatRmFromCents(cents)} bank transfer for ${modal.stallName || modal.vendorId}.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payout update. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    modal.kind === "settle"
      ? "Mark Payout as Transferred"
      : modal.kind === "reject"
        ? "Reject Payout Request"
        : "Record Bank Transfer";

  const confirmLabel =
    modal.kind === "settle"
      ? "Confirm Transfer"
      : modal.kind === "reject"
        ? "Reject Request"
        : "Record Transfer";

  const confirmBg =
    modal.kind === "settle" ? "#22845b" : modal.kind === "reject" ? "#B42318" : "#F05A1A";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 60,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "24px",
          width: "100%",
          maxWidth: "460px",
          border: "1px solid #EDD9C6",
        }}
      >
        <h4 style={{ margin: "0 0 8px", fontSize: "17px", color: "#2D1A0E" }}>{title}</h4>

        {modal.kind === "direct" ? (
          <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#7A5C2E" }}>
            Transferring to <strong>{modal.bankDetails.bankName}</strong> ({modal.bankDetails.accountNumber}) —{" "}
            {modal.bankDetails.accountHolderName}
          </p>
        ) : (
          <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#7A5C2E" }}>
            {formatRmFromCents(modal.record.amountCents)} • {modal.record.bankName} ({modal.record.accountNumber}) —{" "}
            {modal.record.accountHolderName}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "#B42318", fontSize: "12px", margin: "0 0 10px" }}>
            {error}
          </p>
        )}

        {modal.kind === "direct" && (
          <>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#7A5C2E", marginBottom: "4px" }}>
              Amount Transferred (RM) *
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="e.g. 50.00"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #EDD9C6",
                marginBottom: "12px",
                fontSize: "13px",
              }}
            />
          </>
        )}

        {modal.kind !== "reject" && (
          <>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#7A5C2E", marginBottom: "4px" }}>
              Bank / DuitNow Reference ID *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="e.g. MBB-FT20261116-001"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #EDD9C6",
                marginBottom: "12px",
                fontSize: "13px",
              }}
            />
          </>
        )}

        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#7A5C2E", marginBottom: "4px" }}>
          {modal.kind === "reject" ? "Reason for Vendor *" : "Admin Note (Optional)"}
        </label>
        <textarea
          required={modal.kind === "reject"}
          maxLength={240}
          rows={modal.kind === "reject" ? 3 : 2}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder={
            modal.kind === "reject"
              ? "e.g. Bank account number mismatch or exceeds settled sales"
              : "e.g. Daily payout settlement"
          }
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #EDD9C6",
            marginBottom: "16px",
            fontSize: "13px",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #EDD9C6",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: confirmBg,
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {submitting ? "Saving…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
