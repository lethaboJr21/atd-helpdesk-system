import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Factory, ShieldCheck } from "lucide-react";
import { lineIntakeApi } from "../services/api";

const STATIONS = [
  "MES",
  "PLC-RSB assembly",
  "PLC-SRS - Finished RSB Electronic Storage with Robot lift",
  "Qmuzik App on the line",
  "Blowmoulding station",
  "RSB",
  "Thermoforming",
  "Checking Fixtures",
  "Jigs tools",
  "Other",
];

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

export default function GuestLineIntakePage() {
  const [identity, setIdentity] = useState({ firstName: "", lastName: "", employeeNumber: "" });
  const [verifiedName, setVerifiedName] = useState("");
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [supervisors, setSupervisors] = useState([]);
  const [workspace, setWorkspace] = useState("");
  const [catalogue, setCatalogue] = useState([]);
  const [selection, setSelection] = useState({ teamLeaderId: "", supervisorId: "", station: "", catalogueItemId: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    lineIntakeApi.getSupervisors()
      .then(({ data }) => { if (active) setSupervisors(data); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || "Production supervisors could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workspace) {
      setCatalogue([]);
      return undefined;
    }
    let active = true;
    setCatalogue([]);
    setSelection((current) => ({ ...current, catalogueItemId: "" }));
    lineIntakeApi.getCatalogue(workspace)
      .then(({ data }) => { if (active) setCatalogue(data); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error || "The station issue catalogue could not be loaded.");
      });
    return () => { active = false; };
  }, [workspace]);

  const updateIdentity = (field) => (event) => {
    setIdentity((current) => ({ ...current, [field]: event.target.value }));
  };
  const updateSelection = (field) => (event) => {
    setSelection((current) => ({ ...current, [field]: event.target.value }));
  };

  const loadLinePeople = async () => {
    const [leaders, supervisorsResult] = await Promise.all([lineIntakeApi.getTeamLeaders(), lineIntakeApi.getSupervisors()]);
    setTeamLeaders(leaders.data || []);
    setSupervisors(supervisorsResult.data || []);
  };
  const verifyOperator = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await lineIntakeApi.register(identity);
      setVerifiedName(data.name);
      setTeamLeaderId(String(data.currentTeamLeader?.team_leader_user_id || ""));
      await loadLinePeople();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Operator verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitIssue = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await lineIntakeApi.stage({
        ...identity,
        ...selection,
        workspace,
        catalogueItemId: Number(selection.catalogueItemId),
      });
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "The issue could not be sent for supervisor approval.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-300"><Factory className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">ATD Helpdesk Â· Line Support</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Report a station issue</h1>
            </div>
          </div>
          <Link className="text-sm font-bold text-slate-300 hover:text-white" to="/login">Employee sign in</Link>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white p-5 shadow-2xl sm:p-8">
          <div className="flex gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Your work ID identifies you for this station-only flow. It does not open the employee portal. A ticket is created only after your selected supervisor confirms by email and work ID.</p>
          </div>

          {error && <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</p>}
          {message && <p role="status" className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</p>}

          {!verifiedName ? (
            <form onSubmit={verifyOperator} className="mt-6 space-y-4">
              <h2 className="text-lg font-black">1. Verify operator</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-bold text-slate-700">First name<input className={inputClass} autoComplete="given-name" value={identity.firstName} onChange={updateIdentity("firstName")} required /></label>
                <label className="text-sm font-bold text-slate-700">Surname<input className={inputClass} autoComplete="family-name" value={identity.lastName} onChange={updateIdentity("lastName")} required /></label>
                <label className="text-sm font-bold text-slate-700">Work ID<input className={inputClass} autoComplete="off" value={identity.employeeNumber} onChange={updateIdentity("employeeNumber")} required /></label>
              </div>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Verifying..." : "Continue"}<ArrowRight className="h-4 w-4" /></button>
            </form>
          ) : (
            <form onSubmit={submitIssue} className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black">2. Select the issue</h2>
                <p className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Verified: {verifiedName}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">Support team
                  <select className={inputClass} value={workspace} onChange={(event) => setWorkspace(event.target.value)} required>
                    <option value="">Choose IT or PDM</option><option value="IT">IT Â· Network support</option><option value="PDM">PDM Â· Process and line support</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-slate-700">Station
                  <select className={inputClass} value={selection.station} onChange={updateSelection("station")} required>
                    <option value="">Choose a station</option>{STATIONS.map((station) => <option key={station}>{station}</option>)}
                  </select>
                </label>
              </div>
                <label className="block text-sm font-bold text-slate-700">Team Leader
                  <select className={inputClass} value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)} required>
                    <option value="">Select your Team Leader</option>{teamLeaders.map((person) => <option key={person.id} value={person.id}>{person.name}{person.job_title ? ` · ${person.job_title}` : ""}</option>)}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">Choose the Production employee responsible for your team. This is remembered for future line reports.</span>
                </label>              <label className="block text-sm font-bold text-slate-700">Supervisor
                <select className={inputClass} value={selection.supervisorId} onChange={updateSelection("supervisorId")} required>
                  <option value="">Choose your supervisor</option>{supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">Issue
                <select className={inputClass} value={selection.catalogueItemId} onChange={updateSelection("catalogueItemId")} required disabled={!workspace || !catalogue.length}>
                  <option value="">{workspace ? "Choose an issue" : "Choose a support team first"}</option>
                  {catalogue.map((item) => <option key={item.id} value={item.id}>{[item.category, item.sub_category, item.item_name].filter(Boolean).join(" / ")} Â· {item.default_priority}</option>)}
                </select>
              </label>
              {!message && (
                <button disabled={busy || !catalogue.length} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/20 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? "Sending for approval..." : "Notify supervisor"}<ArrowRight className="h-4 w-4" />
                </button>
              )}
              <p className="text-xs text-slate-500">The catalogue generates the issue summary. No free-text form is needed. The ticket stays staged until supervisor confirmation.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export function GuestLineApprovalPage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await lineIntakeApi.approve({ token, supervisorEmployeeNumber: employeeNumber });
      setMessage(`${data.message} Reference: ${data.ticketRef}.`);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "The staged ticket could not be approved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">Supervisor confirmation</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Verify and open line ticket</h1>
        <p className="mt-2 text-sm text-slate-600">Confirm this request using your work ID. The one-time link expires after 30 minutes.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{message}</p> : (
          <form onSubmit={approve} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-slate-700">Your work ID<input className={inputClass} value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} autoComplete="off" required /></label>
            <button disabled={busy || !token} className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Confirming..." : token ? "Confirm and open ticket" : "Approval link is invalid"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
