import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Roles from './pages/Roles';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';

function PrivateRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

function App() {
  const { isLoading: themeLoading } = useThemeStore();

  if (themeLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="members"
          element={
            <PrivateRoute permission="member:read">
              <Members />
            </PrivateRoute>
          }
        />
        <Route
          path="roles"
          element={
            <PrivateRoute permission="role:read">
              <Roles />
            </PrivateRoute>
          }
        />
        <Route
          path="billing"
          element={
            <PrivateRoute permission="billing:read">
              <Billing />
            </PrivateRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PrivateRoute permission="settings:read">
              <Settings />
            </PrivateRoute>
          }
        />
        <Route
          path="audit"
          element={
            <PrivateRoute permission="audit:read">
              <AuditLogs />
            </PrivateRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
