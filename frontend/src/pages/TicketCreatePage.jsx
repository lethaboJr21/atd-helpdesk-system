import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Home,
  Ticket as TicketIcon,
  UploadCloud,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import CategoryCascade from "../components/CategoryCascade";
import OperationsShell from "../components/OperationsShell";
import {
  ASSET_REASONS,
  GUIDED_INCIDENTS,
  LEGACY_CATALOGUE,
  REQUEST_MODULES,
  guidedIncidentPath,
  moduleForTicketType,
  suggestPriority,
} from "../data/requestModules";
import { catalogApi, groupsApi, ticketsApi, userApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const message = (error, fallback) =>
  error?.response?.data?.error || error?.message || fallback;

const DEFAULT_FIELDS = {
  incident: {
    categories: [],
    impact: ["Low", "Medium", "High"],
    urgency: ["Low", "Medium", "High"],
    priority: ["Low", "Medium", "High", "Critical"],
    majorIncidentTypes: [
      "Full outage",
      "Partial outage",
      "Performance degradation",
    ],
  },
  change: {
    changeTypes: ["Minor", "Standard", "Major", "Emergency"],
    impact: ["Low", "Medium", "High"],
    risk: ["Low", "Medium", "High", "Very High"],
    priority: ["Low", "Medium", "High", "Critical"],
    categories: [],
  },
  asset: { reasons: ASSET_REASONS },
};

/**
 * Locked single-type create form.
 * Type comes from route / query / state — never a tab switcher.
 */
export default function TicketCreatePage({ lockedType = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, employeeView } = useAuth();

  const operational = OPERATIONS_ROLES.has(user?.role);
  const employee = user?.role === "user" || employeeView;

  const catalogItem = location.state?.catalogItem || null;

  const resolved = useMemo(() => {
    const catalogueKey =
      params.get("catalogue") || location.state?.catalogueItem || "";
    const catalogue = LEGACY_CATALOGUE[catalogueKey] || null;
    const typeParam = lockedType || params.get("type") || location.state?.createMode;

    let ticketType = "incident";
    if (catalogue?.type && moduleForTicketType(catalogue.type)) {
      ticketType = catalogue.type;
    } else if (typeParam && moduleForTicketType(typeParam)) {
      ticketType = typeParam;
    } else if (lockedType) {
      ticketType = lockedType;
    }

    if (lockedType && ticketType !== lockedType) {
      ticketType = lockedType;
    }

    return { ticketType, catalogueKey, catalogue };
  }, [params, location.state, lockedType]);

  const ticketType = resolved.ticketType;
  const catalogueKey = resolved.catalogueKey;
  const catalogue = resolved.catalogue;
  const module = moduleForTicketType(ticketType);
  const Icon = catalogue?.icon || module.icon;
  const linkedAsset = location.state?.asset || null;

  const prefillTitle =
    params.get("title") ||
    location.state?.prefillTitle ||
    catalogue?.title ||
    catalogItem?.name ||
    "";
  const prefillAssetItem =
    params.get("assetItem") ||
    location.state?.assetItem ||
    catalogItem?.name ||
    "";
  const prefillCategory =
    params.get("category") || location.state?.category || "";
  const prefillSubCategory =
    params.get("subCategory") || location.state?.subCategory || "";
  const prefillItemCategory =
    params.get("itemCategory") || location.state?.itemCategory || "";

  const [groups, setGroups] = useState([]);
  const [agents, setAgents] = useState([]);
  const [requesters, setRequesters] = useState([]);
  const [files, setFiles] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateTicket, setDuplicateTicket] = useState(null);
  const [created, setCreated] = useState(null);
  const [fileNote, setFileNote] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const errorRef = useRef(null);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [form, setForm] = useState({
    requesterId: "",
    title: prefillTitle,
    description: "",
    priority: "Medium",
    workspace: module.workspace,
    assignedGroupId: "",
    assignedToUserId: "",
    // Incident
    category: prefillCategory,
    subCategory: prefillSubCategory,
    itemCategory: prefillItemCategory,
    impact: "Medium",
    urgency: "Medium",
    isMajorIncident: false,
    majorIncidentType: "",
    businessImpact: "",
    impactedLocations: "",
    customersImpacted: "",
    // Asset
    assetItem: prefillAssetItem,
    quantity: 1,
    requestReason: "New Item",
    neededBy: "",
    deliveryLocation: "",
    // Change
    changeType: "Standard",
    changeImpact: "Medium",
    changeRisk: "Medium",
    plannedStart: "",
    plannedEnd: "",
    changeReason: "",
    changePlan: "",
    backoutPlan: "",
    // Project
    projectObjective: "",
    projectSponsor: "",
    projectOwner: "",
    projectStart: "",
    projectEnd: "",
    projectScope: "",
    projectDeliverables: "",
  });

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const addFiles = (incoming) => {
    const notes = [];

    setFiles((current) => {
      const accepted = [...current];

      for (const file of Array.from(incoming || [])) {
        if (!ALLOWED.includes(file.type)) {
          notes.push(`${file.name} is not a supported file type.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          notes.push(`${file.name} is larger than 8 MB.`);
          continue;
        }
        if (
          accepted.some(
            (existing) =>
              existing.name === file.name && existing.size === file.size
          )
        ) {
          continue;
        }
        if (accepted.length >= MAX_FILES) {
          notes.push(`Only ${MAX_FILES} files can be attached.`);
          break;
        }
        accepted.push(file);
      }

      return accepted;
    });

    setFileNote(notes.join(" "));
  };

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      workspace: module.workspace,
      assignedToUserId: "",
      title:
        prefillTitle &&
        (!current.title.trim() ||
          Object.values(LEGACY_CATALOGUE).some(
            (item) => item.title === current.title
          ) ||
          current.title === prefillTitle ||
          current.title === catalogItem?.name)
          ? prefillTitle
          : current.title,
      assetItem: prefillAssetItem || current.assetItem,
      category: prefillCategory || current.category,
      subCategory: prefillSubCategory || current.subCategory,
      itemCategory: prefillItemCategory || current.itemCategory,
    }));
  }, [
    ticketType,
    prefillTitle,
    prefillAssetItem,
    prefillCategory,
    prefillSubCategory,
    prefillItemCategory,
    module.workspace,
    catalogItem?.name,
  ]);

  useEffect(() => {
    if (ticketType !== "incident") return;
    const suggested = suggestPriority(form.impact, form.urgency);
    setForm((current) =>
      current.priority === suggested
        ? current
        : { ...current, priority: suggested }
    );
  }, [form.impact, form.urgency, ticketType]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [groupsResponse, fieldsResponse] = await Promise.all([
          employee ? groupsApi.getCatalogue() : groupsApi.getAll(),
          catalogApi.getFields().catch(() => ({ data: null })),
        ]);

        if (!cancelled) {
          setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data : []);
          if (fieldsResponse?.data) {
            setFields({
              incident: {
                ...DEFAULT_FIELDS.incident,
                ...(fieldsResponse.data.incident || {}),
              },
              change: {
                ...DEFAULT_FIELDS.change,
                ...(fieldsResponse.data.change || {}),
              },
              asset: {
                ...DEFAULT_FIELDS.asset,
                ...(fieldsResponse.data.asset || {}),
              },
            });
          }
        }

        if (
          (catalogueKey === "create_for_other" ||
            ticketType === "service_request" ||
            ticketType === "asset_request") &&
          operational
        ) {
          const users = await userApi.getActiveUsers({ limit: 1000 });
          if (!cancelled) {
            const payload = users.data;
            setRequesters(
              Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.users)
                  ? payload.users
                  : []
            );
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            message(loadError, "Supporting information could not be loaded.")
          );
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [employee, operational, catalogueKey, ticketType]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAgents(true);

    groupsApi
      .getAgents({
        category: form.category || undefined,
        subCategory: form.subCategory || undefined,
      })
      .then((response) => {
        if (!cancelled) {
          setAgents(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.category, form.subCategory]);

  const recommendedAgents = useMemo(() => {
    const scored = agents.filter(
      (agent) => agent.resolvedSub > 0 || agent.resolvedCategory > 0
    );
    const pool = scored.length
      ? scored
      : agents.filter((agent) => agent.resolvedTotal > 0);
    const available = pool.filter((agent) => agent.onShift !== false);
    return (available.length ? available : pool).slice(0, 3);
  }, [agents]);

  const otherAgents = useMemo(() => {
    const recommendedIds = new Set(recommendedAgents.map((agent) => agent.id));
    return agents
      .filter((agent) => !recommendedIds.has(agent.id))
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [agents, recommendedAgents]);

  const selectAgent = (value) => {
    if (!value) {
      setForm((current) => ({ ...current, assignedToUserId: "" }));
      return;
    }
    const agent = agents.find((item) => String(item.id) === String(value));
    setForm((current) => {
      const memberGroups = Array.isArray(agent?.groups) ? agent.groups : [];
      const keepGroup = memberGroups.some(
        (group) => String(group.id) === String(current.assignedGroupId)
      );
      return {
        ...current,
        assignedToUserId: value,
        assignedGroupId: keepGroup
          ? current.assignedGroupId
          : memberGroups[0]
            ? String(memberGroups[0].id)
            : current.assignedGroupId,
      };
    });
  };

  const agentOptionLabel = (agent) => {
    const title = agent.job_title ? ` — ${agent.job_title}` : "";
    if (agent.onShift === false) return `${agent.name}${title} (off shift)`;
    if (agent.onShift === true && agent.shiftLabel) {
      return `${agent.name}${title} (on ${agent.shiftLabel.toLowerCase()})`;
    }
    return `${agent.name}${title}`;
  };

  const descriptionBody = useMemo(() => {
    const lines = [form.description.trim()];

    if (linkedAsset) {
      lines.push(
        "",
        "Affected asset:",
        `- Asset tag: ${linkedAsset.asset_tag || "N/A"}`,
        `- Name: ${linkedAsset.name || "N/A"}`,
        `- Serial: ${linkedAsset.serial_number || "N/A"}`
      );
    }

    return lines.filter(Boolean).join("\n").trim();
  }, [form.description, linkedAsset]);

  const requestDetails = useMemo(() => {
    const details = {};

    if (ticketType === "incident") {
      details.module = "incident";
      if (form.isMajorIncident) {
        details.majorIncident = true;
        details.majorIncidentType = form.majorIncidentType || null;
        details.businessImpact = form.businessImpact || null;
        details.impactedLocations = form.impactedLocations || null;
        details.customersImpacted = form.customersImpacted || null;
      }
    }

    if (ticketType === "service_request") {
      details.module = "service";
      details.catalogItemId = catalogItem?.id || params.get("itemId") || null;
      details.catalogItemName = catalogItem?.name || prefillTitle || null;
      details.catalogCategory = catalogItem?.categoryName || null;
    }

    if (ticketType === "asset_request") {
      details.module = "asset";
      details.catalogItemId = catalogItem?.id || params.get("itemId") || null;
      details.assetItem = form.assetItem || catalogItem?.name || null;
      details.quantity = Number(form.quantity) || 1;
      details.requestReason = form.requestReason;
      details.neededBy = form.neededBy || null;
      details.deliveryLocation = form.deliveryLocation || null;
      details.eta = catalogItem?.eta || null;
    }

    if (ticketType === "change") {
      details.module = "change";
      details.changeType = form.changeType;
      details.impact = form.changeImpact;
      details.risk = form.changeRisk;
      details.plannedStart = form.plannedStart || null;
      details.plannedEnd = form.plannedEnd || null;
      details.changeReason = form.changeReason.trim();
      details.changePlan = form.changePlan.trim();
      details.backoutPlan = form.backoutPlan.trim();
      details.requiresApproval = ["Major", "Emergency"].includes(form.changeType);
      details.approvalStatus = ["Major", "Emergency"].includes(form.changeType)
        ? "pending"
        : "not_required";
    }


    if (ticketType === "project") {
      details.module = "project";
      details.objective = form.projectObjective.trim();
      details.sponsor = form.projectSponsor.trim();
      details.owner = form.projectOwner.trim();
      details.proposedStart = form.projectStart || null;
      details.targetCompletion = form.projectEnd || null;
      details.scope = form.projectScope.trim();
      details.deliverables = form.projectDeliverables.trim();
    }
    return details;
  }, [form, ticketType, catalogItem, prefillTitle, params]);

  const changeGuidance = useMemo(() => {
    switch (form.changeType) {
      case "Emergency":
        return {
          tone: "red",
          title: "Emergency change — CAB approval required",
          body: "Use only for production-restoring changes. IT will fast-track CAB review after submission.",
        };
      case "Major":
        return {
          tone: "amber",
          title: "Major change — CAB approval required",
          body: "High-impact changes are held in Waiting Approval until CAB (or change manager) authorises rollout.",
        };
      case "Standard":
        return {
          tone: "blue",
          title: "Standard change",
          body: "Pre-approved pattern where available. Still include rollout and backout plans for auditability.",
        };
      default:
        return {
          tone: "slate",
          title: "Minor change",
          body: "Low-risk change with limited blast radius. Plans are still required for traceability.",
        };
    }
  }, [form.changeType]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setDuplicateTicket(null);

    if (!form.title.trim()) {
      return setError("A short summary is required.");
    }

    if (!form.description.trim()) {
      return setError("A detailed description is required.");
    }

    if (ticketType === "incident" && !form.category) {
      return setError("Select an incident category.");
    }

    if (ticketType === "asset_request" && !form.assetItem.trim()) {
      return setError("Select the asset you are requesting.");
    }

    if (ticketType === "change") {
      if (!form.changeReason.trim()) {
        return setError("Reason for Change is required.");
      }
      if (!form.plannedStart || !form.plannedEnd) {
        return setError("Planned start and end dates are required.");
      }
      if (new Date(form.plannedEnd) < new Date(form.plannedStart)) {
        return setError("Planned end must be after the planned start.");
      }
      if (!form.changePlan.trim()) {
        return setError("A rollout plan is required.");
      }
      if (!form.backoutPlan.trim()) {
        return setError("A backout plan is required.");
      }
    }


    if (ticketType === "project") {
      if (!form.projectObjective.trim()) return setError("A business objective is required.");
      if (!form.projectSponsor.trim()) return setError("A project sponsor is required.");
      if (!form.projectOwner.trim()) return setError("A project owner is required.");
      if (!form.projectStart || !form.projectEnd) return setError("Project start and target completion dates are required.");
      if (new Date(form.projectEnd) < new Date(form.projectStart)) return setError("Target completion must be after the project start date.");
      if (!form.projectScope.trim()) return setError("Project scope is required.");
      if (!form.projectDeliverables.trim()) return setError("Project deliverables are required.");
    }
    setSubmitting(true);

    try {
      const category =
        ticketType === "incident"
          ? form.category
          : ticketType === "service_request"
            ? catalogItem?.ticketCategory ||
              catalogItem?.categoryName ||
              "Service Catalog"
            : ticketType === "asset_request"
              ? "Hardware Provisioning"
              : ticketType === "project"
                ? "Project Management"
                : form.category || "Change";

      const subCategory =
        ticketType === "incident"
          ? form.subCategory || null
          : ticketType === "service_request"
            ? catalogItem?.ticketSubCategory ||
              catalogItem?.name ||
              prefillTitle ||
              null
            : ticketType === "asset_request"
              ? catalogItem?.name || form.assetItem || prefillTitle || null
              : ticketType === "project"
                ? form.projectObjective || null
                : form.changeType || null;

      const itemCategory =
        ticketType === "incident"
          ? form.itemCategory || null
          : ticketType === "asset_request"
            ? form.assetItem || null
            : null;

      const response = await ticketsApi.create(
        {
          ticketType,
          requesterId: form.requesterId || undefined,
          title: form.title.trim(),
          description: descriptionBody,
          priority: form.priority,
          workspace: form.workspace,
          assignedGroupId: form.assignedGroupId || null,
          assignedToUserId: form.assignedToUserId || null,
          category,
          subCategory,
          itemCategory,
          impact:
            ticketType === "incident"
              ? form.impact
              : ticketType === "change"
                ? form.changeImpact
                : undefined,
          urgency: ticketType === "incident" ? form.urgency : undefined,
          source: "Portal",
          requestDetails,
        },
        files
      );
      setCreated(response.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      const existing = submitError?.response?.data?.ticket;
      if (submitError?.response?.status === 409 && existing) {
        setDuplicateTicket(existing);
        setError(
          "A similar ticket was created moments ago — it may already be in progress."
        );
      } else {
        setError(message(submitError, "The ticket could not be created."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForAnother = () => {
    setCreated(null);
    setFiles([]);
    setFileNote("");
    setError("");
    setDuplicateTicket(null);
    setForm((current) => ({
      ...current,
      title: "",
      description: "",
      priority: "Medium",
      impact: "Medium",
      urgency: "Medium",
      isMajorIncident: false,
      majorIncidentType: "",
      businessImpact: "",
      impactedLocations: "",
      customersImpacted: "",
      category: "",
      subCategory: "",
      itemCategory: "",
      changeReason: "",
      changePlan: "",
      backoutPlan: "",
      projectObjective: "",
      projectSponsor: "",
      projectOwner: "",
      projectStart: "",
      projectEnd: "",
      projectScope: "",
      projectDeliverables: "",
      plannedStart: "",
      plannedEnd: "",
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dashboardPath = employee
    ? user?.role === "user"
      ? "/"
      : "/employee"
    : "/";

  const backPath =
    module.catalogPath ||
    (employee ? dashboardPath : "/tickets");

  const heading =
    catalogItem?.name ||
    catalogue?.title ||
    module.label;

  const subheading =
    ticketType === "service_request" && catalogItem
      ? catalogItem.description || module.description
      : ticketType === "asset_request" && catalogItem
        ? catalogItem.description || module.description
        : module.description;

  const incidentCategories = fields.incident.categories || [];
  const changeCategories = fields.change.categories?.length
    ? fields.change.categories
    : incidentCategories;
  const assetReasons = fields.asset.reasons?.length
    ? fields.asset.reasons
    : ASSET_REASONS;

  return (
    <OperationsShell
      breadcrumb={`Home > ${module.label}`}
      title={module.label}
      contentClassName="bg-[#eef2f7] px-4 py-4 lg:px-6"
    >
      <div className="mx-auto max-w-6xl pb-10">
        {created ? (
          <div className="animate-fade-up overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
            <div className="bg-gradient-to-br from-[#172b57] to-[#1f376c] p-8 text-center text-white sm:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <CheckCircle2 className="h-9 w-9 text-emerald-300" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/60">
                {module.shortLabel} submitted
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {created.ticket_ref}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm text-white/75">
                {created.title}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  {created.status}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  {created.priority} priority
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  {created.workspace}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                What happens next
              </h2>
              <ol className="mt-4 space-y-3">
                {(created.status === "Waiting Approval"
                  ? [
                      "Your request is waiting for approval before work begins.",
                      "Once approved, it is scheduled and assigned to the right team.",
                      "Track progress and updates any time from My Tickets.",
                    ]
                  : [
                      "IT triages your request and assigns it to the right team.",
                      "You will be notified by email when there is an update or a question.",
                      "Track progress and reply to IT any time from My Tickets.",
                    ]
                ).map((step, index) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172b57]/[0.08] text-xs font-bold text-[#172b57]">
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-600">{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => navigate(`/tickets/${created.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#172b57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1f376c]"
                >
                  View ticket
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/tickets")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <TicketIcon className="h-4 w-4" />
                  My Tickets
                </button>
                <button
                  type="button"
                  onClick={resetForAnother}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Submit another
                </button>
                <button
                  type="button"
                  onClick={() => navigate(dashboardPath)}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:text-[#172b57]"
                >
                  <Home className="h-4 w-4" />
                  Home
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(dashboardPath)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            Home
          </button>
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
          <header className="flex items-center gap-3.5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5 sm:px-8">
            <div className="rounded-2xl bg-[#172b57] p-2.5 text-white shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-950">
                {heading}
              </h1>
              <p className="truncate text-sm text-slate-500">{subheading}</p>
            </div>
            {catalogItem?.eta ? (
              <span className="ml-auto hidden shrink-0 rounded-full bg-[#172b57]/[0.06] px-3 py-1 text-xs font-bold text-[#172b57] sm:inline-flex">
                ETA {catalogItem.eta}
              </span>
            ) : null}
          </header>

          <form onSubmit={submit} className="space-y-6 p-6 sm:p-8">
            {error ? (
              <div
                ref={errorRef}
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <p className="font-bold">{error}</p>
                {duplicateTicket ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/tickets/${duplicateTicket.id}`)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100"
                  >
                    View {duplicateTicket.ticket_ref}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {catalogueKey === "create_for_other" && operational ? (
              <Field label="Requester">
                <select
                  value={form.requesterId}
                  onChange={(event) => update("requesterId", event.target.value)}
                  className="input"
                >
                  <option value="">Select active employee</option>
                  {requesters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.email})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {(ticketType === "service_request" || ticketType === "asset_request") &&
            operational &&
            catalogueKey !== "create_for_other" ? (
              <Field label="Requested for">
                <select
                  value={form.requesterId}
                  onChange={(event) => update("requesterId", event.target.value)}
                  className="input"
                >
                  <option value="">Myself ({user?.name || user?.email || "me"})</option>
                  {requesters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Raise this request on behalf of another employee when needed.
                </p>
              </Field>
            ) : null}

            {catalogItem ? (
              <div className="rounded-2xl border border-[#172b57]/15 bg-[#172b57]/[0.04] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#172b57]/70">
                  Catalog item
                </p>
                <p className="mt-1 font-bold text-slate-950">{catalogItem.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {catalogItem.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                  {catalogItem.categoryName ? (
                    <span>{catalogItem.categoryName}</span>
                  ) : null}
                  {catalogItem.eta ? <span>ETA {catalogItem.eta}</span> : null}
                </div>
              </div>
            ) : null}

            <Field label="Short Summary">
              <input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                className="input"
                required
                placeholder={
                  ticketType === "incident"
                    ? "e.g. Cannot connect to VPN"
                    : ticketType === "change"
                      ? "e.g. Schedule firewall rule update"
                      : "Brief summary of your request"
                }
              />
            </Field>

            <Field
              label={
                ticketType === "change"
                  ? "Description"
                  : "Detailed Description"
              }
            >
              <textarea
                rows={ticketType === "change" ? 4 : 5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                className="input"
                required
                placeholder={
                  ticketType === "incident"
                    ? "What happened, when it started, and who is affected…"
                    : ticketType === "change"
                      ? "Summarise the change and the systems or services involved…"
                      : ticketType === "asset_request"
                        ? "Why do you need this asset, and any specification notes…"
                        : "Provide the details IT needs to fulfil this request…"
                }
              />
            </Field>

            {ticketType === "incident" ? (
              <Section title="Classification">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Common issues
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GUIDED_INCIDENTS.map((guide) => {
                      const GuideIcon = guide.icon;
                      const active =
                        form.category === guide.category &&
                        form.subCategory === guide.subCategory;
                      return (
                        <button
                          key={guide.key}
                          type="button"
                          title={guide.description}
                          onClick={() =>
                            navigate(guidedIncidentPath(guide), {
                              replace: true,
                            })
                          }
                          className={
                            active
                              ? "inline-flex items-center gap-2 rounded-full border border-[#172b57]/30 bg-[#172b57]/[0.08] px-3 py-1.5 text-xs font-bold text-[#172b57]"
                              : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#172b57]/30 hover:text-[#172b57]"
                          }
                        >
                          <GuideIcon className="h-3.5 w-3.5" />
                          {guide.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <CategoryCascade
                  tree={incidentCategories}
                  category={form.category}
                  subCategory={form.subCategory}
                  itemCategory={form.itemCategory}
                  required
                  onChange={({ category, subCategory, itemCategory }) =>
                    setForm((current) => ({
                      ...current,
                      category,
                      subCategory,
                      itemCategory,
                    }))
                  }
                />
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <SegmentedField
                    label="Impact"
                    hint="How many people are affected?"
                    options={fields.incident.impact || []}
                    value={form.impact}
                    onChange={(value) => update("impact", value)}
                  />
                  <SegmentedField
                    label="Urgency"
                    hint="How quickly do you need this fixed?"
                    options={fields.incident.urgency || []}
                    value={form.urgency}
                    onChange={(value) => update("urgency", value)}
                  />
                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(event) => update("priority", event.target.value)}
                      className="input"
                    >
                      {(fields.incident.priority || []).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Suggested from impact × urgency — adjust if needed.
                    </p>
                  </Field>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.isMajorIncident}
                      onChange={(event) =>
                        update("isMajorIncident", event.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#172b57]"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-800">
                        This is a major incident
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Use for widespread outages or severe business disruption.
                      </span>
                    </span>
                  </label>

                  {form.isMajorIncident ? (
                    <div className="mt-4 space-y-4">
                      <Field label="Major incident type">
                        <select
                          value={form.majorIncidentType}
                          onChange={(event) =>
                            update("majorIncidentType", event.target.value)
                          }
                          className="input"
                        >
                          <option value="">Select type</option>
                          {(fields.incident.majorIncidentTypes || []).map(
                            (value) => (
                              <option key={value}>{value}</option>
                            )
                          )}
                        </select>
                      </Field>
                      <Field label="Business impact">
                        <textarea
                          rows="3"
                          value={form.businessImpact}
                          onChange={(event) =>
                            update("businessImpact", event.target.value)
                          }
                          className="input"
                          placeholder="Which business processes or customers are affected?"
                        />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Impacted locations">
                          <input
                            value={form.impactedLocations}
                            onChange={(event) =>
                              update("impactedLocations", event.target.value)
                            }
                            className="input"
                            placeholder="e.g. Plant 2, Head Office"
                          />
                        </Field>
                        <Field label="No. of customers impacted">
                          <input
                            value={form.customersImpacted}
                            onChange={(event) =>
                              update("customersImpacted", event.target.value)
                            }
                            className="input"
                            placeholder="Approximate number"
                          />
                        </Field>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}

            {ticketType === "asset_request" ? (
              <Section title="Asset details">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Requested Item">
                    <input
                      value={form.assetItem}
                      onChange={(event) => update("assetItem", event.target.value)}
                      className="input"
                      required
                      list="asset-item-suggestions"
                      placeholder="Select from catalog or type"
                    />
                    <datalist id="asset-item-suggestions">
                      {[
                        "Laptop",
                        "Office Desktop",
                        "Monitor",
                        "Headset",
                        "Mouse",
                        "Printer",
                        "Android Scanner",
                        "Recover Company Assets",
                      ].map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={form.quantity}
                      onChange={(event) =>
                        update("quantity", Number(event.target.value))
                      }
                      className="input"
                      required
                    />
                  </Field>
                  <Field label="Reason">
                    <select
                      value={form.requestReason}
                      onChange={(event) =>
                        update("requestReason", event.target.value)
                      }
                      className="input"
                    >
                      {assetReasons.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Needed by">
                    <input
                      type="date"
                      value={form.neededBy}
                      onChange={(event) => update("neededBy", event.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Delivery location">
                    <input
                      value={form.deliveryLocation}
                      onChange={(event) =>
                        update("deliveryLocation", event.target.value)
                      }
                      className="input"
                      placeholder="Building, floor, or desk"
                    />
                  </Field>
                </div>
              </Section>
            ) : null}


            {ticketType === "project" ? (
              <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Project initiation</h3>
                  <p className="mt-1 text-sm text-slate-600">Define the business outcome, ownership, schedule, scope and deliverables.</p>
                </div>
                <Field label="Business Objective">
                  <textarea rows="3" value={form.projectObjective} onChange={(event) => update("projectObjective", event.target.value)} className="input" required placeholder="What business outcome should this project achieve?" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Project Sponsor">
                    <input value={form.projectSponsor} onChange={(event) => update("projectSponsor", event.target.value)} className="input" required placeholder="Executive or business sponsor" />
                  </Field>
                  <Field label="Project Owner">
                    <input value={form.projectOwner} onChange={(event) => update("projectOwner", event.target.value)} className="input" required placeholder="Accountable project owner" />
                  </Field>
                  <Field label="Proposed Start Date">
                    <input type="date" value={form.projectStart} onChange={(event) => update("projectStart", event.target.value)} className="input" required />
                  </Field>
                  <Field label="Target Completion Date">
                    <input type="date" min={form.projectStart || undefined} value={form.projectEnd} onChange={(event) => update("projectEnd", event.target.value)} className="input" required />
                  </Field>
                </div>
                <Field label="Project Scope">
                  <textarea rows="4" value={form.projectScope} onChange={(event) => update("projectScope", event.target.value)} className="input" required placeholder="What is included and excluded from the project?" />
                </Field>
                <Field label="Deliverables">
                  <textarea rows="4" value={form.projectDeliverables} onChange={(event) => update("projectDeliverables", event.target.value)} className="input" required placeholder="List the expected outputs and acceptance outcomes." />
                </Field>
              </div>
            ) : null}
            {ticketType === "change" ? (
              <Section title="Change assessment">
                <div
                  className={
                    changeGuidance.tone === "red"
                      ? "mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                      : changeGuidance.tone === "amber"
                        ? "mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                        : changeGuidance.tone === "blue"
                          ? "mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
                          : "mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                  }
                >
                  <p className="font-bold">{changeGuidance.title}</p>
                  <p className="mt-1">{changeGuidance.body}</p>
                </div>
                <SegmentedField
                  label="Change Type"
                  hint="Major and emergency changes need CAB approval before work starts."
                  options={fields.change.changeTypes || []}
                  value={form.changeType}
                  onChange={(value) => update("changeType", value)}
                />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SegmentedField
                    label="Impact"
                    hint="How widely will this change be felt?"
                    options={fields.change.impact || []}
                    value={form.changeImpact}
                    onChange={(value) => update("changeImpact", value)}
                  />
                  <SegmentedField
                    label="Risk"
                    hint="How likely is something to go wrong?"
                    options={fields.change.risk || []}
                    value={form.changeRisk}
                    onChange={(value) => update("changeRisk", value)}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(event) => update("priority", event.target.value)}
                      className="input"
                    >
                      {(fields.change.priority || []).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4">
                  <CategoryCascade
                    tree={changeCategories}
                    category={form.category}
                    subCategory={form.subCategory}
                    itemCategory={form.itemCategory}
                    onChange={({ category, subCategory, itemCategory }) =>
                      setForm((current) => ({
                        ...current,
                        category,
                        subCategory,
                        itemCategory,
                      }))
                    }
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Planned Start Date">
                    <input
                      type="datetime-local"
                      value={form.plannedStart}
                      onChange={(event) =>
                        update("plannedStart", event.target.value)
                      }
                      className="input"
                      required
                    />
                  </Field>
                  <Field label="Planned End Date">
                    <input
                      type="datetime-local"
                      value={form.plannedEnd}
                      min={form.plannedStart || undefined}
                      onChange={(event) =>
                        update("plannedEnd", event.target.value)
                      }
                      className="input"
                      required
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Pick a window outside business hours where possible — IT
                  confirms the final schedule with you.
                </p>
              </Section>
            ) : null}


            {ticketType === "project" ? (
              <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Project initiation</h3>
                  <p className="mt-1 text-sm text-slate-600">Define the business outcome, ownership, schedule, scope and deliverables.</p>
                </div>
                <Field label="Business Objective">
                  <textarea rows="3" value={form.projectObjective} onChange={(event) => update("projectObjective", event.target.value)} className="input" required placeholder="What business outcome should this project achieve?" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Project Sponsor">
                    <input value={form.projectSponsor} onChange={(event) => update("projectSponsor", event.target.value)} className="input" required placeholder="Executive or business sponsor" />
                  </Field>
                  <Field label="Project Owner">
                    <input value={form.projectOwner} onChange={(event) => update("projectOwner", event.target.value)} className="input" required placeholder="Accountable project owner" />
                  </Field>
                  <Field label="Proposed Start Date">
                    <input type="date" value={form.projectStart} onChange={(event) => update("projectStart", event.target.value)} className="input" required />
                  </Field>
                  <Field label="Target Completion Date">
                    <input type="date" min={form.projectStart || undefined} value={form.projectEnd} onChange={(event) => update("projectEnd", event.target.value)} className="input" required />
                  </Field>
                </div>
                <Field label="Project Scope">
                  <textarea rows="4" value={form.projectScope} onChange={(event) => update("projectScope", event.target.value)} className="input" required placeholder="What is included and excluded from the project?" />
                </Field>
                <Field label="Deliverables">
                  <textarea rows="4" value={form.projectDeliverables} onChange={(event) => update("projectDeliverables", event.target.value)} className="input" required placeholder="List the expected outputs and acceptance outcomes." />
                </Field>
              </div>
            ) : null}
            {ticketType === "change" ? (
              <Section title="Planning">
                <Field label="Reason for Change">
                  <textarea
                    rows="3"
                    value={form.changeReason}
                    onChange={(event) =>
                      update("changeReason", event.target.value)
                    }
                    className="input"
                    required
                    placeholder="Why is this change needed? What problem or opportunity does it address?"
                  />
                </Field>
                <Field label="Rollout Plan">
                  <textarea
                    rows="4"
                    value={form.changePlan}
                    onChange={(event) =>
                      update("changePlan", event.target.value)
                    }
                    className="input"
                    required
                    placeholder="Steps to implement the change, owners, and verification checks…"
                  />
                </Field>
                <Field label="Backout Plan">
                  <textarea
                    rows="4"
                    value={form.backoutPlan}
                    onChange={(event) =>
                      update("backoutPlan", event.target.value)
                    }
                    className="input"
                    required
                    placeholder="How will you reverse the change if it fails?"
                  />
                </Field>
              </Section>
            ) : null}

            {ticketType !== "incident" && ticketType !== "change" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) => update("priority", event.target.value)}
                    className="input"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </Field>
                {!employee ? (
                  <Field label="Workspace">
                    <input
                      value={form.workspace}
                      onChange={(event) =>
                        update("workspace", event.target.value)
                      }
                      className="input"
                    />
                  </Field>
                ) : null}
              </div>
            ) : !employee ? (
              <Field label="Workspace">
                <input
                  value={form.workspace}
                  onChange={(event) => update("workspace", event.target.value)}
                  className="input"
                />
              </Field>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowRouting((current) => !current)}
                aria-expanded={showRouting || !employee}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Routing preferences
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Optional — automatic triage by default, or choose an agent.
                    Recommendations come from who resolved similar issues.
                  </span>
                </span>
                <ChevronDown
                  className={
                    showRouting || !employee
                      ? "h-4 w-4 shrink-0 rotate-180 text-slate-400 transition"
                      : "h-4 w-4 shrink-0 text-slate-400 transition"
                  }
                />
              </button>

              {showRouting || !employee ? (
                <div className="grid gap-4 border-t border-slate-200/70 p-4 md:grid-cols-2">
                  <Field label="Assign Agent">
                    <select
                      value={form.assignedToUserId}
                      disabled={loadingAgents}
                      onChange={(event) => selectAgent(event.target.value)}
                      className="input bg-white disabled:bg-slate-100"
                    >
                      <option value="">
                        {loadingAgents
                          ? "Loading agents…"
                          : "Automatic triage — assign to the team"}
                      </option>
                      {recommendedAgents.length ? (
                        <optgroup
                          label={
                            form.category
                              ? `Recommended for ${form.category}`
                              : "Recommended"
                          }
                        >
                          {recommendedAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agentOptionLabel(agent)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {otherAgents.length ? (
                        <optgroup label="All IT agents">
                          {otherAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agentOptionLabel(agent)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      IT may reassign based on workload or specialisation.
                    </p>
                  </Field>
                  <Field label="Support Team">
                    <select
                      value={form.assignedGroupId}
                      onChange={(event) => {
                        const nextGroup = event.target.value;
                        setForm((current) => {
                          const agent = agents.find(
                            (item) =>
                              String(item.id) ===
                              String(current.assignedToUserId)
                          );
                          const stillMember = agent?.groups?.some(
                            (group) => String(group.id) === String(nextGroup)
                          );
                          return {
                            ...current,
                            assignedGroupId: nextGroup,
                            assignedToUserId: stillMember
                              ? current.assignedToUserId
                              : "",
                          };
                        });
                      }}
                      className="input bg-white"
                    >
                      <option value="">Automatic triage</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                          {group.is_default_triage ? " (Recommended)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Follows the agent you pick — set it only to route to a
                      whole team.
                    </p>
                  </Field>
                </div>
              ) : null}
            </div>

            <Field label="Attachments">
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  addFiles(event.dataTransfer.files);
                }}
                className={
                  dragActive
                    ? "block cursor-pointer rounded-2xl border-2 border-dashed border-[#172b57]/50 bg-[#172b57]/[0.04] p-8 text-center transition"
                    : "block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition hover:border-[#172b57]/40 hover:bg-slate-50"
                }
              >
                <UploadCloud className="mx-auto h-8 w-8 text-[#172b57]" />
                <p className="mt-2 font-bold text-slate-800">
                  Drop files here or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, WebP, or PDF — up to 5 files, 8 MB each. Files are
                  uploaded with your request.
                </p>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED.join(",")}
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
              {fileNote ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  {fileNote}
                </p>
              ) : null}
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-[#172b57]" />
                    <span className="truncate font-semibold text-slate-800">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index)
                      )
                    }
                    aria-label={`Remove ${file.name}`}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </Field>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#172b57] px-6 py-3 font-bold text-white transition hover:bg-[#1f376c] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : module.submitLabel}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              <ClipboardList className="h-4 w-4 text-[#172b57]" />
              Your request
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <RailRow
                label="Category"
                value={
                  ticketType === "service_request"
                    ? catalogItem?.categoryName || "Service Catalog"
                    : ticketType === "asset_request"
                      ? form.assetItem || "—"
                      : [form.category, form.subCategory]
                          .filter(Boolean)
                          .join(" · ") || "—"
                }
              />
              <RailRow
                label="Priority"
                value={
                  <span
                    className={
                      form.priority === "Critical" || form.priority === "High"
                        ? "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200"
                        : form.priority === "Low"
                          ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                          : "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200"
                    }
                  >
                    {form.priority}
                  </span>
                }
              />
              {ticketType === "change" ? (
                <>
                  <RailRow label="Change type" value={form.changeType} />
                  <RailRow label="Risk" value={form.changeRisk} />
                  <RailRow
                    label="Window"
                    value={
                      form.plannedStart && form.plannedEnd
                        ? `${form.plannedStart.replace("T", " ")} → ${form.plannedEnd.replace("T", " ")}`
                        : "Not set"
                    }
                  />
                </>
              ) : null}
              <RailRow
                label="Attachments"
                value={files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "None"}
              />
            </dl>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              What happens next
            </h2>
            <ol className="mt-3 space-y-2.5">
              {(ticketType === "change"
                ? [
                    "Your change is assessed for impact and risk.",
                    "Major or emergency changes go to CAB for approval.",
                    "Approved changes are scheduled and you are kept informed.",
                  ]
                : ticketType === "incident"
                  ? [
                      "IT triages your incident by impact and urgency.",
                      "An agent picks it up and may reply with questions.",
                      "You are notified at every update by email.",
                    ]
                  : [
                      "Your request is routed to the fulfilment team.",
                      "Approval is requested first where policy requires it.",
                      "You are notified at every update by email.",
                    ]
              ).map((step, index) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#172b57]/[0.08] text-[11px] font-bold text-[#172b57]">
                    {index + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-600">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {ticketType === "incident" ? (
            <button
              type="button"
              onClick={() => navigate("/knowledge")}
              className="group flex w-full items-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-[#172b57]/30 hover:shadow-md"
            >
              <div className="rounded-2xl bg-[#172b57]/[0.06] p-2.5 text-[#172b57]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Might be a known fix
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Check the help articles — you may solve it in minutes.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#172b57]" />
            </button>
          ) : null}
        </aside>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.values(REQUEST_MODULES)
            .filter((item) => item.ticketType !== ticketType)
            .map((item) => {
              const SiblingIcon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-[#172b57]/30 hover:text-[#172b57]"
                >
                  <SiblingIcon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
        </div>
          </>
        )}
      </div>
    </OperationsShell>
  );
}

function RailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-xs font-semibold text-slate-400">{label}</dt>
      <dd className="truncate text-right font-semibold text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function SegmentedField({ label, hint, options, value, onChange }) {
  return (
    <div>
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={
              value === option
                ? "rounded-lg bg-white px-2 py-2 text-sm font-bold text-[#172b57] shadow-sm ring-1 ring-slate-200"
                : "rounded-lg px-2 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
            }
          >
            {option}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
