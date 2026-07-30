import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/api";

const APPROVAL_CHECK_INTERVAL_MS = 10000;

function readStoredPendingAccount() {
  try {
    return JSON.parse(sessionStorage.getItem("pendingSignup") || "null");
  } catch {
    return null;
  }
}

export default function WaitingApproval() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loginWithMicrosoft } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const pendingAccount = useMemo(
    () => location.state?.pendingAccount || readStoredPendingAccount(),
    [location.state]
  );
  const displayedEmail = user?.email || pendingAccount?.email || "";
  const hasSession = Boolean(user && localStorage.getItem("token"));

  const checkApprovalStatus = useCallback(async () => {
    if (!hasSession) {
      setMessage("Sign in again after an administrator approves your request.");
      return;
    }

    setChecking(true);
    setMessage("");

    try {
      const response = await authApi.me();
      const currentUser = response.data.user || response.data;

      if (currentUser?.approved && currentUser?.status === "active" && !currentUser?.archived_at) {
        sessionStorage.removeItem("pendingSignup");
        setMessage("Access approved. Redirecting...");
        window.location.assign("/helpdesk/");
        return;
      }

      if (currentUser?.archived_at) {
        setMessage("This account has been archived. Please contact IT.");
      } else if (currentUser?.status === "inactive" && currentUser?.approved) {
        setMessage("This account is deactivated. Please contact IT to restore access.");
      } else {
        setMessage("Approval is still pending.");
      }
    } catch (error) {
      setMessage(error?.response?.data?.error || "The account status could not be checked.");
    } finally {
      setChecking(false);
    }
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession) return undefined;
    checkApprovalStatus();
    const intervalId = window.setInterval(checkApprovalStatus, APPROVAL_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [checkApprovalStatus, hasSession]);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#172b57] px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto inline-flex rounded-2xl bg-amber-100 p-4 text-amber-700">
          <Clock3 className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">Awaiting Approval</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The account request was submitted successfully. Administrators and authorised IT Infrastructure staff have been notified.
        </p>

        {displayedEmail && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Account request</p>
            <p className="mt-1 break-all font-semibold text-slate-900">{displayedEmail}</p>
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800" aria-live="polite">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {hasSession ? (
            <>
              <button type="button" onClick={checkApprovalStatus} disabled={checking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {checking ? "Checking..." : "Check Access Again"}
              </button>
              <button type="button" onClick={handleSignOut} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <button type="button" onClick={loginWithMicrosoft} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Sign in with Microsoft 365
              </button>
            </>
          )}
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">If the request is urgent or the account details are incorrect, contact the IT team for assistance.</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Your existing tickets and records remain protected.
        </div>
      </div>
    </div>
  );
}
