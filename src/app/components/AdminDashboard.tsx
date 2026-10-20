import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock3,
  Power,
  PowerOff,
  Store,
  Users,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { getRecordCreatedAt } from "../dateUtils";
import { DashboardCharts, type DashboardPeriod, type DashboardVendor } from "./DashboardCharts";

interface Props {
  onMonitorVendors: () => void;
  onManageUsers: () => void;
  previewMode?: boolean;
}

interface DashboardUser {
  id: string;
  name: string;
  role: string;
  isAccountDisabled: boolean;
  createdAt: Date | null;
}

type ListenerStatus = "connecting" | "connected" | "error";

function formatActivityTime(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e9e5dd",
  boxShadow: "0 8px 24px rgba(45, 26, 14, 0.045)",
};

export function AdminDashboard({ onMonitorVendors, onManageUsers, previewMode = false }: Props) {
  const [vendors, setVendors] = useState<DashboardVendor[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [vendorStatus, setVendorStatus] = useState<ListenerStatus>("connecting");
  const [userStatus, setUserStatus] = useState<ListenerStatus>("connecting");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("7d");

  useEffect(() => {
    if (previewMode) return;

    const updateLastSynced = () => setLastSynced(new Date());
    const unsubscribeVendors = onSnapshot(
      collection(db, "vendors"),
      (snapshot) => {
        setVendors(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: String(data.stallName ?? data.name ?? "").trim(),
              category: String(data.category ?? "").trim(),
              openingHours: String(data.openingHours ?? data.hours ?? "").trim(),
              isOpen: data.isOpen === true,
              isAccountDisabled: data.isAccountDisabled === true,
              createdAt: getRecordCreatedAt(data),
            };
          })
        );
        setVendorStatus("connected");
        updateLastSynced();
      },
      (error) => {
        console.error("Error loading dashboard vendors:", error);
        setVendorStatus("error");
      }
    );

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: String(data.fullName ?? data.name ?? data.displayName ?? data.username ?? "User"),
              role: String(data.role ?? data.userRole ?? data.type ?? "customer").toLowerCase(),
              isAccountDisabled: data.isAccountDisabled === true,
              createdAt: getRecordCreatedAt(data),
            };
          })
        );
        setUserStatus("connected");
        updateLastSynced();
      },
      (error) => {
        console.error("Error loading dashboard users:", error);
        setUserStatus("error");
      }
    );

    return () => {
      unsubscribeVendors();
      unsubscribeUsers();
    };
  }, [previewMode]);

  const incompleteVendors = useMemo(
    () => vendors.filter((vendor) => !vendor.name || !vendor.category || !vendor.openingHours),
    [vendors]
  );
  const disabledAccounts =
    vendors.filter((vendor) => vendor.isAccountDisabled).length +
    users.filter((user) => user.isAccountDisabled).length;
  const recentActivity = useMemo(
    () =>
      [
        ...vendors
          .filter((vendor) => vendor.createdAt)
          .map((vendor) => ({
            id: `vendor-${vendor.id}`,
            title: vendor.name || "Unnamed vendor",
            detail: "Vendor listing added",
            createdAt: vendor.createdAt as Date,
            icon: <Store size={16} />,
          })),
        ...users
          .filter((user) => user.createdAt)
          .map((user) => ({
            id: `user-${user.id}`,
            title: user.name,
            detail: `${user.role === "vendor" ? "Vendor" : "User"} account registered`,
            createdAt: user.createdAt as Date,
            icon: <Users size={16} />,
          })),
      ]
        .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
        .slice(0, 6),
    [users, vendors]
  );

  const systemStatus: ListenerStatus =
    vendorStatus === "error" || userStatus === "error"
      ? "error"
      : vendorStatus === "connected" && userStatus === "connected"
        ? "connected"
        : "connecting";
  const statusText = previewMode
    ? "Local preview — live data disabled"
    : systemStatus === "connected"
      ? "Live data connected"
      : systemStatus === "error"
        ? "Some data could not be loaded"
        : "Connecting to live data";

  const summaryCards = [
    { label: "Total vendors", value: vendors.length, color: "#d95316", bg: "#fff0e8", icon: <Store size={19} /> },
    { label: "Open stalls", value: vendors.filter((vendor) => vendor.isOpen).length, color: "#15845b", bg: "#eaf6ef", icon: <Power size={19} /> },
    { label: "Offline stalls", value: vendors.filter((vendor) => !vendor.isOpen).length, color: "#c34b44", bg: "#fff0ed", icon: <PowerOff size={19} /> },
    { label: "Registered users", value: users.length, color: "#785333", bg: "#f4efe7", icon: <Users size={19} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#a17b58" }}>
            StallSeeker overview
          </p>
          <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
            Good morning, Admin
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "#82766a" }}>
            Here’s what’s happening across your platform.
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold"
          style={{
            color: systemStatus === "connected" ? "#14734f" : systemStatus === "error" ? "#b54740" : "#876d4d",
            background: systemStatus === "connected" ? "#eaf6ef" : systemStatus === "error" ? "#fff0ed" : "#f4efe7",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: systemStatus === "connected" ? "#22a06b" : systemStatus === "error" ? "#d05c52" : "#c49b61",
            }}
          />
          {statusText}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="group rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={cardStyle}
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: card.bg, color: card.color }}
              >
                {card.icon}
              </div>
              <p className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>{card.value}</p>
            </div>
            <p className="mt-3 text-sm font-medium" style={{ color: "#82766a" }}>{card.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "#2d241d" }}>Needs your attention</h3>
            <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
              Review listing details and account access.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onMonitorVendors}
            className="flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
            style={{
              background: incompleteVendors.length ? "#fff9ef" : "#f5faf6",
              border: "1px solid #e9e5dd",
              cursor: "pointer",
            }}
          >
            <span className="flex items-center gap-2">
              {incompleteVendors.length
                ? <AlertTriangle size={17} color="#c47a17" />
                : <CheckCircle size={17} color="#22845b" />}
              <span className="text-sm font-medium" style={{ color: "#433a31" }}>
                Listings missing details
              </span>
            </span>
            <strong className="text-lg font-semibold" style={{ color: incompleteVendors.length ? "#b66b12" : "#22845b" }}>
              {incompleteVendors.length}
            </strong>
          </button>
          <button
            type="button"
            onClick={onManageUsers}
            className="flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
            style={{
              background: disabledAccounts ? "#fff9ef" : "#f5faf6",
              border: "1px solid #e9e5dd",
              cursor: "pointer",
            }}
          >
            <span className="flex items-center gap-2">
              {disabledAccounts
                ? <AlertTriangle size={17} color="#c47a17" />
                : <CheckCircle size={17} color="#22845b" />}
              <span className="text-sm font-medium" style={{ color: "#433a31" }}>
                Disabled accounts
              </span>
            </span>
            <strong className="text-lg font-semibold" style={{ color: disabledAccounts ? "#b66b12" : "#22845b" }}>
              {disabledAccounts}
            </strong>
          </button>
        </div>
      </div>

      <DashboardCharts vendors={vendors} period={period} onPeriodChange={setPeriod} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl p-5 sm:p-6 lg:col-span-2" style={cardStyle}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "#2d241d" }}>Recent activity</h3>
              <p className="mt-1 text-xs" style={{ color: "#82766a" }}>Latest accounts and listings</p>
            </div>
          </div>
          {recentActivity.length ? (
            <div className="flex flex-col">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 py-3" style={{ borderTop: "1px solid #f0ede7" }}>
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#fff0e8", color: "#d95316" }}>
                    {activity.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "#433a31" }}>{activity.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "#82766a" }}>{activity.detail}</p>
                  </div>
                  <time className="text-xs" style={{ color: "#948779", whiteSpace: "nowrap" }}>
                    {formatActivityTime(activity.createdAt)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-3 text-sm" style={{ color: "#82766a" }}>
              No recent records with a creation date are available.
            </p>
          )}
        </div>

        <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
          <h3 className="text-base font-semibold" style={{ color: "#2d241d" }}>Quick actions</h3>
          <p className="mt-1 text-xs" style={{ color: "#82766a" }}>Jump to a workspace</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onMonitorVendors}
              className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left transition hover:brightness-95 active:scale-[0.99]"
              style={{ background: "#d95316", border: "none", cursor: "pointer" }}
            >
              <Store size={16} color="#fff" />
              <span className="text-sm font-semibold" style={{ color: "#fff" }}>Manage vendors</span>
            </button>
            <button
              type="button"
              onClick={onManageUsers}
              className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left transition hover:bg-[#faf8f4] active:scale-[0.99]"
              style={{ background: "#fff", border: "1px solid #e9e5dd", cursor: "pointer" }}
            >
              <Users size={16} color="#d95316" />
              <span className="text-sm font-semibold" style={{ color: "#433a31" }}>Manage users</span>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: systemStatus === "connected" ? "#eaf6ef" : systemStatus === "error" ? "#fff0ed" : "#f4efe7" }}
          >
            {systemStatus === "connected"
              ? <CheckCircle size={18} color="#22845b" />
              : systemStatus === "error"
                ? <AlertTriangle size={18} color="#c34b44" />
                : <Clock3 size={18} color="#876d4d" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "#2d241d" }}>System status</h3>
            <p className="mt-0.5 text-sm font-medium" style={{ color: systemStatus === "error" ? "#c34b44" : "#433a31" }}>
              {statusText}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "#82766a" }}>
              {previewMode
                ? "Firebase data is not loaded in local preview mode."
                : <>Vendors: {vendorStatus} · Users: {userStatus}{lastSynced ? ` · Last data received ${formatActivityTime(lastSynced)}` : ""}</>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
