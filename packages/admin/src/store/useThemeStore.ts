import { create } from 'zustand';

interface ThemeState {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  tenantName: string;
  isLoading: boolean;
  fetchTheme: () => Promise<void>;
  applyTheme: (theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    tenantName?: string;
  }) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  logoUrl: '/default-logo.png',
  tenantName: 'Admin Console',
  isLoading: true,

  fetchTheme: async () => {
    try {
      const response = await fetch('/api/theme');
      const data = await response.json();
      
      if (data.success) {
        const { theme, tenantName } = data.data;
        set({
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          logoUrl: theme.logoUrl,
          tenantName,
          isLoading: false,
        });
        applyCssVariables(theme);
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  applyTheme: (theme) => {
    set({
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      logoUrl: theme.logoUrl,
      tenantName: theme.tenantName || 'Admin Console',
    });
    applyCssVariables(theme);
  },
}));

function applyCssVariables(theme: { primaryColor: string; secondaryColor: string }) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primaryColor);
  root.style.setProperty('--color-secondary', theme.secondaryColor);

  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (favicon && theme.logoUrl) {
    favicon.href = theme.logoUrl;
  }
}
