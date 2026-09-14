import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Download, FileText, LogOut, ShieldCheck } from "lucide-react";
import LegalDocumentViewer from "../components/legal/LegalDocumentViewer";
import { termsApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const LEGAL_PACK_URL = "/helpdesk/legal/ATD_Alliance_IT_Helpdesk_Legal_and_Privacy_Pack_v1.0.pdf";

export default function TermsAcceptancePage() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const storedReturnTo = sessionStorage.getItem("atd.helpdesk.returnTo");
  const candidateReturnTo = location.state?.returnTo || storedReturnTo || "/";
  const returnTo = candidateReturnTo.startsWith("/") && !candidateReturnTo.startsWith("//")
    ? candidateReturnTo
    : "/";
  sessionStorage.setItem("atd.helpdesk.returnTo", returnTo);
  const [state, setState] = useState(null);
  const [checked, setChecked] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    termsApi.getCurrent()
      .then((response) => {
        if (!active) return;
        const data = response.data;
        setState(data);
        setChecked(Object.fromEntries((data.outstanding || []).map((document) => [document.id, false])));
      })
      .catch((requestError) => {
        if (active) setError(requestError?.response?.data?.error || "Legal documents could not be loaded. Portal access remains protected until the documents are available.");
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ returnTo }} />;
  if (busy) return <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 text-white"><div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 font-semibold shadow-2xl backdrop-blur">Loading legal documents...</div></div>;

  const documents = state?.outstanding || [];
  const allAccepted = documents.length > 0 && documents.every((document) => checked[document.id]);
  const accept = async () => {
    setBusy(true); setError("");
    try { await termsApi.accept(documents.map((document) => document.id)); sessionStorage.removeItem("atd.helpdesk.returnTo"); navigate(returnTo, { replace: true }); }
    catch (requestError) { setError(requestError?.response?.data?.error || "Acceptance could not be recorded."); setBusy(false); }
  };

  return <div className="min-h-screen bg-[linear-gradient(160deg,#07111f_0%,#0d2447_48%,#07111f_100%)] px-4 py-8 text-slate-100">
    <main className="mx-auto max-w-5xl">
      <header className="relative overflow-hidden rounded-3xl border border-blue-300/20 bg-[#10264a]/90 p-6 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div><ShieldCheck className="h-9 w-9 text-sky-300" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-sky-200">ATD Alliance internal portal</p><h1 className="mt-1 text-3xl font-extrabold">Terms, privacy and storage acknowledgement</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Review each current document and download the complete legal pack. Access is available after every outstanding version is accepted.</p></div>
          <a href={LEGAL_PACK_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-400/20"><Download className="h-4 w-4" />Download legal pack (PDF)</a>
        </div>
      </header>

      {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-950/60 p-4 text-rose-100">{error}</div> : null}
      {!documents.length && !error ? <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-[#10253a] p-6"><CheckCircle2 className="h-7 w-7 text-emerald-400" /><p className="mt-2 font-bold">No outstanding legal documents.</p><button onClick={() => { sessionStorage.removeItem("atd.helpdesk.returnTo"); navigate(returnTo, { replace: true }); }} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500">Continue</button></div> : null}

      {documents.length ? <div className="mt-5 space-y-5">{documents.map((document) => <article key={document.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0f1d2e] shadow-xl"><div className="flex items-center gap-2 border-b border-slate-700 bg-[#13253a] px-5 py-3 text-sm font-bold"><FileText className="h-4 w-4 text-sky-300" />{document.title}<span className="ml-auto rounded-full bg-blue-500/15 px-2.5 py-1 text-xs text-blue-200">Version {document.version}</span></div><div className="bg-white text-slate-900"><LegalDocumentViewer document={document} /></div><label className="flex cursor-pointer gap-3 border-t border-slate-700 p-4 font-semibold text-slate-100 hover:bg-white/5"><input type="checkbox" checked={Boolean(checked[document.id])} onChange={(event) => setChecked((current) => ({ ...current, [document.id]: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-500 text-blue-600 focus:ring-blue-500" /><span>I have read and accept <strong>{document.title}</strong>, version {document.version}.</span></label></article>)}</div> : null}

      {documents.length ? <div className="sticky bottom-4 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-[#0b1728]/95 p-4 shadow-2xl backdrop-blur"><button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 font-bold text-slate-200 hover:bg-white/5"><LogOut className="h-4 w-4" />Sign out</button><div className="flex items-center gap-3"><span className="text-sm text-slate-400">{Object.values(checked).filter(Boolean).length} of {documents.length} accepted</span><button onClick={accept} disabled={!allAccepted || busy} className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Recording acceptance..." : "Accept and continue"}</button></div></div> : null}
    </main>
  </div>;
}
