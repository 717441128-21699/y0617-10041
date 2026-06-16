import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

interface UsageData {
  month: string;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  estimatedCost: number;
}

export default function Dashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { primaryColor, secondaryColor, tenantName } = useThemeStore();
  const { user, tenants } = useAuthStore();

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await api.get<{ success: boolean; data: UsageData }>('/billing/usage');
        if (response.success) {
          setUsage(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with {tenantName} today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-500">Total API Calls</p>
          <p className="text-3xl font-bold mt-2" style={{ color: primaryColor }}>
            {loading ? '...' : usage?.totalCalls.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">Free Calls Remaining</p>
          <p className="text-3xl font-bold mt-2" style={{ color: secondaryColor }}>
            {loading
              ? '...'
              : Math.max(0, (usage?.freeCalls || 0) - (usage?.totalCalls || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            of {usage?.freeCalls.toLocaleString() || 0} included
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">Billable Calls</p>
          <p className="text-3xl font-bold mt-2 text-gray-700">
            {loading ? '...' : usage?.billableCalls.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500">Estimated Cost</p>
          <p className="text-3xl font-bold mt-2 text-green-600">
            ${loading ? '...' : usage?.estimatedCost.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Tenants</h3>
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.tenantId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{tenant.tenantName}</p>
                  <p className="text-sm text-gray-500">{tenant.role}</p>
                </div>
                <a
                  href={`http://${tenant.subdomain}.localhost:5173`}
                  className="text-sm px-3 py-1 rounded-md"
                  style={{ backgroundColor: primaryColor + '10', color: primaryColor }}
                >
                  Switch
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="http://admin.localhost:5174"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105"
              style={{ backgroundColor: primaryColor + '10' }}
            >
              <span className="text-2xl">⚙️</span>
              <p className="text-sm font-medium mt-2" style={{ color: primaryColor }}>
                Admin Console
              </p>
            </a>
            <a
              href="http://admin.localhost:5174/members"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105"
              style={{ backgroundColor: secondaryColor + '10' }}
            >
              <span className="text-2xl">👥</span>
              <p className="text-sm font-medium mt-2" style={{ color: secondaryColor }}>
                Manage Team
              </p>
            </a>
            <a
              href="http://admin.localhost:5174/billing"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105 bg-purple-50"
            >
              <span className="text-2xl">💳</span>
              <p className="text-sm font-medium mt-2 text-purple-600">
                Billing
              </p>
            </a>
            <a
              href="http://admin.localhost:5174/settings"
              className="p-4 rounded-lg text-center transition-transform hover:scale-105 bg-orange-50"
            >
              <span className="text-2xl">🎨</span>
              <p className="text-sm font-medium mt-2 text-orange-600">
                Customize
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
