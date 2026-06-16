import { create } from 'zustand';
import { api } from '../lib/api';
import { User, AuthTokens, LoginInput } from '@saas/shared';

interface AuthState {
  user: User | null;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    role: string;
    permissions: string[];
    subdomain: string;
  }>;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenants: [],
  permissions: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (input: LoginInput) => {
    const response = await api.post<{ success: boolean; data: AuthTokens & { user: User; tenantId?: string; role?: string } }>('/auth/login', input);
    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      set({
        user: response.data.user,
        isAuthenticated: true,
      });
      await get().fetchMe();
    }
  },

  logout: () => {
    localStorage.clear();
    set({
      user: null,
      tenants: [],
      permissions: [],
      isAuthenticated: false,
    });
  },

  fetchMe: async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          user: User;
          tenants: Array<{
            tenantId: string;
            tenantName: string;
            role: string;
            permissions: string[];
            subdomain: string;
          }>;
          currentTenant?: {
            id: string;
            name: string;
          };
        };
      }>('/auth/me');
      
      if (response.success) {
        const tenantPermissions = response.data.tenants.find(
          t => t.tenantId === response.data.currentTenant?.id
        )?.permissions || [];
        
        set({
          user: response.data.user,
          tenants: response.data.tenants,
          permissions: tenantPermissions,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  hasPermission: (permission: string) => {
    return get().permissions.includes(permission);
  },
}));
