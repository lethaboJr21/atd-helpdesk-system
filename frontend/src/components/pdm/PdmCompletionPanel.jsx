import { useEffect, useMemo, useState } from "react";
import { Download, History, Save } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { processEngineeringWorkspaceApi } from "../../services/api";

const blank = { plant: "", line: "", station: "", machine: "", product_family: "", process_stage: "", issue_type: "", production_impact: "" };
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900";
const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none dark:bg-slate-800";

const saveBlob = (data, name) => {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

function SlaComplianceCharts({ report }) {
  const tickets = report?.tickets || [];
  const chartData = useMemo(() => {
    const responseBreached = tickets.filter((ticket) => Boolean(ticket.response_breached)).length;
    const resolutionBreached = tickets.filter((ticket) => Boolean(ticket.resolution_breached)).length;
    return [
      { name: "Response SLA", Compliant: tickets.length - responseBreached, Breached: responseBreached },
      { name: "Resolution SLA", Compliant: tickets.length - resolutionBreached, Breached: resolutionBreached },
    ];
  }, [tickets]);
  if (!tickets.length) {
    return <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">SLA compliance charts appear once the completion report is reviewed.</p>;
  }
  const responseBreached = chartData[0].Breached;
  const resolutionBreached = chartData[1].Breached;
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Compliant" stackId="sla" fill="#0e7490" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Breached" stackId="sla" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">{responseBreached} response breaches · {resolutionBreached} resolution breaches across {tickets.length} reviewed records.</p>
    </div>
  );
}

export default function PdmCompletionPanel({ tickets = [] }) {
  const [activity, setActivity] = useState([]);
  const [report, setReport] = useState(null);
  const [ticketId, setTicketId] = useState("");
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");

  useEffect(() => { processEngineeringWorkspaceApi.activity().then((r) => setActivity(r.data.activity || [])); }, []);

  const choose = async (id) => {
    setTicketId(id);
    const r = await processEngineeringWorkspaceApi.ticketContext(id);
    setForm({ ...blank, ...(r.data.context || {}) });
  };
  const save = async () => {
    await processEngineeringWorkspaceApi.saveTicketContext(ticketId, form);
    setMessage("PDM context saved and audit-ready.");
  };
  const preview = async () => setReport((await processEngineeringWorkspaceApi.completionReport()).data);
  const download = async () => {
    const r = await processEngineeringWorkspaceApi.downloadExport();
    saveBlob(r.data, "ATD_PDM.xlsx");
  };

  return (
    <section className="grid gap-6 2xl:grid-cols-2">
      <article className={card}>
        <p className="text-xs font-black uppercase tracking-[.17em] text-cyan-700">Structured context</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><Save className="h-4 w-4" />PDM ticket context</h2>
        <select className={`mt-4 w-full ${inputClass}`} value={ticketId} onChange={(e) => choose(e.target.value)}>
          <option value="">Select a PDM ticket</option>
          {tickets.map((t) => <option key={t.id} value={t.id}>{t.ticket_ref} - {t.title}</option>)}
        </select>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.keys(blank).map((k) => (
            <input key={k} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k.replaceAll("_", " ")} className={inputClass} />
          ))}
        </div>
        <button disabled={!ticketId} onClick={save} className="mt-4 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save context</button>
        {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      </article>
      <article className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.17em] text-indigo-700">Completion report</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950"><History className="h-4 w-4" />Review and export</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={preview} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Review export</button>
            {report && <button onClick={download} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Download className="mr-1 inline h-3 w-3" />XLSX</button>}
          </div>
        </div>
        {report && <p className="mt-3 text-xs text-slate-500">Reviewed {report.tickets.length} records including SLA breach and structured context detail.</p>}
        <div className="mt-4"><SlaComplianceCharts report={report} /></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.17em] text-slate-500">Recent PDM activity</p>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto">
          {activity.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <a href={`/helpdesk/tickets/${a.ticket_id}`} className="font-bold text-cyan-700">{a.ticket_ref}</a> · {a.action}
              <div className="text-xs text-slate-500">{a.actor_name || "System"} · {new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
          {!activity.length && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No PDM activity recorded yet.</p>}
        </div>
      </article>
    </section>
  );
}
