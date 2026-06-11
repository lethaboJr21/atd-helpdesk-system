import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

export default function WaitingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {/* Waiting icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>

        {/* Page title */}
        <h1 className="text-2xl font-bold text-slate-950">
          Approval Pending
        </h1>

        {/* User instruction */}
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account has been created successfully.
          <br />
          Please wait for an administrator to approve your access before signing
          in.
        </p>

        {/* Back to login */}
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}