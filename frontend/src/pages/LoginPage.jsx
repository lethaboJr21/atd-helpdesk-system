import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/api";

function MicrosoftLogo({ className = "h-5 w-5" }) {
  return <svg className={className} viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>;
}

export default function LoginPage() {
  const { login, completeSso, loginWithMicrosoft, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || sessionStorage.getItem("atd.helpdesk.returnTo") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [route, setRoute] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(location.search);
    const token = parameters.get("token");
    const ssoError = parameters.get("ssoError");
    if (ssoError) setError(ssoError);
    if (token) {
      setBusy(true);
      completeSso(token).then(() => navigate(returnTo, { replace: true })).catch(() => setError("Microsoft sign-in could not create the portal session.")).finally(() => setBusy(false));
    }
  }, [completeSso, location.search, navigate, returnTo]);

  if (!loading && isAuthenticated) return <Navigate to={returnTo} replace/>;

  const reset = () => {
    setRoute(null);
    setSelected(null);
    setPassword("");
    setShowPassword(false);
    setError("");
  };

  async function next(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await authApi.loginOptions(identifier);
      const data = response.data;
      const options = Array.isArray(data.options) ? data.options : [];
      setRoute(data);
      if (data.route === "unavailable") {
        setError(data.message || "Sign-in is unavailable for this account.");
        return;
      }
      if (options.length === 1 && options[0] === "microsoft") {
        sessionStorage.setItem("atd.helpdesk.returnTo", returnTo);
        loginWithMicrosoft(data.loginHint);
        return;
      }
      if (options.length === 1 && options[0] === "local_password") setSelected("local_password");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Sign-in options could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(identifier, password);
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.error || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  const options = Array.isArray(route?.options) ? route.options : [];
  return <div className="flex min-h-screen items-center justify-center bg-[#172b57] px-4"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"><img src="/helpdesk/atd-helpdesk-logo.png?v=7" alt="ATD Helpdesk" className="mx-auto w-full max-w-[260px]"/><h1 className="mt-4 text-center text-xl font-black text-slate-900">Welcome back</h1><p className="mt-1 text-center text-sm text-slate-500">Sign in to ATD Helpdesk</p>{error ? <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0"/><span>{error}</span></div> : null}{!route ? <form onSubmit={next} className="mt-5 space-y-4"><label className="block text-sm font-bold text-slate-700">Work email, local email or station username<input value={identifier} onChange={event => setIdentifier(event.target.value)} required autoFocus autoComplete="username" className="mt-1 w-full rounded-xl border px-4 py-3" placeholder="name@atdalliance.co.za or station username"/></label><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-60">{busy ? "Checking..." : "Next"}</button></form> : <div className="mt-5"><button type="button" onClick={reset} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600"><ArrowLeft className="h-4 w-4"/>Use another account</button><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{identifier}</div>{!selected ? <div className="mt-4 space-y-3"><p className="text-sm font-bold text-slate-700">Choose how you want to sign in</p>{options.includes("microsoft") ? <button type="button" onClick={() => { sessionStorage.setItem("atd.helpdesk.returnTo", returnTo); loginWithMicrosoft(route.loginHint); }} className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-slate-50"><MicrosoftLogo/><span><b className="block">Continue with Microsoft</b><span className="text-xs text-slate-500">Sign in using Microsoft SSO</span></span></button> : null}{options.includes("local_password") ? <button type="button" onClick={() => setSelected("local_password")} className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-slate-50"><KeyRound className="h-5 w-5 text-blue-600"/><span><b className="block">Sign in with password</b><span className="text-xs text-slate-500">Use the local password registered for this account</span></span></button> : null}</div> : <form onSubmit={submit} className="mt-4 space-y-4"><label className="block text-sm font-bold text-slate-700">Password<div className="relative mt-1"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required autoFocus autoComplete="current-password" className="w-full rounded-xl border px-4 py-3 pr-12"/><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}</button></div></label><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-60">{busy ? "Signing in..." : "Sign in with password"}</button>{options.length > 1 ? <button type="button" onClick={() => { setSelected(null); setPassword(""); }} className="w-full text-sm font-bold text-blue-600">Other sign-in options</button> : null}</form>}</div>}<p className="mt-5 text-center text-sm text-slate-500">Need a local or station account? <Link to="/signup" className="font-bold text-blue-600">Sign Up</Link></p></div></div>;
}
