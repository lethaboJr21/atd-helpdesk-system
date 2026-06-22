import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProductionDashboard from "./pages/ProductionDashboard";
import AdminUsers from "./pages/AdminUsers";
import WaitingApproval from "./pages/WaitingApproval";
import TicketWorkspace from "./pages/TicketWorkspace";
import { AuthProvider, useAuth } from "./context/AuthContext";
import OperationsHubEmbed from "./pages/OperationsHubEmbed";
import TicketDetailPage from "./pages/TicketDetailPage";
/**
 * ✅ PrivateRoute
 * Protects routes that require a logged-in user.
 * If user is not authenticated, redirect to login.
 */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * ✅ PublicRoute
 * Prevents already logged-in users from going back to login/signup pages.
 */
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

/**
 * ✅ AppRoutes
 * Defines all frontend routes.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* ✅ Login page */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* ✅ Signup page */}
      <Route
        path="/Signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
{/* ✅ Waiting approval page after successful signup */}
      <Route
        path="/waiting-approval"
        element={
          <PrivateRoute>
        <WaitingApproval />
        </PrivateRoute>
      }
      />
      {/* ✅ Dashboard */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      {/* ✅ Production module */}
      <Route
        path="/production"
        element={
          <PrivateRoute>
            <ProductionDashboard />
          </PrivateRoute>
        }
      />

      {/* ✅ Admin user management */}
      <Route
        path="/admin/users"
        element={
          <PrivateRoute>
            <AdminUsers />
          </PrivateRoute>
        }
      />

      {/* ✅ Ticket workspace */}
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


      {/* ✅ Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * ✅ App root
 * Wraps app with authentication provider and browser router.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/helpdesk">
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}