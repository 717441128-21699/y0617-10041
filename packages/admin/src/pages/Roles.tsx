import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { SYSTEM_PERMISSIONS } from '../../../api/src/config';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });
  const [error, setError] = useState('');

  const { hasPermission } = useAuthStore();
  const { primaryColor } = useThemeStore();

  const fetchRoles = async () => {
    try {
      const response = await api.get<{ success: boolean; data: Role[] }>('/tenant/roles');
      if (response.success) {
        setRoles(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/tenant/roles', newRole);
      setShowCreateModal(false);
      setNewRole({ name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const togglePermission = (permission: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const permissionGroups = [
    { name: 'Tenant', permissions: ['tenant:read', 'tenant:update'] },
    { name: 'Members', permissions: ['member:read', 'member:invite', 'member:remove', 'member:role:update'] },
    { name: 'Roles', permissions: ['role:read', 'role:create', 'role:update', 'role:delete'] },
    { name: 'Billing', permissions: ['billing:read', 'billing:update'] },
    { name: 'Settings', permissions: ['settings:read', 'settings:update'] },
    { name: 'Audit', permissions: ['audit:read'] },
    { name: 'API', permissions: ['api:read', 'api:write'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">Define roles and manage access to your workspace</p>
        </div>
        {hasPermission('role:create') && (
          <button
            className="btn-primary"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setShowCreateModal(true)}
          >
            + Create Role
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                  {role.isSystem && (
                    <span className="badge badge-info mt-1">System</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">{role.description}</p>
              <div className="flex flex-wrap gap-2">
                {role.permissions.slice(0, 5).map((perm) => (
                  <span key={perm} className="badge bg-gray-100 text-gray-700">
                    {perm}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="badge bg-gray-100 text-gray-700">
                    +{role.permissions.length - 5} more
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Created {new Date(role.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Role</h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="label">Role Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={newRole.name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Support Agent"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={newRole.description}
                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this role can do"
                />
              </div>

              <div>
                <label className="label">Permissions</label>
                <div className="space-y-4">
                  {permissionGroups.map((group) => (
                    <div key={group.name} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{group.name}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission}
                            className="flex items-center space-x-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newRole.permissions.includes(permission)}
                              onChange={() => togglePermission(permission)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-gray-700">{permission.split(':')[1]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  className="btn-outline flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
