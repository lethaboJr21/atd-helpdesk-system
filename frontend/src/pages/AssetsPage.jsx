import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  HardDrive,
  Laptop,
  Monitor,
  PackagePlus,
  RefreshCw,
  Router,
  Search,
  Server,
  Smartphone,
  Tablet,
  Wrench,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { assetsApi } from "../services/api";

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);
const TYPE_TABS = [
  { label: "All", value: "All" },
  { label: "Laptops", value: "Laptop" },
  { label: "Desktops", value: "Desktop" },
  { label: "Phones", value: "Mobile Phone" },
  { label: "Monitors", value: "Monitor" },
  { label: "Tablets", value: "Tablet" },
  { label: "Other", value: "Other" },
];
const OTHER_TYPES = ["SIM", "Router", "Other"];
const STATUS_OPTIONS = [
  { label: "All statuses", value: "All" },
  { label: "In Use", value: "assigned" },
  { label: "In Storage", value: "storage" },
  { label: "Damaged", value: "damaged" },
  { label: "Untraced", value: "untraced" },
];
const TYPE_ICONS = {
  Laptop,
  Desktop: Server,
  "Mobile Phone": Smartphone,
  Monitor,
  Tablet,
  SIM: Smartphone,
  Router,
  Other: HardDrive,
};
const STATUS_LABELS = {
  assigned: "In Use",
  storage: "In Storage",
  damaged: "Damaged",
  untraced: "Untraced",
  disposed: "Disposed",
};
const cn = (...v) => v.filter(Boolean).join(" ");
function date(value) {
  if (!value || value === "unknown")
    return value === "unknown" ? "Unknown" : "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "N/A"
    : d.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
function errorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}
function statusClass(value) {
  return (
    {
      assigned: "bg-emerald-100 text-emerald-800",
      storage: "bg-slate-100 text-slate-700",
      damaged: "bg-red-100 text-red-800",
      untraced: "bg-amber-100 text-amber-800",
      disposed: "bg-slate-200 text-slate-600",
    }[value] || "bg-slate-100 text-slate-700"
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full shrink-0 items-center justify-center self-center whitespace-nowrap rounded-full px-3 text-xs font-bold leading-none",
        statusClass(status),
      )}
    >
      {STATUS_LABELS[status] || status || "Unknown"}
    </span>
  );
}

