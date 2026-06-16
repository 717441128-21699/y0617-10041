import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';

interface UsageData {
  month: string;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  estimatedCost: number;
}

interface TenantData {
  id: string;
  name: string;
  status: string;
  tier: string;
}

export default function Dashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const { primaryColor, secondaryColor } = useThemeStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usageRes, tenantRes] = await Promise.all([
          api.get<{ success: boolean; data: UsageData }>('/billing/usage'),
          api.get<{ success: boolean; data: TenantData }>('/tenant'),
        ]);

        if (usageRes.success) setUsage(usageRes.data);
        if (tenantRes.success) setTenant(tenantRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = [
    {
      label: 'Total API Calls',
      value: usage?.totalCalls.toLocaleString() || 0,
      subtext: 'This month',
      color: primaryColor,
    },
    {
      label: 'Free Calls Remaining',
      value: Math.max(0, (usage?.freeCalls || 0) - (usage?.totalCalls || 0)).toLocaleString(),
      subtext: `of ${usage?.freeCalls.toLocaleString() || 0} included`,
      color: secondaryColor,
    },
    {
      label: 'Billable Calls',
      value: usage?.billableCalls.toLocaleString() || 0,
      subtext: 'This month',
      color: '#6B7280',
    },
    {
      label: 'Estimated Cost',
      value: `$${usage?.estimatedCost.toFixed(2) || '0.00'}`,
      subtext: 'This month',
      color: '#059669',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Overview of your tenant activity and usage
          </p>
        </div>
        {tenant && (
          <div className="flex items-center space-x-2">
            <span className={`badge ${tenant.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
              {tenant.status}
            </span>
            <span className="badge badge-info">{tenant.tier}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold mt-2" style={{ color: stat.color }}>
              {loading ? '...' : stat.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Breakdown</h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : usage ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Free Quota</span>
                  <span className="font-medium">{usage.freeCalls.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (usage.totalCalls / usage.freeCalls) * 100)}%`,
                      backgroundColor: secondaryColor,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {usage.totalCalls.toLocaleString()} of {usage.freeCalls.toLocaleString()} used
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{usage.billableCalls.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Billable Calls</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">${usage.estimatedCost.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Estimated Cost</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No usage data available</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/members"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105"
              style={{ backgroundColor: primaryColor + '10' }}
            >
              <span className="text-2xl">👥</span>
              <p className="text-sm font-medium mt-2" style={{ color: primaryColor }}>
                Invite Member
              </p>
            </a>
            <a
              href="/roles"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105"
              style={{ backgroundColor: secondaryColor + '10' }}
            >
              <span className="text-2xl">🔐</span>
              <p className="text-sm font-medium mt-2" style={{ color: secondaryColor }}>
                Manage Roles
              </p>
            </a>
            <a
              href="/billing"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105 bg-purple-50"
            >
              <span className="text-2xl">💳</span>
              <p className="text-sm font-medium mt-2 text-purple-600">
                View Billing
              </p>
            </a>
            <a
              href="/settings"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105 bg-orange-50"
            >
              <span className="text-2xl">🎨</span>
              <p className="text-sm font-medium mt-2 text-orange-600">
                Customize Theme
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
