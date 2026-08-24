import { ArrowLeft, AlertTriangle, X, CheckCircle, Store, RefreshCw } from "lucide-react";
import type { AdminAction, Vendor } from "./types";

interface Props {
  action: AdminAction;
  vendor: Vendor;
  onCancel: () => void;
  onConfirm: () => void;
}

const CONFIG = {
  suspend: {
    title: "Suspend vendor?",
    description: "This will hide the stall from customer search and live map until the admin reactivates it.",
    confirmLabel: "Confirm Suspension",
    confirmBg: "#EB5757",
    icon: <AlertTriangle size={32} color="#EB5757" />,
    iconBg: "#FDEADE",
    bannerColor: "#EB5757",
    bannerBg: "#FDEADE",
    bannerText: "You are about to suspend a vendor — this will affect customer visibility.",
  },
  reactivate: {
    title: "Reactivate vendor?",
    description: "This will make the stall visible again on customer search and the live map.",
    confirmLabel: "Confirm Reactivation",
    confirmBg: "#27AE60",
    icon: <RefreshCw size={32} color="#27AE60" />,
    iconBg: "#EAF7EE",
    bannerColor: "#27AE60",
    bannerBg: "#EAF7EE",
    bannerText: "You are about to reactivate a vendor — the stall will become visible to customers.",
  },
};

export function ActionConfirmation({ action, vendor, onCancel, onConfirm }: Props) {
  const cfg = CONFIG[action];

  return (
    <div className="p-8 flex items-start justify-center">
      <div className="w-full max-w-lg">
        {/* Breadcrumb */}
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 mb-6 active:opacity-70"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={16} color="#F05A1A" />
          <span style={{ fontSize: "13px", color: "#F05A1A", fontWeight: 600 }}>Back to Vendor Detail</span>
        </button>

        {/* Confirmation Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}
        >
          {/* Warning banner */}
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ background: cfg.bannerBg, borderBottom: "1px solid #EDD9C6" }}
          >
            <AlertTriangle size={18} color={cfg.bannerColor} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: cfg.bannerColor }}>
              {cfg.bannerText}
            </span>
          </div>

          <div className="p-7">
            {/* Icon + Title */}
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: cfg.iconBg }}
              >
                {cfg.icon}
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#2D1A0E" }}>{cfg.title}</h2>
              <p style={{ fontSize: "14px", color: "#7A5C2E", marginTop: "8px", lineHeight: "1.6", maxWidth: "360px" }}>
                {cfg.description}
              </p>
            </div>

            {/* Vendor info */}
            <div
              className="flex items-center gap-4 px-5 py-4 rounded-2xl mb-6"
              style={{ background: "#FDF6EE", border: "1px solid #EDD9C6" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#FDF0E8" }}
              >
                <Store size={18} color="#F05A1A" />
              </div>
              <div>
                <p style={{ fontSize: "11px", color: "#C7A98A" }}>Vendor</p>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E" }}>{vendor.stallName}</p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: vendor.isOpen ? "#EAF7EE" : "#FDEADE",
                  color: vendor.isOpen ? "#27AE60" : "#EB5757",
                  padding: "3px 10px",
                  borderRadius: "99px",
                  marginLeft: "auto",
                }}
              >
                {vendor.isOpen ? "Open" : "Closed"}
              </span>
            </div>

            {/* Note */}
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl mb-7"
              style={{ background: "#FEF9E7", border: "1px solid #F2C97A" }}
            >
              <AlertTriangle size={14} color="#F2994A" className="flex-shrink-0 mt-0.5" />
              <p style={{ fontSize: "12px", color: "#7A5C2E", lineHeight: "1.6" }}>
                The vendor will be notified via email and in-app message once this action is confirmed.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-80"
                style={{ background: "#fff", border: "1px solid #EDD9C6", cursor: "pointer" }}
              >
                <X size={16} color="#9B7B5B" />
                <span style={{ color: "#9B7B5B", fontSize: "14px", fontWeight: 600 }}>Cancel</span>
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-80"
                style={{ background: cfg.confirmBg, border: "none", cursor: "pointer" }}
              >
                <CheckCircle size={16} color="#fff" />
                <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{cfg.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
