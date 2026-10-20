import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Power, PowerOff, Store, Users } from "lucide-react";
import { DashboardCharts, getCategoryLabel, type DashboardPeriod, type DashboardVendor } from "./DashboardCharts";

interface Props {
  vendors: DashboardVendor[];
  registeredUsers: number;
  disabledUserCount: number;
  registrationDateError?: string | null;
  onManageVendors: () => void;
  onManageUsers: () => void;
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e9e5dd",
  borderRadius: "18px",
  boxShadow: "0 8px 24px rgba(45, 26, 14, 0.045)",
};

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function getPeriodStart(period: DashboardPeriod, now: Date): Date | null {
  if (period === "all") return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "7d") start.setDate(start.getDate() - 6);
  if (period === "30d") start.setDate(start.getDate() - 29);
  return start;
}

export function AnalyticsPage({
  vendors,
  registeredUsers,
  disabledUserCount,
  registrationDateError = null,
  onManageVendors,
  onManageUsers,
}: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const now = new Date();
  const periodStart = getPeriodStart(period, now);
  const periodVendors = useMemo(
    () => vendors.filter((vendor) =>
      periodStart === null ||
      (vendor.createdAt !== null && vendor.createdAt >= periodStart && vendor.createdAt <= now)
    ),
    [vendors, periodStart?.getTime(), now.getTime()]
  );
  const datedListingsInPeriod = periodVendors.filter(
    (vendor) => vendor.createdAt !== null && vendor.createdAt <= now
  ).length;
  const openVendors = vendors.filter((vendor) => vendor.isOpen).length;
  const offlineVendors = vendors.length - openVendors;
  const disabledAccounts =
    disabledUserCount + vendors.filter((vendor) => vendor.isAccountDisabled).length;
  const incompleteVendors = vendors.filter(
    (vendor) => !vendor.name || !vendor.category || !vendor.openingHours
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    vendors.forEach((vendor) => {
      const category = getCategoryLabel(vendor.category);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return Array.from(counts, ([category, count]) => ({ category, count }))
      .sort((first, second) => second.count - first.count);
  }, [vendors]);
  const totalCategorizedVendors = categories.reduce((total, category) => total + category.count, 0);
  const summaryCards = [
    { label: "Total vendors", value: vendors.length, icon: <Store size={18} />, color: "#d95316", background: "#fff0e8" },
    { label: "Open stalls", value: openVendors, icon: <Power size={18} />, color: "#22845b", background: "#eaf6ef" },
    { label: "Registered users", value: registeredUsers, icon: <Users size={18} />, color: "#785333", background: "#f4efe7" },
    { label: `Listings · ${periodOptions.find((option) => option.value === period)?.label}`, value: datedListingsInPeriod, icon: <Store size={18} />, color: "#9b5f26", background: "#fbf3e8" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#a17b58" }}>
            Platform insights
          </p>
          <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>
            Analytics
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "#82766a" }}>
            Track marketplace listings, availability, and category mix.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "#f1eee8", border: "1px solid #e9e5dd" }} aria-label="Filter analytics by date range">
          {periodOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
              className="rounded-lg px-3 py-2 text-xs font-semibold transition"
              style={{
                border: "none",
                cursor: "pointer",
                color: period === value ? "#d95316" : "#82766a",
                background: period === value ? "#fff" : "transparent",
                boxShadow: period === value ? "0 1px 3px rgba(45, 26, 14, 0.12)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: card.color, background: card.background }}>
                {card.icon}
              </span>
              <strong className="text-3xl font-semibold tracking-tight" style={{ color: "#2d241d" }}>{card.value}</strong>
            </div>
            <p className="mt-4 text-sm font-medium" style={{ color: "#82766a" }}>{card.label}</p>
          </div>
        ))}
      </div>

      <DashboardCharts
        vendors={vendors}
        activityVendors={periodVendors}
        activityDateError={registrationDateError}
        period={period}
        onPeriodChange={setPeriod}
        size="large"
        showPeriodControl={false}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl p-5 sm:p-6" style={cardStyle} aria-labelledby="availability-heading">
          <div className="mb-5">
            <h3 id="availability-heading" className="text-base font-semibold" style={{ color: "#2d241d" }}>
              Current vendor availability
            </h3>
            <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
              Live status across all vendor listings, regardless of date filter.
            </p>
          </div>
          {vendors.length ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium" style={{ color: "#433a31" }}>
                    <Power size={15} color="#22845b" /> Open
                  </span>
                  <span style={{ color: "#82766a" }}>{openVendors} ({Math.round((openVendors / vendors.length) * 100)}%)</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "#f0ede7" }}>
                  <div className="h-full rounded-full" style={{ width: `${(openVendors / vendors.length) * 100}%`, background: "#22845b" }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium" style={{ color: "#433a31" }}>
                    <PowerOff size={15} color="#c34b44" /> Offline
                  </span>
                  <span style={{ color: "#82766a" }}>{offlineVendors} ({Math.round((offlineVendors / vendors.length) * 100)}%)</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "#f0ede7" }}>
                  <div className="h-full rounded-full" style={{ width: `${(offlineVendors / vendors.length) * 100}%`, background: "#c34b44" }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-xl px-4 py-5 text-sm" style={{ color: "#82766a", background: "#faf8f4" }}>
              Vendor availability will appear when listings are available.
            </p>
          )}
        </section>

        <section className="rounded-2xl p-5 sm:p-6" style={cardStyle} aria-labelledby="categories-heading">
          <div className="mb-5">
            <h3 id="categories-heading" className="text-base font-semibold" style={{ color: "#2d241d" }}>
              Category ranking
            </h3>
            <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
              Vendor mix for {periodOptions.find((option) => option.value === period)?.label.toLowerCase()}.
            </p>
          </div>
          {categories.length ? (
            <div className="space-y-4">
              {categories.map(({ category, count }) => {
                const share = totalCategorizedVendors ? (count / totalCategorizedVendors) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium" style={{ color: "#433a31" }}>{category}</span>
                      <span className="flex-shrink-0" style={{ color: "#82766a" }}>{count} · {Math.round(share)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "#f0ede7" }}>
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: "#d95316" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl px-4 py-5 text-sm" style={{ color: "#82766a", background: "#faf8f4" }}>
              No vendors with listing dates in this range.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl p-5 sm:p-6" style={cardStyle} aria-labelledby="highlights-heading">
        <div className="mb-5">
          <h3 id="highlights-heading" className="text-base font-semibold" style={{ color: "#2d241d" }}>
            Actionable highlights
          </h3>
          <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
            Items to review across all records, not limited by the selected date range.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onManageVendors}
            className="flex items-center justify-between gap-4 rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
            style={{ border: "1px solid #e9e5dd", background: incompleteVendors.length ? "#fff9ef" : "#f5faf6", cursor: "pointer" }}
          >
            <span className="flex items-start gap-3">
              {incompleteVendors.length
                ? <CircleAlert size={18} color="#b66b12" />
                : <CheckCircle2 size={18} color="#22845b" />}
              <span>
                <span className="block text-sm font-semibold" style={{ color: "#433a31" }}>
                  {incompleteVendors.length ? `${incompleteVendors.length} incomplete listings` : "All listings look complete"}
                </span>
                <span className="mt-1 block text-xs" style={{ color: "#82766a" }}>Check name, category, and opening hours</span>
              </span>
            </span>
            <ArrowRight size={16} color="#a17b58" />
          </button>
          <button
            type="button"
            onClick={onManageUsers}
            className="flex items-center justify-between gap-4 rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
            style={{ border: "1px solid #e9e5dd", background: disabledAccounts ? "#fff9ef" : "#f5faf6", cursor: "pointer" }}
          >
            <span className="flex items-start gap-3">
              {disabledAccounts
                ? <CircleAlert size={18} color="#b66b12" />
                : <CheckCircle2 size={18} color="#22845b" />}
              <span>
                <span className="block text-sm font-semibold" style={{ color: "#433a31" }}>
                  {disabledAccounts ? `${disabledAccounts} disabled accounts` : "No disabled accounts"}
                </span>
                <span className="mt-1 block text-xs" style={{ color: "#82766a" }}>Review account access settings</span>
              </span>
            </span>
            <ArrowRight size={16} color="#a17b58" />
          </button>
        </div>
      </section>

      <section className="rounded-2xl p-5 sm:p-6" style={cardStyle} aria-labelledby="tracking-heading">
        <div className="mb-4">
          <h3 id="tracking-heading" className="text-base font-semibold" style={{ color: "#2d241d" }}>
            Metrics not tracked yet
          </h3>
          <p className="mt-1 text-sm" style={{ color: "#82766a" }}>
            These require event or transaction data before the analytics can report them reliably.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl p-4" style={{ background: "#faf8f4" }}>
            <p className="font-semibold" style={{ color: "#433a31" }}>Engagement</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#82766a" }}>Views, searches, favorites, and contact clicks</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: "#faf8f4" }}>
            <p className="font-semibold" style={{ color: "#433a31" }}>Sales</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#82766a" }}>Orders and revenue by vendor or category</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: "#faf8f4" }}>
            <p className="font-semibold" style={{ color: "#433a31" }}>Status history</p>
            <p className="mt-1 leading-relaxed" style={{ color: "#82766a" }}>Suspensions and changes over time</p>
          </div>
        </div>
      </section>
    </div>
  );
}
