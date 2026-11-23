import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Workflow,
  XCircle,
} from "lucide-react";

import AdminUniversalHeader from "../components/admin/AdminUniversalHeader";
import { adminControlsApi, pulseApi } from "../services/api";

const HEALTH_REFRESH_MS = 30000;
const MAX_HEALTH_SAMPLES = 500;
const HEALTH_SERVICES = [
  { key: "overall", label: "Helpdesk", icon: Activity },
  { key: "api", label: "API reachability", icon: CircleDot },
  { key: "database", label: "Database", icon: Database },
  { key: "microsoft_directory", label: "Microsoft directory", icon: GitBranch },
  { key: "tickets", label: "Ticket store", icon: Workflow },
];

const WORKFLOW_STEPS = [
  {
    id: "request-intake",
    label: "Request intake",
    input: "Employee-submitted request (synthetic)",
    output: "Request envelope + trace ID",
  },
  {
    id: "identity-context",
    label: "Identity & department context",
    input: "Request envelope",
    output: "Validated caller and department context",
  },
  {
    id: "workspace-routing",
    label: "Workspace routing",
    input: "Department + service category",
    output: "Department workspace selected",
  },
  {
    id: "ticket-persistence",
    label: "Ticket persistence",
    input: "Validated request + workspace",
    output: "Synthetic ticket reference allocated",
  },
  {
    id: "assignment-notification",
    label: "Assignment & notification",
    input: "Ticket reference + support queue",
    output: "Assignment and notification queued",
  },
];

function statusTone(status) {
  if (status === "healthy" || status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "unhealthy" || status === "failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "degraded" || status === "running") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "The request failed.";
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function availability(samples, serviceKey) {
  let observed = 0;
  let healthy = 0;

  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const elapsed = samples[index + 1].timestamp - current.timestamp;
    if (elapsed <= 0 || elapsed > HEALTH_REFRESH_MS * 2.5) continue;

    const status = current.statuses[serviceKey];
    if (!status || status === "unknown") continue;
    observed += elapsed;
    if (status === "healthy") healthy += elapsed;
  }

  return observed ? `${((healthy / observed) * 100).toFixed(2)}%` : "Collecting";
}

function getDowntimeEvents(samples) {
  const events = [];

  for (const service of HEALTH_SERVICES) {
    let active = null;
    for (const sample of samples) {
      const status = sample.statuses[service.key];
      if (status === "unhealthy" || status === "degraded") {
        if (!active) active = { service: service.label, startedAt: sample.timestamp };
        active.lastSeenAt = sample.timestamp;
      } else if (status === "healthy" && active) {
        events.push({
          ...active,
          endedAt: sample.timestamp,
          ongoing: false,
        });
        active = null;
      }
    }

    if (active) {
      events.push({ ...active, endedAt: Date.now(), ongoing: true });
    }
  }

  return events.sort((left, right) => right.startedAt - left.startedAt).slice(0, 8);
}

function HealthStatusCard({ service, status, samples }) {
  const Icon = service.icon;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-800">{service.label}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone(status)}`}>
          {status || "unknown"}
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-slate-950">{availability(samples, service.key)}</p>
      <p className="mt-1 text-xs text-slate-500">Observed availability during this page session</p>
    </article>
  );
}

