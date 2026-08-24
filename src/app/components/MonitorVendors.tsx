import { useState, useEffect } from "react";
import { Store, AlertTriangle, MapPin, ChevronRight, CheckCircle, Search } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import type { Vendor } from "./types";

type Filter = "All" | "Open" | "Closed";

interface Props {
  onBack: () => void;
  onVendorDetail: (vendor: Vendor) => void;
}

export function MonitorVendors({ onBack, onVendorDetail }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "vendors"), (snapshot) => {
      const v = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          vendorId: doc.id,
          stallName: data.stallName || "Unknown",
          description: data.description || "",
          category: data.category || "Unknown",
          openingHours: data.openingHours || "",
          isOpen: data.isOpen || false,
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          imageUrl: data.imageUrl || "",
        } as Vendor;
      });
      setVendors(v);
    });

    return () => unsubscribe();
  }, []);

  const filtered = vendors.filter((v) => {
    const matchFilter =
      filter === "All" ||
      (filter === "Open" && v.isOpen) ||
      (filter === "Closed" && !v.isOpen);
    const matchSearch =
      search === "" ||
      v.stallName.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const openCount = vendors.filter(v => v.isOpen).length;
  const closedCount = vendors.length - openCount;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6">
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#2D1A0E" }}>Monitor Vendors</h2>
        <p style={{ fontSize: "13px", color: "#9B7B5B", marginTop: "2px" }}>Track vendor activity and stall status</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Vendors", value: vendors.length.toString(), color: "#2D1A0E", bg: "#fff" },
          { label: "Open Now", value: openCount.toString(), color: "#27AE60", bg: "#EAF7EE" },
          { label: "Closed", value: closedCount.toString(), color: "#EB5757", bg: "#FDEADE" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: s.bg, border: "1px solid #EDD9C6" }}>
            <p style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#7A5C2E" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(["All", "Open", "Closed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl active:opacity-80"
              style={{
                background: filter === f ? "#F05A1A" : "#fff",
                color: filter === f ? "#fff" : "#9B7B5B",
                border: filter === f ? "none" : "1px solid #EDD9C6",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#fff", border: "1px solid #EDD9C6", width: "240px" }}>
          <Search size={14} color="#C7A98A" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: "#2D1A0E", width: "100%" }}
          />
        </div>
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((vendor) => (
          <div
            key={vendor.vendorId}
            className="rounded-2xl p-5"
            style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FDF0E8" }}>
                  <Store size={20} color="#F05A1A" />
                </div>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E" }}>{vendor.stallName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} color="#C7A98A" />
                    <span style={{ fontSize: "11px", color: "#C7A98A" }}>
                      {vendor.latitude.toFixed(4)}, {vendor.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: vendor.isOpen ? "#EAF7EE" : "#FDEADE",
                  color: vendor.isOpen ? "#27AE60" : "#EB5757",
                  padding: "3px 10px",
                  borderRadius: "99px",
                  whiteSpace: "nowrap",
                }}
              >
                {vendor.isOpen ? "Open" : "Closed"}
              </span>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
              style={{ background: "#FDF6EE", border: "1px solid #F0E6D8" }}
            >
              {vendor.isOpen ? <CheckCircle size={12} color="#27AE60" /> : <AlertTriangle size={12} color="#EB5757" />}
              <span style={{ fontSize: "12px", color: "#7A5C2E" }}>
                {vendor.category} • {vendor.openingHours || "Hours not set"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onVendorDetail(vendor)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl ml-auto active:opacity-80"
                style={{ background: "#F05A1A", border: "none", cursor: "pointer" }}
              >
                <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Inspect</span>
                <ChevronRight size={13} color="#fff" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
