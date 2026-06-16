import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { InviteMemberInput } from '@saas/shared';

interface Member {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    status: string;
  };
  role: {
    id: string;
    name: string;
  };
  joinedAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteMemberInput>({
    email: '',
    roleId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { hasPermission } = useAuthStore();
  const { primaryColor } = useThemeStore();

  const fetchData = async () => {
    try {
      const [membersRes, rolesRes] = await Promise.all([
        api.get<{ success: boolean; data: PaginatedResponse<Member> }>(`/tenant/members?page=${page}&limit=10`),
        api.get<{ success: boolean; data: Role[] }>('/tenant/roles'),
      ]);

      if (membersRes.success) {
        setMembers(membersRes.data.data);
        setTotalPages(membersRes.data.totalPages);
      }
      if (rolesRes.success) {
        setRoles(rolesRes.data);
        if (rolesRes.data.length > 0 && !inviteForm.roleId) {
          setInviteForm(prev => ({ ...prev, roleId: rolesRes.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await api.post<{ success: boolean }>('/tenant/members/invite', inviteForm);
      if (response.success) {
        setSuccess('Invitation sent successfully!');
        setInviteForm({ email: '', roleId: roles[0]?.id || '' });
        setTimeout(() => {
          setShowInviteModal(false);
          setSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await api.delete(`/tenant/members/${memberId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId: string, newRoleId: string) => {
    try {
      await api.put(`/tenant/members/${memberId}/role`, { roleId: newRoleId });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-600 mt-1">Manage your team members and their roles</p>
        </div>
        {hasPermission('member:invite') && (
          <button
            className="btn-primary"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setShowInviteModal(true)}
          >
            + Invite Member
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No members found</p>
            <p className="text-sm text-gray-400 mt-1">Invite your first team member to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Member</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Joined</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user.name}</p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {hasPermission('member:role:update') ? (
                        <select
                          className="input-sm"
                          value={member.role.id}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge badge-info">{member.role.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${member.user.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                        {member.user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('member:remove') && member.role.name !== 'Owner' && (
                        <button
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="space-x-2">
              <button
                className="btn-outline text-sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn-outline text-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="select"
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, roleId: e.target.value }))}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  className="btn-outline flex-1"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
