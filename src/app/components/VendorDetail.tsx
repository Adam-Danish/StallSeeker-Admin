import { ArrowLeft, Store, MapPin, Power, Clock, Utensils } from "lucide-react";
import type { Vendor } from "./types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

interface Props {
  vendor: Vendor;
  onBack: () => void;
  onSuspend?: () => void;
  onReactivate?: () => void;
}

export function VendorDetail({ vendor, onBack }: Props) {
  const isOffline = !vendor.isOpen;

  const toggleStatus = async (isOpen: boolean) => {
    try {
      await updateDoc(doc(db, "vendors", vendor.vendorId), {
        isOpen: isOpen,
      });
    } catch (e) {
      console.error("Error updating status:", e);
      alert("Failed to update status. Check console.");
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-6 active:opacity-70"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <ArrowLeft size={16} color="#F05A1A" />
        <span style={{ fontSize: "13px", color: "#F05A1A", fontWeight: 600 }}>Back to Monitor Vendors</span>
      </button>

      {/* Vendor Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#FDF0E8", border: "1px solid #EDD9C6" }}
          >
            {vendor.imageUrl ? (
              <img src={vendor.imageUrl} alt={vendor.stallName} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <Store size={30} color="#F05A1A" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#2D1A0E" }}>{vendor.stallName}</h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: vendor.isOpen ? "#EAF7EE" : "#FDEADE",
                  color: vendor.isOpen ? "#27AE60" : "#EB5757",
                  padding: "3px 10px",
                  borderRadius: "99px",
                }}
              >
                {vendor.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} color="#C7A98A" />
              <span style={{ fontSize: "13px", color: "#9B7B5B" }}>
                {vendor.latitude.toFixed(4)}, {vendor.longitude.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
        {/* Admin Controls */}
        <div className="flex items-center gap-3">
          {isOffline ? (
            <button
              onClick={() => toggleStatus(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl active:opacity-80"
              style={{ background: "#27AE60", border: "none", cursor: "pointer" }}
            >
              <Power size={15} color="#fff" />
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Mark as Open</span>
            </button>
          ) : (
            <button
              onClick={() => toggleStatus(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl active:opacity-80"
              style={{ background: "#EB5757", border: "none", cursor: "pointer" }}
            >
              <Power size={15} color="#fff" />
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Mark as Closed</span>
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Left */}
        <div className="flex flex-col gap-5">
          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                icon: <Power size={18} color={isOffline ? "#EB5757" : "#27AE60"} />,
                bg: isOffline ? "#FDEADE" : "#EAF7EE",
                label: "Current Status",
                value: vendor.isOpen ? "Open" : "Closed",
                color: isOffline ? "#EB5757" : "#27AE60",
              },
              {
                icon: <Utensils size={18} color="#F05A1A" />,
                bg: "#FDF0E8",
                label: "Category",
                value: vendor.category || "Uncategorized",
                color: "#F05A1A",
              },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #EDD9C6" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <p style={{ fontSize: "22px", fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: "12px", color: "#9B7B5B", marginTop: "2px" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
             <p style={{ fontSize: "12px", fontWeight: 700, color: "#C7A98A", letterSpacing: "0.08em", marginBottom: "14px" }}>
                ABOUT THIS VENDOR
             </p>
             <p style={{ fontSize: "14px", color: "#7A5C2E", lineHeight: "1.6" }}>
               {vendor.description || "No description provided."}
             </p>
          </div>
        </div>

        {/* Right: Vendor Details Sidebar */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#C7A98A", letterSpacing: "0.08em", marginBottom: "14px" }}>VENDOR DETAILS</p>
            <div className="flex flex-col gap-4">
              {[
                { icon: <MapPin size={14} color="#F05A1A" />, bg: "#FDF0E8", label: "Coordinates", value: `${vendor.latitude.toFixed(3)}, ${vendor.longitude.toFixed(3)}`, color: "#2D1A0E" },
                {
                  icon: <Power size={14} color={isOffline ? "#EB5757" : "#27AE60"} />,
                  bg: isOffline ? "#FDEADE" : "#EAF7EE",
                  label: "Current Status",
                  value: vendor.isOpen ? "Open" : "Closed",
                  color: isOffline ? "#EB5757" : "#27AE60",
                },
                { icon: <Clock size={14} color="#9B7B5B" />, bg: "#F0E6D8", label: "Opening Hours", value: vendor.openingHours || "Not specified", color: "#2D1A0E" },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: d.bg }}>
                    {d.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: "#C7A98A" }}>{d.label}</p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: d.color }}>{d.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
