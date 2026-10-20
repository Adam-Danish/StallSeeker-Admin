import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { BarChart2, PieChart as PieIcon } from 'lucide-react';

interface ActivityPoint {
  label: string;
  signups: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

export interface DashboardVendor {
  id: string;
  name: string;
  category: string;
  openingHours: string;
  isOpen: boolean;
  isAccountDisabled: boolean;
  createdAt: Date | null;
}

export function getCategoryLabel(category: string): string {
  const label = category.trim();
  return !label || label.toLowerCase() === 'unknown' ? 'Others' : label;
}

export type DashboardPeriod = 'today' | '7d' | '30d' | 'all';

interface Props {
  vendors: DashboardVendor[];
  activityVendors?: DashboardVendor[];
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  size?: 'default' | 'large';
  showPeriodControl?: boolean;
}

const PIE_COLORS = ['#d95316', '#c49b61', '#785333', '#e09f67', '#8d5b4c', '#b66b12'];
const chartCardStyle = {
  background: '#fff',
  padding: '20px',
  borderRadius: '18px',
  border: '1px solid #e9e5dd',
  boxShadow: '0 8px 24px rgba(45, 26, 14, 0.045)',
};
const toggleGroupStyle = {
  display: 'flex',
  background: '#f6f3ed',
  borderRadius: '10px',
  padding: '3px',
  border: '1px solid #e9e5dd',
};
const chartButtonStyle = {
  padding: '6px 9px',
  border: 'none',
  borderRadius: '7px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export const DashboardCharts: React.FC<Props> = ({
  vendors,
  activityVendors = vendors,
  period,
  onPeriodChange,
  size = 'default',
  showPeriodControl = true,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const isLarge = size === 'large';
  const cardStyle = {
    ...chartCardStyle,
    padding: isLarge ? '28px' : chartCardStyle.padding,
  };
  const headingStyle = {
    margin: 0,
    color: '#2d241d',
    fontSize: isLarge ? '18px' : '15px',
    fontWeight: 650,
  };
  const chartHeight = isLarge ? '380px' : '220px';

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    vendors.forEach((vendor) => {
      const category = getCategoryLabel(vendor.category);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return Array.from(counts, ([category, count]) => ({ category, count }));
  }, [vendors]);

  const activityData = useMemo<ActivityPoint[]>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === 'today') {
      const buckets = Array.from({ length: 6 }, (_, index) => ({
        label: `${String(index * 4).padStart(2, '0')}:00`,
        signups: 0,
      }));
      activityVendors.forEach((vendor) => {
        if (!vendor.createdAt || vendor.createdAt < start) return;
        const index = Math.min(Math.floor(vendor.createdAt.getHours() / 4), 5);
        buckets[index].signups++;
      });
      return buckets;
    }

    if (period === 'all') {
      start.setDate(1);
      start.setMonth(start.getMonth() - 11);
      const months = Array.from({ length: 12 }, (_, index) =>
        new Date(start.getFullYear(), start.getMonth() + index, 1)
      );
      const counts = new Map(months.map((date) => [`${date.getFullYear()}-${date.getMonth()}`, 0]));

      activityVendors.forEach((vendor) => {
        if (!vendor.createdAt || vendor.createdAt < start || vendor.createdAt > now) return;
        const key = `${vendor.createdAt.getFullYear()}-${vendor.createdAt.getMonth()}`;
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      });

      return months.map((date) => ({
        label: date.toLocaleDateString([], { month: 'short' }),
        signups: counts.get(`${date.getFullYear()}-${date.getMonth()}`) ?? 0,
      }));
    }

    const dayCount = period === '7d' ? 7 : 30;
    start.setDate(start.getDate() - dayCount + 1);
    const dates = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
    const counts = new Map(dates.map((date) => [date.toDateString(), 0]));