export default function AssetsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, employeeView } = useAuth();
  const operationsRole = OPERATIONS_ROLES.has(user?.role);
  const employeeExperience =
    user?.role === "user" ||
    employeeView ||
    location.pathname.startsWith("/employee");
  const [assets, setAssets] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetDetail, setAssetDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const closeDetails = useCallback(() => {
    setSelectedAsset(null);
    setAssetDetail(null);
    setDetailLoading(false);
  }, []);
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    closeDetails();
    try {
      const response = employeeExperience
        ? await assetsApi.getMine()
        : await assetsApi.getAll();
      const data = employeeExperience
        ? Array.isArray(response.data?.assets)
          ? response.data.assets
          : []
        : Array.isArray(response.data)
          ? response.data
          : [];
      setEmployee(response.data?.employee || null);
      setAssets(data);
    } catch (error) {
      setError(
        errorMessage(
          error,
          employeeExperience
            ? "Your assigned assets could not be loaded."
            : "The AMS asset register could not be loaded.",
        ),
      );
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [employeeExperience, closeDetails]);
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);
  useEffect(() => {
    if (!selectedAsset?.id) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    assetsApi
      .getById(selectedAsset.id)
      .then((response) => {
        if (!cancelled) setAssetDetail(response.data);
      })
      .catch(() => {
        if (!cancelled) setAssetDetail(selectedAsset);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);
  useEffect(() => {
    if (!selectedAsset) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeDetails();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAsset, closeDetails]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const searchable = [
        asset.asset_tag,
        asset.serial_number,
        asset.name,
        asset.brand,
        asset.model,
        asset.hostname,
        asset.used_by,
        asset.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!search || searchable.includes(search)) &&
        (typeFilter === "All" ||
          (typeFilter === "Other"
            ? OTHER_TYPES.includes(asset.type)
            : asset.type === typeFilter)) &&
        (statusFilter === "All" || asset.status === statusFilter)
      );
    });
  }, [assets, query, typeFilter, statusFilter]);
  const support = (mode, asset = null) =>
    navigate(`/tickets/new?type=service_request&catalogue=${mode}`, {
      state: { createMode: "service_request", catalogueItem: mode, asset },
    });
  if (employeeExperience)
    return (
      <EmployeeAssets
        user={user}
        employee={employee}
        assets={assets}
        loading={loading}
        error={error}
        refresh={fetchAssets}
        navigate={navigate}
        open={setSelectedAsset}
        support={support}
      />
    );
  if (!operationsRole)
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          You are not authorised to view the operational asset register.
        </div>
      </div>
    );
  const stats = {
    total: assets.length,
    inUse: assets.filter((a) => a.status === "assigned").length,
    storage: assets.filter((a) => a.status === "storage").length,
    damaged: assets.filter((a) => a.status === "damaged").length,
    untraced: assets.filter((a) => a.status === "untraced").length,
  };
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/")}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <p className="text-sm text-slate-500">Helpdesk / Assets and CMDB</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Asset Register
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchAssets}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <a
            href="https://portal.atdalliance.co.za/ams/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            Open AMS
          </a>
        </div>
      </header>
      {error && <Alert text={error} />}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        {Object.entries({
          "Total Assets": stats.total,
          "In Use": stats.inUse,
          "In Storage": stats.storage,
          Damaged: stats.damaged,
          Untraced: stats.untraced,
        }).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Search assets"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-5 py-3">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition",
                typeFilter === tab.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="hidden border-b border-slate-200 px-5 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_auto] md:items-center md:gap-4">
          {["Asset", "Type", "Used By", "Status"].map((heading) => (
            <p
              key={heading}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {heading}
            </p>
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading asset register...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No assets match your filters.
            </div>
          ) : (
            filtered.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className="grid w-full items-center gap-3 p-5 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_auto] md:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-bold text-blue-700">
                    {asset.asset_tag || `ASSET-${asset.id}`}
                  </p>
                  <p className="mt-1 truncate font-semibold text-slate-950">
                    {asset.name || "Unnamed asset"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    SN: {asset.serial_number || "N/A"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  {asset.type || "Other"}
                </p>
                <p className="truncate text-sm font-semibold text-slate-950">
                  {asset.used_by || "Not assigned"}
                </p>
                <div className="flex md:justify-start">
                  <StatusBadge status={asset.status} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {selectedAsset && (
        <Modal
          asset={assetDetail || selectedAsset}
          loading={detailLoading}
          close={closeDetails}
          support={support}
          operational
        />
      )}
    </div>
  );
}
function EmployeeAssets({
  user,
  employee,
  assets,
  loading,
  error,
  refresh,
  navigate,
  open,
  support,
}) {
  return (
    <div className="min-h-screen bg-slate-100 p-5">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <button
              onClick={() =>
                navigate(user?.role === "user" ? "/" : "/employee")
              }
              className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Employee Dashboard
            </button>
            <p className="text-sm font-semibold text-blue-700">
              Employee Self-Service
            </p>
            <h1 className="mt-1 text-3xl font-bold">Your Assets</h1>
            <p className="text-sm text-slate-500">
              Devices currently assigned to{" "}
              {employee?.name || user?.name || "your account"}.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => support("asset_request")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
            >
              <PackagePlus className="h-4 w-4" />
              Request an Asset
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-xl border bg-white px-4 py-3 text-sm font-bold"
            >
              Refresh
            </button>
          </div>
        </header>
        {error && <Alert text={error} />}
        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full p-10 text-center">
              Loading your assets...
            </div>
          ) : (
            assets.map((asset) => (
              <Card
                key={asset.id}
                asset={asset}
                open={open}
                support={support}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
function Card({ asset, open, support }) {
  const Icon = TYPE_ICONS[asset.type] || HardDrive;
  return (
    <article className="rounded-2xl border bg-white p-5">
      <div className="flex justify-between">
        <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
          <Icon className="h-6 w-6" />
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <p className="mt-4 font-bold text-blue-700">
        {asset.asset_tag || `ASSET-${asset.id}`}
      </p>
      <h2 className="text-lg font-bold">{asset.name || "Assigned asset"}</h2>
      <p className="mt-3 text-sm">Serial: {asset.serial_number || "N/A"}</p>
      <p className="text-sm">Assigned: {date(asset.assigned_date)}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => open(asset)}
          className="rounded-xl border px-3 py-2 text-sm font-bold"
        >
          View Details
        </button>
        <button
          onClick={() => support("asset_problem", asset)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"
        >
          <Wrench className="h-4 w-4" />
          Report Problem
        </button>
        <button
          onClick={() => support("laptop_checkup", asset)}
          className="rounded-xl border px-3 py-2 text-sm font-bold"
        >
          Request Checkup
        </button>
        <button
          onClick={() => support("asset_replacement", asset)}
          className="rounded-xl border px-3 py-2 text-sm font-bold"
        >
          Request Replacement
        </button>
      </div>
    </article>
  );
}
function Modal({ asset, loading, close, support, operational }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6">
        <div className="flex justify-between">
          <div>
            <p className="font-bold text-blue-700">
              {asset.asset_tag || `ASSET-${asset.id}`}
            </p>
            <h2 className="text-2xl font-bold">
              {asset.name || "Asset Details"}
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-xl border p-2"
            aria-label="Close asset details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <p className="mt-6">Loading asset history...</p>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Type" value={asset.type} />
              <Info label="Serial Number" value={asset.serial_number} />
              <Info label="Hostname" value={asset.hostname} />
              <Info
                label="Condition"
                value={
                  asset.condition_grade
                    ? `Grade ${asset.condition_grade}`
                    : asset.status
                }
              />
              <Info
                label="Warranty Expiry"
                value={date(asset.warranty_expiry)}
              />
              <Info
                label="Last Verified"
                value={date(asset.last_verified_at)}
              />
            </div>
            {operational && Array.isArray(asset.assignment_history) && (
              <div className="mt-6">
                <h3 className="font-bold">Assignment History</h3>
                {asset.assignment_history.map((entry, index) => (
                  <div
                    key={index}
                    className="mt-2 rounded-xl border p-3 text-sm"
                  >
                    {entry.employee || "Unknown employee"}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => support("asset_problem", asset)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              >
                Report a Problem
              </button>
              <button
                onClick={() => support("asset_replacement", asset)}
                className="rounded-xl border px-4 py-2 text-sm font-bold"
              >
                Request Replacement
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value || "N/A"}</p>
    </div>
  );
}
function Alert({ text }) {
  return (
    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
      {text}
    </div>
  );
}
