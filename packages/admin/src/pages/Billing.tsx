import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { BILLING_TIERS, BillingTier } from '@saas/shared';

interface UsageData {
  month: string;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  estimatedCost: number;
}

interface InvoiceData {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  amount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'void';
  paidAt?: string;
  createdAt: string;
}

interface TenantData {
  id: string;
  name: string;
  tier: string;
}

export default function Billing() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { primaryColor, secondaryColor } = useThemeStore();
  const { hasPermission } = useAuthStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usageRes, invoicesRes, tenantRes] = await Promise.all([
          api.get<{ success: boolean; data: UsageData }>('/billing/usage'),
          api.get<{ success: boolean; data: { data: InvoiceData[]; total: number; totalPages: number } }>('/billing/invoices'),
          api.get<{ success: boolean; data: TenantData }>('/tenant'),
        ]);

        if (usageRes.success) setUsage(usageRes.data);
        if (invoicesRes.success) {
          setInvoices(Array.isArray(invoicesRes.data.data) ? invoicesRes.data.data : []);
        }
        if (tenantRes.success) {
          setTenant(tenantRes.data);
          setSelectedTier(tenantRes.data.tier);
        }
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpgrade = async () => {
    if (selectedTier === tenant?.tier) {
      setShowUpgradeModal(false);
      return;
    }

    setUpdating(true);
    try {
      await api.put('/billing/tier', { tier: selectedTier });
      if (tenant) {
        setTenant({ ...tenant, tier: selectedTier });
      }
      setShowUpgradeModal(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update tier:', error);
      alert('Failed to update plan. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'badge-success',
      pending: 'badge-warning',
      overdue: 'badge-danger',
      draft: 'badge-info',
      void: 'badge-gray',
    };
    return <span className={`badge ${styles[status] || 'badge-gray'}`}>{status}</span>;
  };

  const tiers = Object.entries(BILLING_TIERS) as [string, BillingTier][];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-600 mt-1">
            Manage your subscription plan and view billing history
          </p>
        </div>
        {hasPermission('billing:update') && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="btn btn-primary"
            style={{ backgroundColor: primaryColor }}
          >
            Change Plan
          </button>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : tenant ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h4 className="text-xl font-bold" style={{ color: primaryColor }}>
                  {BILLING_TIERS[tenant.tier]?.name || tenant.tier}
                </h4>
                <span className="badge badge-success">Active</span>
              </div>
              <p className="text-gray-600 mt-2">
                {BILLING_TIERS[tenant.tier]?.freeCalls.toLocaleString() || 0} free API calls per month
              </p>
            </div>
            {usage && (
              <div className="text-right">
                <p className="text-sm text-gray-500">This month's cost</p>
                <p className="text-2xl font-bold text-gray-900">${usage.estimatedCost.toFixed(2)}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {usage && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Calls</p>
              <p className="text-2xl font-bold mt-1" style={{ color: primaryColor }}>
                {usage.totalCalls.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Free Calls</p>
              <p className="text-2xl font-bold mt-1" style={{ color: secondaryColor }}>
                {usage.freeCalls.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Billable</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {usage.billableCalls.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Estimated Cost</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                ${usage.estimatedCost.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Quota Usage</span>
              <span className="font-medium">
                {usage.totalCalls.toLocaleString()} / {usage.freeCalls.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usage.totalCalls / usage.freeCalls) * 100)}%`,
                  backgroundColor: usage.totalCalls > usage.freeCalls ? '#EF4444' : secondaryColor,
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : Array.isArray(invoices) && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Invoice #</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Period</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Calls</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice?.id || Math.random()} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-mono text-gray-900">
                      #{(invoice?.id || '').slice(0, 8) || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {invoice?.periodStart ? formatDate(invoice.periodStart) : '-'} - {invoice?.periodEnd ? formatDate(invoice.periodEnd) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {(invoice?.totalCalls || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      ${(invoice?.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">{invoice?.status ? getStatusBadge(invoice.status) : '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {invoice?.createdAt ? formatDate(invoice.createdAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">📄</p>
            <p>No invoices yet</p>
          </div>
        )}
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Choose Your Plan</h3>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tiers.map(([key, tier]) => (
                  <div
                    key={key}
                    onClick={() => setSelectedTier(key)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTier === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">{tier.name}</h4>
                      {key === tenant?.tier && (
                        <span className="badge badge-success text-xs">Current</span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-2">
                      {tier.pricePerThousandCalls > 0
                        ? `$${tier.pricePerThousandCalls}/1k calls`
                        : 'Free'}
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      {tier.freeCalls.toLocaleString()} free calls/month
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {tier.tiers.length > 0 ? (
                        tier.tiers.map((t, i) => (
                          <li key={i}>
                            ${t.pricePerThousand}/1k calls {t.maxCalls ? `(up to ${t.maxCalls.toLocaleString()})` : '(unlimited)'}
                          </li>
                        ))
                      ) : (
                        <li>No overage charges</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={updating || selectedTier === tenant?.tier}
                className="btn btn-primary"
                style={{ backgroundColor: primaryColor }}
              >
                {updating ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
