import { useState } from "react";
import { Store, AlertTriangle, MapPin, ChevronRight, CheckCircle, Search, Phone, RefreshCw } from "lucide-react";
import type { Vendor } from "./types";
import { CursorRecordPagination, RecordSortSelect } from "./RecordPagination";
import type { RecordSort } from "../useRecordPagination";
import { useAdminDirectoryPage } from "../useAdminDirectoryPage";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Filter = "All" | "Open" | "Closed";

interface Props {
  onBack: () => void;
  onVendorDetail: (vendor: Vendor) => void;
  onEditListing?: (vendor: Vendor) => void;
  onDeleteListing?: (id: string) => Promise<void>;
}

function VendorProfileImage({ vendor }: { vendor: Vendor }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = vendor.profileImageUrl || vendor.imageUrl || "";

  if (!imageUrl || failed) {
    return (
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "#FDF0E8" }}
        aria-label={imageUrl ? "Vendor profile image unavailable" : "No vendor profile image"}
        role="img"
      >
        <Store size={20} color="#F05A1A" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${vendor.stallName || vendor.name || "Vendor"} profile`}
      onError={() => setFailed(true)}
      className="w-11 h-11 rounded-xl flex-shrink-0 object-cover"
    />
  );
}

export function MonitorVendors({ onVendorDetail }: Props) {
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RecordSort>("newest");
  const [category, setCategory] = useState("All");
  const pagination = useAdminDirectoryPage<Vendor>({ kind: "vendor", status: filter, search, sort, category });
  const total = pagination.summary?.listings;
  const openCount = pagination.summary?.open;
  const closedCount = total === undefined || openCount === undefined ? undefined : total - openCount;
  const categories = Array.from(new Set(["All", category, ...(pagination.summary?.categories ?? [])]));

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#2D1A0E" }}>Monitor vendors</h2>
        <p style={{ fontSize: "13px", color: "#9B7B5B", marginTop: "2px" }}>
          Track vendor activity and stall status
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
        {[
          { label: "Total Vendors", value: total?.toString() ?? "—", color: "#2D1A0E", bg: "#fff" },
          { label: "Open Now", value: openCount?.toString() ?? "—", color: "#27AE60", bg: "#EAF7EE" },
          { label: "Closed", value: closedCount?.toString() ?? "—", color: "#EB5757", bg: "#FDEADE" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: s.bg, border: "1px solid #EDD9C6" }}>
            <p style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#7A5C2E" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-vendor-toolbar mb-4" role="group" aria-label="Vendor filters">
        <div className="admin-vendor-status" role="group" aria-label="Vendor status">
          {(["All", "Open", "Closed"] as Filter[]).map((f) => (
            <Button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              aria-pressed={filter === f}
              className="h-11"
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="admin-vendor-search">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search vendors" placeholder="Name, category or phone..." maxLength={200}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <select aria-label="Filter vendors by category" value={category} onChange={(event) => setCategory(event.target.value)} className="admin-vendor-category h-11 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
          {categories.map((value) => <option key={value} value={value}>{value === "All" ? "All categories" : value}</option>)}
        </select>
        <div className="admin-vendor-actions">
          <Button type="button" variant="outline" className="h-11" onClick={pagination.refresh} disabled={pagination.loading}>
            <RefreshCw aria-hidden="true" /> Refresh
          </Button>
          <RecordSortSelect label="vendors" value={sort} onChange={setSort} />
        </div>
      </div>

      {pagination.error && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-destructive">{pagination.error}<Button type="button" variant="outline" onClick={pagination.refresh}>Retry</Button></div>}
      {pagination.liveNotice && <p role="status" className="mb-4 text-sm text-muted-foreground">{pagination.liveNotice}</p>}
      {/* Vendor Cards Grid */}
      <div className="admin-vendor-grid" aria-busy={pagination.loading}>
        {pagination.items.map((vendor) => (
          <div
            key={vendor.vendorId}
            className="rounded-2xl p-5"
            style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex min-w-0 items-center gap-3">
                <VendorProfileImage vendor={vendor} />
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E" }}>{vendor.stallName || vendor.name || "Vendor"}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} color="#C7A98A" />
                    <span style={{ fontSize: "11px", color: "#C7A98A" }}>
                      {(vendor.latitude ?? vendor.lat)?.toFixed(4) ?? "—"}, {(vendor.longitude ?? vendor.lng)?.toFixed(4) ?? "—"}
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

            <div className="mb-4 flex items-center gap-2" style={{ color: "#7A5C2E", fontSize: "13px" }}>
              <Phone size={14} color="#C7A98A" aria-hidden="true" />
              {vendor.phoneNumber ? (
                <a href={`tel:${vendor.phoneNumber}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {vendor.phoneNumber}
                </a>
              ) : (
                <span style={{ color: "#9B7B5B" }}>Phone not provided</span>
              )}
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
      {pagination.loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading vendors…</p>}
      {!pagination.loading && !pagination.error && !pagination.items.length && <p className="py-8 text-center text-sm text-muted-foreground">{pagination.hasNext ? "No matches on this page. Select Next to keep searching." : "No vendors match these filters."}</p>}
      <CursorRecordPagination label="vendors" count={pagination.items.length} {...pagination} />
    </div>
  );
}
