import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage.jsx";
import ProductionDashboard from "./pages/ProductionDashboard";
import AdminUsers from "./pages/AdminUsers";
import WaitingApproval from "./pages/WaitingApproval";
import TicketWorkspace from "./pages/TicketWorkspace";
import { AuthProvider, useAuth } from "./context/AuthContext";
import OperationsHubEmbed from "./pages/OperationsHubEmbed";
import TicketDetailPage from "./pages/TicketDetailPage";

function getModuleBase() {
  const path = window.location.pathname.toLowerCase();

  if (path.startsWith("/production")) {
    return "/production";
  }

  return "/helpdesk";
}

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.assign(to);
  }, [to]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-sm font-semibold text-slate-600">
        Redirecting...
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function AppRoutes({ moduleBase }) {
  const isProductionModule = moduleBase === "/production";

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
          <PrivateRoute>
            <WaitingApproval />
          </PrivateRoute>
        }
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            {isProductionModule ? <ProductionDashboard /> : <Dashboard />}
          </PrivateRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            {isProductionModule ? <ProductionDashboard /> : <Dashboard />}
          </PrivateRoute>
        }
      />

      {/* If user is under /helpdesk and clicks Production, send them to /production */}
      <Route
        path="/production"
        element={<ExternalRedirect to="/production" />}
      />

      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <AdminUsers />
          </PrivateRoute>
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
        path="/tickets/:id"
        element={
          <PrivateRoute>
            <TicketDetailPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/operations-hub"
        element={
          <PrivateRoute>
            <OperationsHubEmbed />
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const moduleBase = getModuleBase();

  return (
    <AuthProvider>
      <BrowserRouter basename={moduleBase}>
        <AppRoutes moduleBase={moduleBase} />
      </BrowserRouter>
    </AuthProvider>
  );
}