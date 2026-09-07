import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Mail,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from "lucide-react";

import { companyCommunicationsApi } from "../services/api";

const DEFAULT_CAMPAIGN = {
  name: "ATD Helpdesk transition welcome",
  subject: "Welcome to ATD Helpdesk",
  htmlBody: `<div style="font-family:Segoe UI,Arial,sans-serif">
  <p>Hi {{name}},</p>
  <p>ATD is moving to the ATD Helpdesk portal for IT support and service requests.</p>
  <p><a href="{{signInUrl}}">Sign in to ATD Helpdesk</a></p>
  <p>Regards,<br/>ATD IT Department</p>
</div>`,
  textBody: `Hi {{name}},

ATD is moving to the ATD Helpdesk portal for IT support and service requests.

Sign in: {{signInUrl}}

Regards,
ATD IT Department`,
  audience: {
    type: "all",
    values: [],
  },
};

const TERMINAL_STATUSES = new Set([
  "sent",
  "partially_sent",
  "cancelled",
]);

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `campaign-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatStatus(value) {
  return String(value || "draft")
    .replaceAll("_", " ")
    .replace(/\w/g, (character) => character.toUpperCase());
}

export default function CompanyCommunicationsPanel() {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(DEFAULT_CAMPAIGN);
  const [preview, setPreview] = useState(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState(null);

  const loading = Boolean(busyAction);

  const loadCampaigns = useCallback(async () => {
    const response = await companyCommunicationsApi.getAll();
    setCampaigns(Array.isArray(response.data) ? response.data : []);
  }, []);

  useEffect(() => {
    loadCampaigns().catch((error) => {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Company communications could not be loaded."),
      });
    });
  }, [loadCampaigns]);

  const campaignCountText = useMemo(() => {
    if (campaigns.length === 1) return "1 campaign";
    return `${campaigns.length} campaigns`;
  }, [campaigns.length]);

  const runAction = async (actionName, action, successMessage) => {
    setBusyAction(actionName);
    setMessage(null);

    try {
      await action();
      await loadCampaigns();
      setMessage({ type: "success", text: successMessage });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "The communication action failed."),
      });
    } finally {
      setBusyAction("");
    }
  };

  const saveDraft = () => runAction(
    "save",
    async () => {
      await companyCommunicationsApi.create({
        ...form,
        idempotencyKey: createIdempotencyKey(),
      });
      setForm(DEFAULT_CAMPAIGN);
      setPreview(null);
    },
    "Communication draft saved. No email was sent."
  );

  const previewRecipients = () => runAction(
    "preview",
    async () => {
      const response = await companyCommunicationsApi.preview({
        audience: form.audience,
      });
      setPreview(response.data);
    },
    "Eligible recipient preview refreshed."
  );

  return (
    <div className="space-y-6">
      {message ? (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={
            message.type === "error"
              ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
          }
        >
          {message.text}
        </div>
      ) : null}

      <section className="rounded-2xl border portal-border portal-surface-raised p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--portal-primary)]">Governed communication</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Create a campaign draft</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 portal-muted">
              Saving a draft never sends email. Preview recipients before testing,
              scheduling or sending a campaign.
            </p>
          </div>
          <span className="rounded-full portal-surface-muted px-3 py-1 text-xs font-bold portal-copy">
            {campaignCountText}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-bold portal-copy">Campaign name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({
                ...current,
                name: event.target.value,
              }))}
              className="w-full rounded-xl border portal-border p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold portal-copy">Email subject</span>
            <input
              value={form.subject}
              onChange={(event) => setForm((current) => ({
                ...current,
                subject: event.target.value,
              }))}
              className="w-full rounded-xl border portal-border p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-bold portal-copy">HTML body</span>
            <textarea
              value={form.htmlBody}
              onChange={(event) => setForm((current) => ({
                ...current,
                htmlBody: event.target.value,
              }))}
              className="min-h-44 w-full rounded-xl border portal-border p-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-bold portal-copy">Plain-text body</span>
            <textarea
              value={form.textBody}
              onChange={(event) => setForm((current) => ({
                ...current,
                textBody: event.target.value,
              }))}
              className="min-h-36 w-full rounded-xl border portal-border p-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={saveDraft}
            className="inline-flex items-center gap-2 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            Save draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={previewRecipients}
            className="inline-flex items-center gap-2 rounded-xl border portal-border px-4 py-2.5 text-sm font-bold portal-copy disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            Preview recipients
          </button>
        </div>

        {preview ? (
          <div className="mt-5 rounded-xl border border-[var(--portal-selected-border)] bg-[var(--portal-selected-bg)] p-4">
            <p className="font-bold text-blue-900">
              {preview.count} eligible recipient{preview.count === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-sm text-[var(--portal-primary)]">
              Departments: {preview.departments?.join(", ") || "Not recorded"}
            </p>
            {preview.recipients?.length ? (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {preview.recipients.map((recipient) => (
                  <li
                    key={recipient.email}
                    className="rounded-lg portal-surface-raised p-3 text-sm portal-copy"
                  >
                    <span className="block font-bold text-slate-950">{recipient.name}</span>
                    <span>{recipient.email}</span>
                    <span className="block text-xs portal-muted">
                      {recipient.department || "No department"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Saved campaigns</h3>
            <p className="text-sm portal-muted">Review delivery results before repeating an action.</p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction("refresh", loadCampaigns, "Campaign list refreshed.")}
            className="rounded-xl border portal-border p-2.5 portal-copy disabled:opacity-50"
            aria-label="Refresh campaigns"
          >
            <RefreshCw className={busyAction === "refresh" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed portal-border p-8 text-center text-sm portal-muted">
            No communication drafts have been saved yet.
          </div>
        ) : campaigns.map((campaign) => {
          const terminal = TERMINAL_STATUSES.has(campaign.status);
          const canSchedule = ["draft", "failed", "skipped"].includes(campaign.status);
          const canCancel = ["draft", "scheduled", "failed", "skipped"].includes(campaign.status);
          const canSend = ["draft", "failed", "skipped"].includes(campaign.status);

          return (
            <article key={campaign.id} className="rounded-2xl border portal-border portal-surface-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-950">{campaign.name}</h4>
                  <p className="mt-1 text-sm portal-muted">{campaign.subject}</p>
                </div>
                <span className="rounded-full portal-surface-muted px-3 py-1 text-xs font-bold portal-copy">
                  {formatStatus(campaign.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Metric label="Recipients" value={campaign.delivery_count || 0} />
                <Metric label="Sent" value={campaign.sent_count || 0} />
                <Metric label="Skipped" value={campaign.skipped_count || 0} />
                <Metric label="Failed" value={campaign.failed_count || 0} />
              </div>

              {campaign.last_error ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {campaign.last_error}
                </p>
              ) : null}

              {!terminal ? (
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t portal-border pt-4">
                  <label className="min-w-64 flex-1 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wide portal-muted">
                      Test recipient
                    </span>
                    <input
                      type="email"
                      value={testRecipient}
                      onChange={(event) => setTestRecipient(event.target.value)}
                      placeholder="Your ATD email address"
                      className="w-full rounded-xl border portal-border px-3 py-2.5 text-sm"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={loading || !testRecipient}
                    onClick={() => runAction(
                      `test-${campaign.id}`,
                      () => companyCommunicationsApi.test(campaign.id, testRecipient),
                      "Test communication processed through email governance."
                    )}
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    <FlaskConical className="h-4 w-4" />
                    Send test
                  </button>

                  {canSchedule ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const value = window.prompt(
                          "Enter an ISO date/time, for example 2026-08-31T09:00:00+02:00"
                        );
                        if (!value) return;
                        runAction(
                          `schedule-${campaign.id}`,
                          () => companyCommunicationsApi.schedule(campaign.id, value),
                          "Campaign scheduled."
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                    >
                      <CalendarClock className="h-4 w-4" />
                      Schedule
                    </button>
                  ) : null}

                  {canCancel ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => runAction(
                        `cancel-${campaign.id}`,
                        () => companyCommunicationsApi.cancel(campaign.id),
                        "Campaign cancelled."
                      )}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  ) : null}

                  {canSend ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const phrase = window.prompt(
                          "Type SEND COMPANY COMMUNICATION to continue"
                        );
                        if (!phrase) return;
                        runAction(
                          `send-${campaign.id}`,
                          () => companyCommunicationsApi.send(campaign.id, phrase),
                          "Campaign delivery completed. Review the delivery counters."
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Send now
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-xl portal-surface-muted p-3 text-sm font-semibold portal-copy">
                  <CheckCircle2 className="h-4 w-4" />
                  This campaign is in a terminal state.
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl portal-surface-muted p-3">
      <p className="text-xs font-bold uppercase tracking-wide portal-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
