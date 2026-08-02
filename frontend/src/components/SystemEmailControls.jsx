import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  FlaskConical,
  MailCheck,
  Save,
  X,
} from "lucide-react";

import { settingsApi } from "../services/api";

const CATEGORY_OPTIONS = [
  ["account_request", "Account request confirmations"],
  ["account_approval", "Administrator approval alerts"],
  ["welcome", "Microsoft 365 welcome emails"],
  ["ticket_assignment", "Ticket assignment emails"],
  ["ticket_update", "Ticket update emails"],
  ["reminder", "Reminder emails"],
  ["escalation", "Escalation emails"],
  ["requester_update", "Requester update emails"],
];

function getErrorMessage(error) {
  return (
    error?.response?.data?.error ||
    error?.message ||
    "Email settings could not be saved."
  );
}

function normalizeRecipientText(value) {
  return value
    .split(/[;,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export default function SystemEmailControls({
  embedded = false,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [mode, setMode] = useState("live");
  const [recipientText, setRecipientText] = useState("");
  const [categories, setCategories] = useState({});

  const testRecipients = useMemo(
    () => normalizeRecipientText(recipientText),
    [recipientText]
  );

  useEffect(() => {
    let cancelled = false;

    settingsApi
      .getEmailSettings()
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        setMode(data.mode || "live");
        setRecipientText(
          Array.isArray(data.testRecipients)
            ? data.testRecipients.join("\n")
            : ""
        );
        setCategories(data.categories || {});
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage({
            type: "error",
            text: getErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (mode === "testing" && testRecipients.length === 0) {
      setMessage({
        type: "error",
        text:
          "Testing mode requires at least one valid test recipient.",
      });
      return;
    }

    const confirmation =
      mode === "disabled"
        ? "Disable all external system emails? In-app notifications will continue."
        : mode === "testing"
          ? `Redirect all enabled system emails to ${testRecipients.join(", ")}?`
          : "Enable live email delivery to intended recipients?";

    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await settingsApi.updateEmailSettings({
        mode,
        testRecipients,
        categories,
      });

      const saved = response.data || {};
      setMode(saved.mode || mode);
      setRecipientText(
        Array.isArray(saved.testRecipients)
          ? saved.testRecipients.join("\n")
          : recipientText
      );
      setCategories(saved.categories || categories);
      setMessage({
        type: "success",
        text: "System email controls updated successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-slate-500">
        Loading system email controls...
      </div>
    );
  }

  return (
    <section
      className={
        embedded
          ? "space-y-6"
          : "rounded-2xl border bg-white p-6 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-700">
            Communications Governance
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            System Email Controls
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Control whether email is delivered normally, redirected
            to testers, or disabled. In-app notifications remain
            available in every mode.
          </p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      {message && (
        <div
          className={`rounded-xl border p-3 text-sm font-semibold ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <ModeCard
          icon={MailCheck}
          active={mode === "live"}
          title="Live"
          description="Send enabled email categories to intended recipients."
          onClick={() => setMode("live")}
        />
        <ModeCard
          icon={FlaskConical}
          active={mode === "testing"}
          title="Testing"
          description="Redirect enabled emails to approved testing recipients."
          onClick={() => setMode("testing")}
        />
        <ModeCard
          icon={Ban}
          active={mode === "disabled"}
          title="Disabled"
          description="Skip external email while preserving portal actions and in-app notifications."
          onClick={() => setMode("disabled")}
          danger
        />
      </div>

      {mode === "testing" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="block">
            <span className="text-sm font-bold text-amber-900">
              Approved testing recipients
            </span>
            <span className="mt-1 block text-xs text-amber-800">
              Enter one address per line, or separate addresses with
              commas or semicolons.
            </span>
            <textarea
              rows="4"
              value={recipientText}
              onChange={(event) =>
                setRecipientText(event.target.value)
              }
              placeholder="tester@atdalliance.co.za"
              className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3 py-2"
            />
          </label>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            {testRecipients.length} valid recipient(s) detected.
          </p>
        </div>
      )}

      {mode === "disabled" && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">External email will be disabled.</p>
            <p className="mt-1">
              Ticket creation, assignments, account actions and
              in-app notifications will continue normally.
            </p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-slate-950">
          Email categories
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Disabled categories are skipped even when the system is in
          Live or Testing mode.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {CATEGORY_OPTIONS.map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <span className="font-semibold text-slate-800">
                {label}
              </span>
              <input
                type="checkbox"
                checked={categories[key] !== false}
                onChange={(event) =>
                  setCategories((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t pt-5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Email Controls"}
        </button>
      </div>
    </section>
  );
}

function ModeCard({
  icon: Icon,
  active,
  title,
  description,
  onClick,
  danger,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? danger
            ? "border-red-500 bg-red-50"
            : "border-blue-500 bg-blue-50"
          : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <Icon
        className={`h-6 w-6 ${
          danger ? "text-red-700" : "text-blue-700"
        }`}
      />
      <h3 className="mt-4 font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}

function ModeBadge({ mode }) {
  const styles = {
    live: "bg-emerald-100 text-emerald-700",
    testing: "bg-amber-100 text-amber-700",
    disabled: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${styles[mode]}`}
    >
      {mode}
    </span>
  );
}
