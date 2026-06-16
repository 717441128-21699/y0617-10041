import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊', permission: 'tenant:read' },
  { name: 'Members', href: '/members', icon: '👥', permission: 'member:read' },
  { name: 'Roles', href: '/roles', icon: '🔐', permission: 'role:read' },
  { name: 'Billing', href: '/billing', icon: '💳', permission: 'billing:read' },
  { name: 'Settings', href: '/settings', icon: '⚙️', permission: 'settings:read' },
  { name: 'Audit Logs', href: '/audit', icon: '📝', permission: 'audit:read' },
];

export default function Layout() {
  const { user, logout, hasPermission } = useAuthStore();
  const { tenantName, logoUrl, primaryColor } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navigation.filter(item => hasPermission(item.permission));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="flex items-center space-x-3 px-6 py-4 border-b border-gray-200">
            <img src={logoUrl} alt={tenantName} className="h-8 w-auto" />
            <div>
              <span className="text-lg font-semibold text-gray-900 block">{tenantName}</span>
              <span className="text-xs text-gray-500">Admin Console</span>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: primaryColor + '15', color: primaryColor } : {}
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
