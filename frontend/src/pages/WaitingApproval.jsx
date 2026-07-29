import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock3,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../hooks/useAuth";
import {
  authApi,
} from "../services/api";

const APPROVAL_CHECK_INTERVAL_MS = 10000;

export default function WaitingApproval() {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const checkApprovalStatus = useCallback(async () => {
    setChecking(true);
    setMessage("");

    try {
      const response = await authApi.me();

      const currentUser =
        response.data.user ||
        response.data;

      const isApproved =
        Boolean(currentUser?.approved);

      const isActive =
        currentUser?.status === "active";

      const isArchived =
        Boolean(currentUser?.archived_at);

      if (
        isApproved &&
        isActive &&
        !isArchived
      ) {
        setMessage(
          "Access approved. Redirecting..."
        );

        window.location.assign(
          "/helpdesk/"
        );

        return;
      }

      if (isArchived) {
        setMessage(
          "This account has been archived. Please contact an administrator."
        );

        return;
      }

      if (currentUser?.status === "inactive") {
        setMessage(
          "This account is currently inactive. Please contact an administrator."
        );

        return;
      }

      setMessage(
        "Approval is still pending."
      );
    } catch (error) {
      setMessage(
        error?.response?.data?.error ||
          "The account status could not be checked."
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkApprovalStatus();

    const intervalId = window.setInterval(
      checkApprovalStatus,
      APPROVAL_CHECK_INTERVAL_MS
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkApprovalStatus]);

  const handleSignOut = async () => {
    await logout();

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto inline-flex rounded-2xl bg-amber-100 p-4 text-amber-700">
          <Clock3 className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
          Approval Pending
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          The account has been created successfully.
          Access will become available after an
          administrator approves and activates the
          account.
        </p>

        {user?.email && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Signed-in account
            </p>

            <p className="mt-1 break-all font-semibold text-slate-900">
              {user.email}
            </p>
          </div>
        )}

        {message && (
          <div
            className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800"
            aria-live="polite"
          >
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={checkApprovalStatus}
            disabled={checking}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={
                checking
                  ? "h-4 w-4 animate-spin"
                  : "h-4 w-4"
              }
            />

            {checking
              ? "Checking..."
              : "Check Access Again"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Status is checked automatically every 10 seconds.
        </div>
      </div>
    </div>
  );
}