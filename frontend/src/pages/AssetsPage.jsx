import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  HardDrive,
  Laptop,
  Monitor,
  RefreshCw,
  Router,
  Search,
  Server,
  Smartphone,
  Tablet,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { assetsApi } from "../services/api";

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
  Laptop: Laptop,
  Desktop: Server,
  "Mobile Phone": Smartphone,
  Monitor: Monitor,
  Tablet: Tablet,
  SIM: Smartphone,
  Router: Router,
  Other: HardDrive,
};

const STATUS_LABELS = {
  assigned: "In Use",
  storage: "In Storage",
  damaged: "Damaged",
  untraced: "Untraced",
  disposed: "Disposed",
};

const statusClass = (status) => {
  return (
    {
      assigned: "bg-emerald-100 text-emerald-700",
      storage: "bg-slate-100 text-slate-700",
      damaged: "bg-red-100 text-red-700",
      untraced: "bg-amber-100 text-amber-700",
      disposed: "bg-slate-200 text-slate-600",
    }[status] || "bg-slate-100 text-slate-700"
  );
};

const gradeClass = (grade) => {
  return (
    {
      A: "bg-emerald-100 text-emerald-700",
      B: "bg-emerald-100 text-emerald-700",
      C: "bg-amber-100 text-amber-700",
      D: "bg-red-100 text-red-700",
      F: "bg-red-100 text-red-700",
    }[grade] || "bg-slate-100 text-slate-600"
  );
};