    activityVendors.forEach((vendor) => {
      if (!vendor.createdAt || vendor.createdAt < start) return;
      const key = vendor.createdAt.toDateString();
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return dates.map((date) => ({
      label: period === '7d'
        ? date.toLocaleDateString([], { weekday: 'short' })
        : date.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      signups: counts.get(date.toDateString()) ?? 0,
    }));
  }, [period, activityVendors]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isLarge ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
      gap: isLarge ? '24px' : '16px',
    }}>
      {/* Dynamic Area Chart */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: isLarge ? '24px' : '18px' }}>
          <div>
            <h4 style={headingStyle}>New vendor listings</h4>
            <p style={{ margin: '4px 0 0', color: '#82766a', fontSize: isLarge ? '14px' : '12px' }}>
              {activityData.some((point) => point.signups > 0)
                ? 'Listing activity over time'
                : 'No dated listings in this period yet'}
            </p>
          </div>
          {showPeriodControl && <div style={toggleGroupStyle}>
            {([
              ['today', 'Today'],
              ['7d', '7 days'],
              ['30d', '30 days'],
              ['all', 'All time'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onPeriodChange(value)}
                aria-pressed={period === value}
                style={{
                  ...chartButtonStyle,
                  background: period === value ? '#fff' : 'transparent',
                  color: period === value ? '#d95316' : '#82766a',
                  boxShadow: period === value ? '0 1px 3px rgba(45, 26, 14, 0.12)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>}
        </div>
        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="colorVendors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d95316" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#d95316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ede7" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#948779', fontSize: isLarge ? 13 : 11 }} interval={period === '30d' ? 4 : 0} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#948779', fontSize: isLarge ? 13 : 11 }} allowDecimals={false} width={isLarge ? 38 : 28} />
              <Tooltip
                contentStyle={{ border: '1px solid #e9e5dd', borderRadius: '12px', boxShadow: '0 8px 24px rgba(45, 26, 14, 0.10)' }}
                labelStyle={{ color: '#433a31', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="signups" name="New vendors" stroke="#d95316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVendors)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dynamic Category Chart with Bar / Pie Toggle */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: isLarge ? '24px' : '18px' }}>
          <div>
            <h4 style={headingStyle}>Stalls by category</h4>
            <p style={{ margin: '4px 0 0', color: '#82766a', fontSize: isLarge ? '14px' : '12px' }}>
              Current distribution across vendor types
            </p>
          </div>
          
          {/* Toggle Control */}
          <div style={toggleGroupStyle}>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              aria-pressed={chartType === 'bar'}
              style={{
                ...chartButtonStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: chartType === 'bar' ? '#fff' : 'transparent',
                color: chartType === 'bar' ? '#d95316' : '#82766a',
                boxShadow: chartType === 'bar' ? '0 1px 3px rgba(45, 26, 14, 0.12)' : 'none',
              }}
            >
              <BarChart2 size={14} /> Bar
            </button>
            <button
              type="button"
              onClick={() => setChartType('pie')}
              aria-pressed={chartType === 'pie'}
              style={{
                ...chartButtonStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: chartType === 'pie' ? '#fff' : 'transparent',
                color: chartType === 'pie' ? '#d95316' : '#82766a',
                boxShadow: chartType === 'pie' ? '0 1px 3px rgba(45, 26, 14, 0.12)' : 'none',
              }}
            >
              <PieIcon size={14} /> Pie
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ede7" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#948779', fontSize: isLarge ? 13 : 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#948779', fontSize: isLarge ? 13 : 11 }} allowDecimals={false} width={isLarge ? 38 : 28} />
                <Tooltip
                  contentStyle={{ border: '1px solid #e9e5dd', borderRadius: '12px', boxShadow: '0 8px 24px rgba(45, 26, 14, 0.10)' }}
                  labelStyle={{ color: '#433a31', fontWeight: 600 }}
                />
                <Bar dataKey="count" fill="#d95316" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={isLarge ? 125 : 68}
                  dataKey="count"
                  nameKey="category"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} stalls`, 'Count']}
                  contentStyle={{ border: '1px solid #e9e5dd', borderRadius: '12px', boxShadow: '0 8px 24px rgba(45, 26, 14, 0.10)' }}
                />
                <Legend iconSize={9} wrapperStyle={{ fontSize: isLarge ? '13px' : '11px', color: '#82766a' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};