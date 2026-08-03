import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

function MicrosoftLogo({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, completeSso, loginWithMicrosoft, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const ssoError = params.get("ssoError");

    if (ssoError) {
      setError(decodeURIComponent(ssoError));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!token) return;

    setSubmitting(true);
    setError("");

    completeSso(token)
      .then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate("/", { replace: true });
      })
      .catch((err) => {
        console.error("Microsoft SSO completion failed:", err);
        localStorage.removeItem("token");
        setError(
          "Microsoft sign-in completed, but the portal session could not be created."
        );
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [completeSso, navigate]);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed.";

      if (String(msg).toLowerCase().includes("pending")) {
        setError("Your account is still awaiting admin approval.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={`${import.meta.env.BASE_URL}atd-logo.png`}
            alt="ATD Alliance"
            className="mb-4 h-14 w-auto object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-950">
            ATD Alliance Portal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            IT Helpdesk Management System
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={loginWithMicrosoft}
          disabled={submitting}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <MicrosoftLogo />
          Sign in with Microsoft 365
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            or use local login
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="you@atdalliance.co.za"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign Up
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ATD Alliance · portal.atdalliance.co.za
        </p>
      </div>
    </div>
  );
}
