import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

interface TenantSettings {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    customDomain: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    logoUrl: '',
  });
  const { applyTheme, primaryColor, secondaryColor, logoUrl } = useThemeStore();
  const { hasPermission } = useAuthStore();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TenantSettings }>('/tenant');
        if (response.success) {
          const data = response.data;
          setSettings(data);
          setFormData({
            name: data.name,
            customDomain: data.customDomain || '',
            primaryColor: data.theme.primaryColor,
            secondaryColor: data.theme.secondaryColor,
            logoUrl: data.theme.logoUrl,
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('settings:update') && !hasPermission('tenant:update')) return;

    setSaving(true);
    try {
      const updateData: any = {
        name: formData.name,
        customDomain: formData.customDomain || null,
      };

      updateData.theme = {
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        logoUrl: formData.logoUrl,
      };

      const response = await api.put<{ success: boolean; data: TenantSettings }>('/tenant', updateData);
      if (response.success) {
        setSettings(response.data);
        applyTheme({
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          logoUrl: formData.logoUrl,
          tenantName: formData.name,
        });
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    applyTheme({
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      logoUrl: formData.logoUrl || logoUrl,
      tenantName: formData.name,
    });
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        name: settings.name,
        customDomain: settings.customDomain || '',
        primaryColor: settings.theme.primaryColor,
        secondaryColor: settings.theme.secondaryColor,
        logoUrl: settings.theme.logoUrl,
      });
      applyTheme({
        primaryColor: settings.theme.primaryColor,
        secondaryColor: settings.theme.secondaryColor,
        logoUrl: settings.theme.logoUrl,
        tenantName: settings.name,
      });
    }
  };

  const presetColors = [
    { primary: '#3B82F6', secondary: '#10B981', name: 'Default' },
    { primary: '#8B5CF6', secondary: '#EC4899', name: 'Purple' },
    { primary: '#EF4444', secondary: '#F59E0B', name: 'Sunset' },
    { primary: '#0EA5E9', secondary: '#06B6D4', name: 'Ocean' },
    { primary: '#10B981', secondary: '#84CC16', name: 'Forest' },
    { primary: '#F59E0B', secondary: '#EF4444', name: 'Fire' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="card space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/5"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your tenant settings and customize the appearance
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Enter organization name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subdomain
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={settings?.subdomain || ''}
                  disabled
                  className="input bg-gray-100 flex-1"
                />
                <span className="inline-flex items-center px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-gray-500">
                  .example.com
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Subdomain cannot be changed</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Domain
              </label>
              <input
                type="text"
                value={formData.customDomain}
                onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                className="input"
                placeholder="app.yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Configure a custom domain for your tenant (DNS setup required)
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme Customization</h3>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-3">
              {presetColors.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      primaryColor: preset.primary,
                      secondaryColor: preset.secondary,
                    });
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.primaryColor === preset.primary &&
                    formData.secondaryColor === preset.secondary
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex space-x-1 mb-1">
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: preset.primary }}
                    ></div>
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: preset.secondary }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex space-x-3">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="input flex-1 font-mono"
                  pattern="#[0-9A-Fa-f]{6}"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Color
              </label>
              <div className="flex space-x-3">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="input flex-1 font-mono"
                  pattern="#[0-9A-Fa-f]{6}"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo URL
            </label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="input-field"
              placeholder="https://yourcompany.com/logo.png"
            />
            <div className="mt-3 flex items-center space-x-4">
              <span className="text-sm text-gray-500">Preview:</span>
              <img
                src={formData.logoUrl || logoUrl}
                alt="Logo preview"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Live Preview</h4>
            <div className="flex items-center space-x-4 p-4 bg-white rounded-lg border border-gray-200">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: formData.primaryColor }}
              >
                {formData.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{formData.name}</p>
                <div className="flex space-x-2 mt-1">
                  <span
                    className="px-2 py-0.5 text-xs text-white rounded"
                    style={{ backgroundColor: formData.primaryColor }}
                  >
                    Primary
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs text-white rounded"
                    style={{ backgroundColor: formData.secondaryColor }}
                  >
                    Secondary
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 text-white rounded-md text-sm font-medium"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  Primary
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-white rounded-md text-sm font-medium"
                  style={{ backgroundColor: formData.secondaryColor }}
                >
                  Secondary
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              type="button"
              onClick={handlePreview}
              className="btn btn-secondary"
            >
              Apply Preview
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (!hasPermission('settings:update') && !hasPermission('tenant:update'))}
            className="btn btn-primary"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