const formatDate = (value) => {
  if (!value) return "N/A";
  if (value === "unknown") return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function AssetsPage() {
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetDetail, setAssetDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchAssets = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await assetsApi.getAll();
      const data = Array.isArray(res.data) ? res.data : [];

      setAssets(data);

      setSelectedAsset((current) => {
        if (!current) return data[0] || null;

        return (
          data.find((asset) => String(asset.id) === String(current.id)) ||
          data[0] ||
          null
        );
      });
    } catch (err) {
      console.error("Fetch assets failed:", err);
      setError(
        err?.response?.data?.error ||
          "Failed to load assets from the Asset Management System."
      );
      setAssets([]);
      setSelectedAsset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    if (!selectedAsset?.id) {
      setAssetDetail(null);
      return;
    }

    let cancelled = false;

    setDetailLoading(true);

    assetsApi
      .getById(selectedAsset.id)
      .then((res) => {
        if (!cancelled) setAssetDetail(res.data);
      })
      .catch((err) => {
        console.error("Fetch asset detail failed:", err);
        if (!cancelled) setAssetDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.id]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const text = [
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

      const matchesSearch =
        normalizedQuery.length === 0 || text.includes(normalizedQuery);

      const matchesType =
        typeFilter === "All"
          ? true
          : typeFilter === "Other"
          ? OTHER_TYPES.includes(asset.type)
          : asset.type === typeFilter;

      const matchesStatus =
        statusFilter === "All" ? true : asset.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [assets, query, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: assets.length,
      inUse: assets.filter((asset) => asset.status === "assigned").length,
      storage: assets.filter((asset) => asset.status === "storage").length,
      damaged: assets.filter((asset) => asset.status === "damaged").length,
      untraced: assets.filter((asset) => asset.status === "untraced").length,
    };
  }, [assets]);

  const getTypeCount = (value) => {
    if (value === "All") return assets.length;

    if (value === "Other") {
      return assets.filter((asset) => OTHER_TYPES.includes(asset.type)).length;
    }

    return assets.filter((asset) => asset.type === value).length;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
          >
            ← Back to Dashboard
          </button>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <HardDrive className="h-4 w-4" />
            Helpdesk / Assets
          </div>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Assets
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Live inventory pulled from the ATD Asset Management System.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchAssets}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <a
            href="https://portal.atdalliance.co.za/ams/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            Open AMS
          </a>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Assets" value={stats.total} />
        <StatCard label="In Use" value={stats.inUse} />
        <StatCard label="In Storage" value={stats.storage} />
        <StatCard label="Damaged" value={stats.damaged} danger />
        <StatCard label="Untraced" value={stats.untraced} warning />
      </div>

      {/* Main layout */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Asset list */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Asset Inventory
                </h2>
                <p className="text-sm text-slate-500">
                  Search by asset tag, serial, model, user or department.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search assets..."
                    className="rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Type tabs */}
          <div className="border-b border-slate-200 px-5 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TYPE_TABS.map((tab) => {
                const active = typeFilter === tab.value;

                return (
                  <button
                    key={tab.value}
                    onClick={() => setTypeFilter(tab.value)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}

                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {getTypeCount(tab.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column headings */}
          <div className="hidden border-b border-slate-200 px-5 py-3 lg:grid lg:grid-cols-[1fr_130px_160px_130px] lg:gap-4">
            {["Asset", "Type", "Used By", "Department"].map((heading) => (
              <p
                key={heading}
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {heading}
              </p>
            ))}
          </div>

          <div className="max-h-[60rem] divide-y divide-slate-100 overflow-y-auto">
            {loading && assets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading assets...
              </div>
            ) : filteredAssets.length === 0 ? (
              <EmptyAssetsState />
            ) : (
              filteredAssets.map((asset) => {
                const isSelected =
                  String(selectedAsset?.id) === String(asset.id);

                const isDamaged = asset.status === "damaged";
                const isUntraced = asset.status === "untraced";

                const TypeIcon = TYPE_ICONS[asset.type] || HardDrive;

                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className={`grid w-full gap-4 border-l-4 p-5 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_130px_160px_130px] lg:items-center ${
                      isSelected ? "bg-blue-50" : ""
                    } ${
                      isDamaged
                        ? "border-l-red-500"
                        : isUntraced
                        ? "border-l-amber-500"
                        : "border-l-transparent"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-blue-700">
                          {asset.asset_tag}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                            asset.status
                          )}`}
                        >
                          {STATUS_LABELS[asset.status] || asset.status}
                        </span>

                        {asset.condition_grade && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${gradeClass(
                              asset.condition_grade
                            )}`}
                          >
                            Grade {asset.condition_grade}
                          </span>
                        )}

                        {asset.is_rental && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">
                            Rental
                          </span>
                        )}
                      </div>

                      <p className="mt-2 font-semibold text-slate-950">
                        {asset.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        SN: {asset.serial_number || "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <TypeIcon className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-950">
                        {asset.type}
                      </span>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {asset.used_by || "—"}
                      </p>
                      {asset.used_by && (
                        <p className="text-slate-500">
                          Since {formatDate(asset.assigned_date)}
                        </p>
                      )}
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-slate-950">
                        {asset.department || "—"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Asset detail preview */}
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          {!selectedAsset ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
              Select an asset to view details.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-700">
                    {selectedAsset.asset_tag}
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {selectedAsset.name}
                  </h2>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                    selectedAsset.status
                  )}`}
                >
                  {STATUS_LABELS[selectedAsset.status] || selectedAsset.status}
                </span>
              </div>

              {/* Used by */}
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-200 p-2">
                    <User className="h-5 w-5 text-slate-700" />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-950">
                      {selectedAsset.used_by || "Not assigned"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {selectedAsset.used_by
                        ? `${selectedAsset.department || "No department"} · since ${formatDate(
                            selectedAsset.assigned_date
                          )}`
                        : "This asset is not currently in use."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Specs */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoBox label="Serial Number" value={selectedAsset.serial_number} />
                <InfoBox label="Type" value={selectedAsset.type} />
                <InfoBox label="Hostname" value={selectedAsset.hostname} />
                <InfoBox
                  label="Condition"
                  value={
                    selectedAsset.condition_grade
                      ? `Grade ${selectedAsset.condition_grade}`
                      : "Not assessed"
                  }
                />
                <InfoBox label="RAM" value={selectedAsset.ram} />
                <InfoBox label="CPU" value={selectedAsset.cpu} />
                <InfoBox
                  label="Warranty Expiry"
                  value={formatDate(selectedAsset.warranty_expiry)}
                />
                <InfoBox
                  label="Last Verified"
                  value={formatDate(selectedAsset.last_verified_at)}
                />
              </div>

              {/* Assignment history */}
              <div className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Assignment History
                </h3>

                {detailLoading ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Loading history...
                  </p>
                ) : !assetDetail?.assignment_history?.length ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No assignment history recorded.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {assetDetail.assignment_history.map((entry, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-100 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-950">
                            {entry.employee}
                          </p>

                          {entry.current && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {entry.department || "No department"} ·{" "}
                          {formatDate(entry.assigned_date)}
                          {!entry.current &&
                            ` → ${formatDate(entry.returned_date)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, danger = false, warning = false }) {
  const cardClass = danger
    ? "border-red-200 bg-red-50"
    : warning
    ? "border-amber-200 bg-amber-50"
    : "border-slate-200 bg-white";

  const labelClass = danger
    ? "text-red-700"
    : warning
    ? "text-amber-700"
    : "text-slate-500";

  const valueClass = danger
    ? "text-red-800"
    : warning
    ? "text-amber-800"
    : "text-slate-950";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cardClass}`}>
      <p className={`text-sm font-semibold ${labelClass}`}>{label}</p>

      <h2 className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</h2>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold text-slate-900">
        {value || "N/A"}
      </p>
    </div>
  );
}

function EmptyAssetsState() {
  return (
    <div className="p-8 text-center">
      <HardDrive className="mx-auto h-10 w-10 text-slate-400" />

      <p className="mt-3 font-semibold text-slate-700">No assets found</p>

      <p className="mt-1 text-sm text-slate-500">
        Try adjusting your search or filters.
      </p>
    </div>
  );
}
