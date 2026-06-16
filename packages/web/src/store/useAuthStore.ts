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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenants: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (input: LoginInput) => {
    const response = await api.post<{ success: boolean; data: AuthTokens & { user: User; tenantId?: string } }>('/auth/login', input);
    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      set({
        user: response.data.user,
        isAuthenticated: true,
      });
      const meResponse = await api.get<{
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
        };
      }>('/auth/me');
      if (meResponse.success) {
        set({
          tenants: meResponse.data.tenants,
        });
      }
    }
  },

  logout: () => {
    localStorage.clear();
    set({
      user: null,
      tenants: [],
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
        };
      }>('/auth/me');
      
      if (response.success) {
        set({
          user: response.data.user,
          tenants: response.data.tenants,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
