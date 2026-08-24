import { useState } from "react";
import { LayoutDashboard, Store, Bell, ChevronDown } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";
import { MonitorVendors } from "./components/MonitorVendors";
import { VendorDetail } from "./components/VendorDetail";
import { ActionConfirmation } from "./components/ActionConfirmation";
import type { Vendor, AdminAction } from "./components/types";

type Screen =
  | "dashboard"
  | "vendors"
  | "vendor-detail"
  | "action-confirm";

type NavTab = "dashboard" | "vendors";

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [pendingAction, setPendingAction] = useState<AdminAction>("suspend");

  const navigate = (s: Screen, tab?: NavTab) => {
    setScreen(s);
    if (tab) setActiveTab(tab);
  };

  const handleTabPress = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === "dashboard") setScreen("dashboard");
    if (tab === "vendors") setScreen("vendors");
  };

  const handleVendorDetail = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    navigate("vendor-detail", "vendors");
  };

  const handleAdminAction = (action: AdminAction) => {
    setPendingAction(action);
    navigate("action-confirm");
  };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <AdminDashboard
            onMonitorVendors={() => navigate("vendors", "vendors")}
          />
        );
      case "vendors":
        return (
          <MonitorVendors
            onBack={() => navigate("dashboard", "dashboard")}
            onVendorDetail={handleVendorDetail}
          />
        );
      case "vendor-detail":
        if (!selectedVendor) return null;
        return (
          <VendorDetail
            vendor={selectedVendor}
            onBack={() => navigate("vendors", "vendors")}
            onSuspend={() => handleAdminAction("suspend")}
            onReactivate={() => handleAdminAction("reactivate")}
          />
        );
      case "action-confirm":
        if (!selectedVendor) return null;
        return (
          <ActionConfirmation
            action={pendingAction}
            vendor={selectedVendor}
            onCancel={() => navigate("vendor-detail", "vendors")}
            onConfirm={() => navigate("vendors", "vendors")}
          />
        );
    }
  };

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { tab: "vendors", label: "Vendors", icon: <Store size={18} /> },
  ];

  const pageTitle: Record<Screen, string> = {
    dashboard: "Admin Dashboard",
    vendors: "Monitor Vendors",
    "vendor-detail": "Vendor Detail",
    "action-confirm": "Confirm Action",
  };

  return (
    <div className="flex h-full w-full" style={{ background: "#F5EDE3", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0"
        style={{
          width: "240px",
          background: "#fff",
          borderRight: "1px solid #EDD9C6",
          height: "100%",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-5" style={{ borderBottom: "1px solid #EDD9C6" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#F05A1A" }}
          >
            <Store size={16} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E", lineHeight: 1.2 }}>StallSeeker</p>
            <p style={{ fontSize: "10px", color: "#C7A98A", fontWeight: 500 }}>Admin Panel</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#C7A98A", letterSpacing: "0.08em", marginBottom: "6px", paddingLeft: "12px" }}>
            MAIN MENU
          </p>
          {navItems.map(({ tab, label, icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabPress(tab)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all active:scale-[0.98]"
                style={{
                  background: isActive ? "#FDF0E8" : "transparent",
                  color: isActive ? "#F05A1A" : "#7A5C2E",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: isActive ? "#F05A1A" : "#C7A98A" }}>{icon}</span>
                {label}
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: "#F05A1A" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin Profile */}
        <div
          className="flex items-center gap-3 px-4 py-4 mx-3 mb-4 rounded-2xl"
          style={{ background: "#FDF0E8", border: "1px solid #EDD9C6" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#F05A1A" }}
          >
            <span style={{ color: "#fff", fontSize: "14px", fontWeight: 700 }}>A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#2D1A0E" }}>Admin</p>
            <p style={{ fontSize: "11px", color: "#C7A98A" }}>Super Admin</p>
          </div>
          <ChevronDown size={14} color="#C7A98A" />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Top Bar */}
        <header
          className="flex items-center justify-between px-8 flex-shrink-0"
          style={{
            height: "64px",
            background: "#fff",
            borderBottom: "1px solid #EDD9C6",
          }}
        >
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#2D1A0E", lineHeight: 1.2 }}>
              {pageTitle[screen]}
            </h1>
            <p style={{ fontSize: "12px", color: "#C7A98A", fontWeight: 400 }}>StallSeeker Admin Panel</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative w-9 h-9 rounded-full flex items-center justify-center active:opacity-70"
              style={{ background: "#FDF0E8", border: "1px solid #EDD9C6" }}
            >
              <Bell size={16} color="#F05A1A" />
            </button>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: "#FDF0E8", border: "1px solid #EDD9C6" }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#F05A1A" }}
              >
                <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>A</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#2D1A0E" }}>Admin</span>
              <ChevronDown size={13} color="#C7A98A" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#F5EDE3" }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
