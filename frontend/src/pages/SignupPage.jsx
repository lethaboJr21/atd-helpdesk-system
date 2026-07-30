import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "../services/api";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) return setError("Full name is required.");
    if (!email) return setError("Email address is required.");
    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }

    setLoading(true);

    try {
      const response = await authApi.signup({ name, email, password: form.password });
      const pendingAccount = {
        id: response.data.user?.id || null,
        name,
        email,
        message: response.data.message,
      };

      sessionStorage.setItem("pendingSignup", JSON.stringify(pendingAccount));
      navigate("/waiting-approval", {
        replace: true,
        state: { pendingAccount },
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#172b57] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-950">Create Account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Request local access if Microsoft 365 sign-in is unavailable.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Full Name</label>
            <input value={form.name} onChange={updateField("name")} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Your full name" autoComplete="name" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Email Address</label>
            <input type="email" value={form.email} onChange={updateField("email")} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Work or personal email" autoComplete="email" />
            <p className="mt-1 text-xs text-slate-500">Employees without a company email may use an accessible personal address. IT will verify the request.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
            <input type="password" value={form.password} onChange={updateField("password")} required minLength={8} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Create a password" autoComplete="new-password" />
          </div>

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Submitting..." : "Request Access"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
