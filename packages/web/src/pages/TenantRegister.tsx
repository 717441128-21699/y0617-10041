import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';
import { CreateTenantInput } from '@saas/shared';

export default function TenantRegister() {
  const [formData, setFormData] = useState<CreateTenantInput>({
    name: '',
    subdomain: '',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { tenantName, logoUrl, primaryColor } = useThemeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<{ success: boolean; data: { tenantId: string; subdomain: string; name: string; userId: string } }>(
        '/tenant/register',
        formData
      );
      
      if (response.success) {
        setSuccess(true);
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        const loginUrl = `${protocol}//${formData.subdomain}.${host}:5174/login`;
        
        setTimeout(() => {
          window.location.href = loginUrl;
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tenant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Tenant Created!</h2>
          <p className="mt-2 text-gray-600">
            Redirecting you to {formData.subdomain}.localhost...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img src={logoUrl} alt={tenantName} className="mx-auto h-12 w-auto" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Create Your Tenant
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Get started with your own SaaS workspace
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Company Name
              </label>
              <input
                id="name"
                type="text"
                required
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label htmlFor="subdomain" className="label">
                Subdomain
              </label>
              <div className="flex rounded-lg shadow-sm">
                <input
                  id="subdomain"
                  type="text"
                  required
                  pattern="[a-z0-9-]+"
                  className="input rounded-r-none"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
                  placeholder="acme"
                />
                <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-500">
                  .localhost
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
            </div>

            <div>
              <label htmlFor="adminName" className="label">
                Your Name
              </label>
              <input
                id="adminName"
                type="text"
                required
                className="input"
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="adminEmail" className="label">
                Admin Email
              </label>
              <input
                id="adminEmail"
                type="email"
                required
                className="input"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="adminPassword" className="label">
                Admin Password
              </label>
              <input
                id="adminPassword"
                type="password"
                required
                minLength={8}
                className="input"
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium" style={{ color: primaryColor }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
