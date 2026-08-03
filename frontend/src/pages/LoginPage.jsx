import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef1f8] px-4 py-8 font-[DM_Sans,system-ui,sans-serif]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#152349_0%,#152349_38%,#eef1f8_38%)]"
      />

      <div className="relative z-10 w-full max-w-[480px]">
        <div className="rounded-[20px] bg-white px-8 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.04)] sm:px-12">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src={`${import.meta.env.BASE_URL}atd-logo.png`}
              alt="ATD Alliance"
              className="mb-4 h-14 w-auto object-contain"
            />
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0d1829]">
              IT Helpdesk
            </h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
          </div>

          {error ? (
            <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={loginWithMicrosoft}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#152349] px-4 py-[15px] text-[15px] font-bold text-white shadow-[0_2px_12px_rgba(21,35,73,0.3)] transition hover:bg-[#0d1829] hover:-translate-y-px disabled:opacity-60"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              OR
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="username"
                  className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 py-[13px] pl-11 pr-4 text-sm text-[#0d1829] outline-none transition focus:border-[#3b99fc] focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,153,252,0.1)]"
                  placeholder="you@atdalliance.co.za"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 py-[13px] pl-11 pr-11 text-sm text-[#0d1829] outline-none transition focus:border-[#3b99fc] focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,153,252,0.1)]"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full rounded-xl border-[1.5px] border-[#d1d9e8] bg-white py-3.5 text-sm font-bold text-[#152349] transition hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-semibold text-[#1a5fd1] hover:underline">
              Sign Up
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Need access?{" "}
          <a
            href="mailto:itsupport@atdalliance.co.za"
            className="font-semibold text-[#1a5fd1] hover:underline"
          >
            Contact IT
          </a>
          <span className="mx-2">·</span>
          © {new Date().getFullYear()} ATD Alliance
        </p>
      </div>
    </div>
  );
}
