import React, { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";

import AdminSettings from "./pages/AdminSettings";
import AdminUsers from "./pages/AdminUsers";
import AssetsPage from "./pages/AssetsPage";
import Dashboard from "./pages/Dashboard";
import EmployeeAccessPreview from "./pages/EmployeeAccessPreview";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import LoginPage from "./pages/LoginPage";
import OperationsHubEmbed from "./pages/OperationsHubEmbed";
import ProductionDashboard from "./pages/ProductionDashboard";
import SignupPage from "./pages/SignupPage.jsx";
import TicketCreatePage from "./pages/TicketCreatePage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TicketWorkspace from "./pages/TicketWorkspace";
import WaitingApproval from "./pages/WaitingApproval";

const MODULE_BASES = {
  helpdesk: "/helpdesk",
  production: "/production",
};

const EMPLOYEE_ROLE = "user";

const OPERATIONS_ROLES = [
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
];

const ADMIN_ROLES = [
  "manager",
  "admin",
  "superadmin",
];

function getModuleBase() {
  const pathname = window.location.pathname.toLowerCase();

  return pathname.startsWith(MODULE_BASES.production)
    ? MODULE_BASES.production
    : MODULE_BASES.helpdesk;
}

function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#172b57] px-4">
      <div
        className="rounded-2xl border border-white/20 bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-xl"
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.assign(to);
  }, [to]);

  return <LoadingScreen message="Redirecting..." />;
}

function AuthenticatedRoute({ children }) {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PrivateRoute({ children }) {
  const {
    isAuthenticated,
    loading,
    user,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasPortalAccess =
    Boolean(user?.approved) &&
    user?.status === "active" &&
    !user?.archived_at &&
    user?.microsoft_account_enabled !== false;

  if (!hasPortalAccess) {
    return (
      <Navigate
        to="/waiting-approval"
        replace
      />
    );
  }

  return children;
}

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const {
    isAuthenticated,
    loading,
    user,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return children;
  }

  const hasPortalAccess =
    Boolean(user?.approved) &&
    user?.status === "active" &&
    !user?.archived_at &&
    user?.microsoft_account_enabled !== false;

  return (
    <Navigate
      to={hasPortalAccess ? "/" : "/waiting-approval"}
      replace
    />
  );
}

function HomeRoute({ isProductionModule }) {
  const { user } = useAuth();

  if (isProductionModule) {
    return (
      <RoleRoute allowedRoles={OPERATIONS_ROLES}>
        <ProductionDashboard />
      </RoleRoute>
    );
  }

  if (user?.role === EMPLOYEE_ROLE) {
    return <EmployeeDashboard />;
  }

  return <Dashboard />;
}

function AppRoutes({ moduleBase }) {
  const isProductionModule =
    moduleBase === MODULE_BASES.production;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />

      <Route
        path="/waiting-approval"
        element={
          <AuthenticatedRoute>
            <WaitingApproval />
          </AuthenticatedRoute>
        }
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomeRoute isProductionModule={isProductionModule} />
          </PrivateRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <HomeRoute isProductionModule={isProductionModule} />
          </PrivateRoute>
        }
      />

      <Route
        path="/employee"
        element={
          <PrivateRoute>
            <EmployeeDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/production"
        element={<ExternalRedirect to={MODULE_BASES.production} />}
      />

      <Route
        path="/tickets"
        element={
          <PrivateRoute>
            <TicketWorkspace />
          </PrivateRoute>
        }
      />

      <Route
        path="/tickets/new"
        element={
          <PrivateRoute>
            <TicketCreatePage />
          </PrivateRoute>
        }
      />

      <Route
        path="/tickets/:id"
        element={
          <PrivateRoute>
            <TicketDetailPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/assets"
        element={
          <PrivateRoute>
            <AssetsPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/operations-hub"
        element={
          <PrivateRoute>
            <RoleRoute allowedRoles={OPERATIONS_ROLES}>
              <OperationsHubEmbed />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <RoleRoute allowedRoles={ADMIN_ROLES}>
              <AdminSettings />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <RoleRoute allowedRoles={ADMIN_ROLES}>
              <AdminUsers />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/employee-access"
        element={
          <PrivateRoute>
            <RoleRoute allowedRoles={ADMIN_ROLES}>
              <EmployeeAccessPreview />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default function App() {
  const moduleBase = getModuleBase();

  return (
    <AuthProvider>
      <BrowserRouter
        basename={moduleBase}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes moduleBase={moduleBase} />
      </BrowserRouter>
    </AuthProvider>
  );
}