export default function WorkflowObservabilityPage() {
  const [failureStage, setFailureStage] = useState("workspace-routing");
  const [trace, setTrace] = useState(null);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthSamples, setHealthSamples] = useState([]);
  const healthRequestInFlight = useRef(false);

  const recordHealth = useCallback((payload, apiReachable) => {
    const statuses = {
      overall: payload?.status || (apiReachable ? "unknown" : "unhealthy"),
      api: apiReachable ? "healthy" : "unhealthy",
      database: payload?.checks?.database?.status || "unknown",
      microsoft_directory: payload?.checks?.microsoft_directory?.status || "unknown",
      tickets: payload?.checks?.tickets?.status || "unknown",
    };
    const sample = { timestamp: Date.now(), statuses };
    setHealth(payload || null);
    setHealthSamples((current) => [...current, sample].slice(-MAX_HEALTH_SAMPLES));
  }, []);

  const loadHealth = useCallback(async () => {
    if (healthRequestInFlight.current) return;
    healthRequestInFlight.current = true;
    setHealthLoading(true);
    setHealthError("");

    try {
      const response = await adminControlsApi.getHealth();
      recordHealth(response.data, true);
    } catch (error) {
      const payload = error?.response?.data;
      if (payload?.checks) {
        recordHealth(payload, true);
        setHealthError(getErrorMessage(error));
      } else {
        recordHealth(null, false);
        setHealthError(getErrorMessage(error));
      }
    } finally {
      setHealthLoading(false);
      healthRequestInFlight.current = false;
    }
  }, [recordHealth]);

  useEffect(() => {
    loadHealth();
    const timer = window.setInterval(loadHealth, HEALTH_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadHealth]);

  const currentStatuses = healthSamples[healthSamples.length - 1]?.statuses || {};
  const downtimeEvents = useMemo(() => getDowntimeEvents(healthSamples), [healthSamples]);

  const runTrace = async (injectFailure) => {
    if (simulationBusy) return;
    setSimulationBusy(true);
    setCaptureError("");

    const traceId = `sim-${Date.now().toString(36)}`;
    const startedAt = new Date().toISOString();
    const completedSteps = [];
    setTrace({ traceId, status: "running", startedAt, steps: [], correlationId: null });

    for (const stage of WORKFLOW_STEPS) {
      const failed = injectFailure && stage.id === failureStage;
      const step = {
        id: stage.id,
        label: stage.label,
        status: "running",
        input: stage.input,
        output: "Processing synthetic data…",
        occurredAt: new Date().toISOString(),
      };
      setTrace((current) => ({ ...current, steps: [...completedSteps, step] }));
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      const finishedStep = {
        ...step,
        status: failed ? "failed" : "completed",
        output: failed ? "Blocked — downstream stages did not run" : stage.output,
        finishedAt: new Date().toISOString(),
      };
      completedSteps.push(finishedStep);
      setTrace((current) => ({
        ...current,
        status: failed ? "failed" : "running",
        steps: [...completedSteps],
      }));

      if (failed) {
        const message = `SIMULATED: Workflow stopped at ${stage.label}. No live request or employee data was used.`;
        try {
          const response = await pulseApi.logError({
            error: {
              name: "SimulatedWorkflowFailure",
              message,
              stack: `SimulatedWorkflowFailure: ${message}\n    at ${stage.id} (workflow-simulator)`,
              sourceFile: `simulated://helpdesk-request/${stage.id}/${traceId}`,
              instrumentationMarker: "SIMULATED_WORKFLOW",
            },
            context: {
              source: "workflow_simulation",
              activeRoute: window.location.pathname,
              recentActionTrail: completedSteps.map((item) => ({
                stageId: item.id,
                stage: item.label,
                status: item.status,
                occurredAt: item.occurredAt,
                inputSummary: item.input,
                outputSummary: item.output,
              })),
              environmentMetadata: {
                simulated: true,
                traceId,
                workflow: "helpdesk-request",
                failedStage: stage.id,
              },
              isPartial: true,
              missingFields: ["downstreamWorkflowSteps"],
            },
          });
          const result = response.data || {};
          setTrace((current) => ({
            ...current,
            correlationId: result.correlationId || null,
            captureStatus: result.rateLimited ? "rate_limited" : result.buffered ? "buffered" : "captured",
          }));
          if (result.rateLimited) {
            setCaptureError("Pulse rate-limited the simulation snapshot; wait and try again.");
          }
        } catch (error) {
          setCaptureError(`The simulation ran, but Pulse could not record the snapshot: ${getErrorMessage(error)}`);
        } finally {
          setSimulationBusy(false);
        }
        return;
      }
    }

    setTrace((current) => ({ ...current, status: "completed", steps: [...completedSteps] }));
    setSimulationBusy(false);
  };

  return (
    <div className="portal-shell min-h-screen p-5 portal-title xl:p-8">
      <AdminUniversalHeader title="Workflow Observability" />
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--portal-primary)]">Developer tools</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Workflow Observability</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 portal-muted">
              Follow synthetic request data through workflow stages, inject a controlled failure,
              and review the service health observed by this browser.
            </p>
          </div>
          <Link to="/error-logger" className="rounded-xl border portal-border portal-surface-raised px-4 py-2.5 text-sm font-bold portal-copy">
            Open Pulse error snapshots
          </Link>
        </header>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Safe simulation</p>
          <p className="mt-1">
            Workflow data below is synthetic. Fault injection is recorded in Pulse with the
            <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5">SIMULATED_WORKFLOW</code>
            marker; it does not change tickets, services, or live system health.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-bold text-slate-950">Helpdesk request workflow</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Trace ID, stage input/output summaries, timestamps, failure point and Pulse correlation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="failure-stage">Inject failure at</label>
              <select
                id="failure-stage"
                value={failureStage}
                onChange={(event) => setFailureStage(event.target.value)}
                disabled={simulationBusy}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {WORKFLOW_STEPS.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              </select>
              <button
                type="button"
                disabled={simulationBusy}
                onClick={() => runTrace(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {simulationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Simulate failure
              </button>
              <button
                type="button"
                disabled={simulationBusy}
                onClick={() => runTrace(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Run healthy trace
              </button>
            </div>
          </div>

          {trace ? (
            <div className="mt-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-bold text-slate-700">{trace.traceId}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone(trace.status)}`}>{trace.status}</span>
                {trace.correlationId && (
                  <span className="text-xs text-slate-500">Pulse correlation: {trace.correlationId}</span>
                )}
                {trace.captureStatus === "buffered" && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Snapshot queued for persistence</span>
                )}
                {trace.correlationId && trace.captureStatus === "captured" && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">SIMULATED snapshot recorded</span>
                )}
              </div>
              <div className="space-y-2">
                {trace.steps.map((step, index) => {
                  const Icon = step.status === "completed" ? CheckCircle2 : step.status === "failed" ? XCircle : Loader2;
                  return (
                    <article key={`${trace.traceId}-${step.id}`} className={`rounded-xl border p-4 ${step.status === "failed" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${step.status === "completed" ? "text-emerald-600" : step.status === "failed" ? "text-red-600" : "animate-spin text-amber-600"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-bold text-slate-900">{index + 1}. {step.label}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${statusTone(step.status)}`}>{step.status}</span>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                            <p className="rounded-lg bg-slate-50 p-2"><strong>Input:</strong> {step.input}</p>
                            <p className="rounded-lg bg-slate-50 p-2"><strong>Output:</strong> {step.output}</p>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Started {new Date(step.occurredAt).toLocaleTimeString()}
                            {step.finishedAt ? ` · finished ${new Date(step.finishedAt).toLocaleTimeString()}` : ""}
                          </p>
                        </div>
                      </div>
                      {index < trace.steps.length - 1 && <ArrowDown className="ml-0.5 mt-2 h-4 w-4 text-slate-300" />}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Choose a failure stage or run the healthy path to create a synthetic trace.
            </div>
          )}
          {captureError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{captureError}</p>}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Live service health & downtime</h2>
              <p className="mt-1 text-sm text-slate-500">
                Polls every 30 seconds. Availability and outage history are observed in this browser session only.
              </p>
            </div>
            <button type="button" onClick={loadHealth} disabled={healthLoading} className="rounded-xl border portal-border portal-surface-raised px-3 py-2 text-sm font-bold">
              <RefreshCw className={`mr-2 inline h-4 w-4 ${healthLoading ? "animate-spin" : ""}`} />
              Refresh health
            </button>
          </div>

          {healthError && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {healthError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {HEALTH_SERVICES.map((service) => (
              <HealthStatusCard
                key={service.key}
                service={service}
                status={currentStatuses[service.key] || health?.status || "unknown"}
                samples={healthSamples}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-slate-600" />
              <h3 className="font-bold text-slate-950">Observed downtime events</h3>
              <span className="ml-auto text-xs text-slate-500">{healthSamples.length} health samples</span>
            </div>
            {downtimeEvents.length ? (
              <div className="mt-4 space-y-2">
                {downtimeEvents.map((event, index) => (
                  <div key={`${event.service}-${event.startedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-bold text-red-900">{event.service}</span>
                      <span className="text-red-800">{event.ongoing ? "Ongoing" : "Recovered"}</span>
                    </div>
                    <span className="text-xs text-red-800">
                      First observed {new Date(event.startedAt).toLocaleString()} · {formatDuration(event.endedAt - event.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {healthLoading ? "Waiting for the first health check…" : "No unhealthy or degraded intervals observed in this session."}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
