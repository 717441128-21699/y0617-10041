import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';
import { AuditAction, AuditLog as AuditLogType } from '@saas/shared';

interface AuditLogWithUser extends AuditLogType {
  user?: {
    name: string;
    email: string;
  };
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLogWithUser | null>(null);
  const { primaryColor } = useThemeStore();
  const limit = 20;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (filters.action) params.append('action', filters.action);
        if (filters.userId) params.append('userId', filters.userId);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);

        const response = await api.get<{
          success: boolean;
          data: {
            data: AuditLogWithUser[];
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        }>(`/audit?${params.toString()}`);

        if (response.success) {
          setLogs(Array.isArray(response.data.data) ? response.data.data : []);
          setTotal(response.data.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      userId: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      'tenant.created': '🏢',
      'tenant.updated': '✏️',
      'member.invited': '📧',
      'member.removed': '👤',
      'member.role_updated': '🔄',
      'role.created': '➕',
      'role.updated': '✏️',
      'role.deleted': '🗑️',
      'user.login': '🔐',
      'user.logout': '🚪',
      'settings.updated': '⚙️',
      'billing.plan_changed': '💳',
      'invoice.paid': '✅',
      'api.exceeded_quota': '⚠️',
    };
    return icons[action] || '📝';
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      'tenant.created': 'bg-green-100 text-green-800',
      'tenant.updated': 'bg-blue-100 text-blue-800',
      'member.invited': 'bg-purple-100 text-purple-800',
      'member.removed': 'bg-red-100 text-red-800',
      'member.role_updated': 'bg-yellow-100 text-yellow-800',
      'role.created': 'bg-green-100 text-green-800',
      'role.updated': 'bg-blue-100 text-blue-800',
      'role.deleted': 'bg-red-100 text-red-800',
      'user.login': 'bg-green-100 text-green-800',
      'user.logout': 'bg-gray-100 text-gray-800',
      'settings.updated': 'bg-orange-100 text-orange-800',
      'billing.plan_changed': 'bg-purple-100 text-purple-800',
      'invoice.paid': 'bg-green-100 text-green-800',
      'api.exceeded_quota': 'bg-red-100 text-red-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Track and review all critical operations within your tenant
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {total} total records
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              className="select"
            >
              <option value="">All Actions</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {action.replace('.', ' → ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              name="userId"
              value={filters.userId}
              onChange={handleFilterChange}
              placeholder="Enter user ID"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="text-2xl flex-shrink-0">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getActionBadge(log.action)}`}>
                        {log.action.replace('.', ' → ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-900">
                      <span className="font-medium">{log.actorEmail || log.userId || 'System'}</span>
                      {' '}performed{' '}
                      <span className="font-medium">{log.action.split('.')[1]}</span>
                      {log.targetType && (
                        <> on <span className="font-medium">{log.targetType}</span></>
                      )}
                    </p>
                    {log.ipAddress && (
                      <p className="mt-1 text-xs text-gray-500">
                        IP: {log.ipAddress}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <p className="text-4xl mb-2">📝</p>
            <p>No audit logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-medium">{total}</span> results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${
                      page === pageNum
                        ? 'text-white border-transparent'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    style={page === pageNum ? { backgroundColor: primaryColor } : {}}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getActionIcon(selectedLog.action)}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
                    <p className="text-sm text-gray-500">{selectedLog.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  <p className="font-medium">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getActionBadge(selectedLog.action)}`}>
                      {selectedLog.action.replace('.', ' → ')}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Timestamp</p>
                  <p className="font-medium">{formatDate(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Actor</p>
                  <p className="font-medium">{selectedLog.actorEmail || selectedLog.userId || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">IP Address</p>
                  <p className="font-medium font-mono">{selectedLog.ipAddress || '-'}</p>
                </div>
                {selectedLog.targetType && (
                  <div>
                    <p className="text-sm text-gray-500">Target Type</p>
                    <p className="font-medium">{selectedLog.targetType}</p>
                  </div>
                )}
                {selectedLog.targetId && (
                  <div>
                    <p className="text-sm text-gray-500">Target ID</p>
                    <p className="font-medium font-mono text-sm">{selectedLog.targetId}</p>
                  </div>
                )}
              </div>

              {selectedLog.userAgent && (
                <div>
                  <p className="text-sm text-gray-500">User Agent</p>
                  <p className="font-medium text-sm break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Metadata</p>
                  <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-primary"
                style={{ backgroundColor: primaryColor }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
