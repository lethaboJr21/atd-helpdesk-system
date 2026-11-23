import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, Factory, Network, Wrench } from "lucide-react";
import { productionApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

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

export default function LineAssistancePanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [station, setStation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const notifySupervisor = async () => {
    if (!station) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await productionApi.requestSupervisorAssistance({ station });
      setNotice(`${response.data.supervisorsNotified} Production supervisor(s) have been alerted.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "The supervisor alert could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const openTicket = (workspace) => {
    if (!station) return;
    const department = String(user?.department || "").trim().toLowerCase();
    const jobTitle = String(user?.job_title || user?.title || "").trim().toLowerCase();
    const operatorProxy = workspace === "PDM" && department === "production" && jobTitle.includes("operator");
    const proxyQuery = operatorProxy ? "&beneficiary=other&pdmProxy=true" : "";
    navigate(`/incidents/new?workspace=${workspace}${proxyQuery}`, {
      state: {
        prefillDescription: `Station: ${station}`,
        workspaceTicketContext: {
          source: "Station Assistance",
          station,
        },
      },
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Line assistance</p>
          <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Get support at a station</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Select the station to alert a supervisor or open a ticket. IT and PDM show their own approved issue catalogues.
          </p>
        </div>
        <Factory className="h-6 w-6 text-cyan-700" aria-hidden="true" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Station or line
          <select
            aria-label="Station or line"
            value={station}
            onChange={(event) => {
              setStation(event.target.value);
              setNotice("");
              setError("");
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Select a station</option>
            {STATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={notifySupervisor}
          disabled={!station || busy}
          className="self-end rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bell className="mr-2 inline h-4 w-4" />
          {busy ? "Sending alert…" : "Supervisor needed"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold text-slate-700 dark:text-slate-200">Open a ticket:</span>
        <button
          type="button"
          onClick={() => openTicket("IT")}
          disabled={!station}
          className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Network className="mr-2 inline h-4 w-4" />
          IT support
        </button>
        <button
          type="button"
          onClick={() => openTicket("PDM")}
          disabled={!station}
          className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wrench className="mr-2 inline h-4 w-4" />
          PDM support
        </button>
      </div>

      {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</p>}
    </section>
  );
}
