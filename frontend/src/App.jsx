import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";

import AdminAuditPage from "./pages/AdminAuditPage";
import AdminHealthPage from "./pages/AdminHealthPage";
import AdminMicrosoftDirectory from "./pages/AdminMicrosoftDirectory";
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
import TicketArchivePage from "./pages/TicketArchivePage";
import TicketCreatePage from "./pages/TicketCreatePage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TicketWorkspace from "./pages/TicketWorkspace";
import WaitingApproval from "./pages/WaitingApproval";
import GroupManagementPage from "./pages/GroupManagementPage";
import KnowledgePage from "./pages/KnowledgePage";
import RequestCatalogPage from "./pages/RequestCatalogPage";
import { formPathForType } from "./data/requestModules";

const MODULE_BASES = {
  helpdesk: "/helpdesk",
  production: "/production",
};

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

function hasPortalAccess(user) {
  return (
    Boolean(user?.approved) &&
    user?.status === "active" &&
    !user?.archived_at &&
    !user?.deactivated_at &&
    user?.microsoft_account_enabled !== false &&
    (!user?.account_type || user.account_type === "person")
  );
}

function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#172b57] px-4">
      <div
        className="rounded-2xl border border-white/20 bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-xl"
        role="status"
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

  return hasPortalAccess(user)
    ? children
    : <Navigate to="/waiting-approval" replace />;
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

  return (
    <Navigate
      to={hasPortalAccess(user) ? "/" : "/waiting-approval"}
      replace
    />
  );
}

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  return allowedRoles.includes(user?.role)
    ? children
    : <Navigate to="/" replace />;
}

function OperationsRoute({ children }) {
  return (
    <RoleRoute allowedRoles={OPERATIONS_ROLES}>
      {children}
    </RoleRoute>
  );
}

function AdminRoute({ children }) {
  return (
    <RoleRoute allowedRoles={ADMIN_ROLES}>
      {children}
    </RoleRoute>
  );
}

function HomeRoute({ production }) {
  const {
    user,
    employeeView,
  } = useAuth();

  if (production) {
    return (
      <OperationsRoute>
        <ProductionDashboard />
      </OperationsRoute>
    );
  }

  if (user?.role === "user" || employeeView) {
    return <EmployeeDashboard />;
  }

  return <Dashboard />;
}

function EmployeeRoute({ children }) {
  const {
    user,
    enterEmployeeView,
  } = useAuth();

  useEffect(() => {
    if (user?.role !== "user") {
      enterEmployeeView();
    }
  }, [enterEmployeeView, user?.role]);

  return children;
}

/** Redirect legacy /tickets/new?type=… to dedicated module routes */
function LegacyTicketCreateRedirect() {
  const [params] = useSearchParams();
  const type = params.get("type") || "incident";
  const hasFormContext =
    params.get("catalogue") ||
    params.get("item") ||
    params.get("title") ||
    params.get("assetItem");

  if (!hasFormContext && (type === "service_request" || type === "asset_request")) {
    const catalogPath =
      type === "asset_request" ? "/request-asset" : "/services";
    return <Navigate to={catalogPath} replace />;
  }

  const target = formPathForType(type, {
    catalogue: params.get("catalogue") || undefined,
    item: params.get("item") || undefined,
    prefillTitle: params.get("title") || undefined,
    assetItem: params.get("assetItem") || undefined,
  });
  return <Navigate to={target} replace />;
}

function AppRoutes({ moduleBase }) {
  const production = moduleBase === MODULE_BASES.production;

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
        element={<WaitingApproval />}
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomeRoute production={production} />
          </PrivateRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <HomeRoute production={production} />
          </PrivateRoute>
        }
      />

      <Route
        path="/employee"
        element={
          <PrivateRoute>
            <EmployeeRoute>
              <EmployeeDashboard />
            </EmployeeRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/production"
        element={
          <ExternalRedirect to={MODULE_BASES.production} />
        }
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
            <LegacyTicketCreateRedirect />
          </PrivateRoute>
        }
      />

      <Route
        path="/incidents/new"
        element={
          <PrivateRoute>
            <TicketCreatePage lockedType="incident" />
          </PrivateRoute>
        }
      />

      <Route
        path="/services"
        element={
          <PrivateRoute>
            <RequestCatalogPage moduleKey="service" />
          </PrivateRoute>
        }
      />

      <Route
        path="/services/request"
        element={
          <PrivateRoute>
            <TicketCreatePage lockedType="service_request" />
          </PrivateRoute>
        }
      />

      <Route
        path="/request-asset"
        element={
          <PrivateRoute>
            <RequestCatalogPage moduleKey="asset" />
          </PrivateRoute>
        }
      />

      <Route
        path="/request-asset/new"
        element={
          <PrivateRoute>
            <TicketCreatePage lockedType="asset_request" />
          </PrivateRoute>
        }
      />

      <Route
        path="/changes/new"
        element={
          <PrivateRoute>
            <TicketCreatePage lockedType="change" />
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
        path="/knowledge"
        element={
          <PrivateRoute>
            <KnowledgePage />
          </PrivateRoute>
        }
      />

      <Route
        path="/archive"
        element={
          <PrivateRoute>
            <AdminRoute>
              <TicketArchivePage />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/operations-hub"
        element={
          <PrivateRoute>
            <OperationsRoute>
              <OperationsHubEmbed />
            </OperationsRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/microsoft"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminMicrosoftDirectory />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/groups"
        element={
          <PrivateRoute>
            <RoleRoute allowedRoles={ADMIN_ROLES}>
              <GroupManagementPage />
            </RoleRoute>
          </PrivateRoute>
      }
    />

      <Route
        path="/admin/employee-access"
        element={
          <PrivateRoute>
            <AdminRoute>
              <EmployeeAccessPreview />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/audit"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminAuditPage />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/health"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminHealthPage />
            </AdminRoute>
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
