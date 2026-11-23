import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
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
import { catalogApi, groupsApi, ticketsApi, userApi, workspaceCatalogueApi, workspacesApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv", "application/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SLA_PREVIEW = {
  Critical: { response: "15 minutes", resolution: "4 hours" },
  High: { response: "30 minutes", resolution: "8 hours" },
  Medium: { response: "4 hours", resolution: "2 days" },
  Low: { response: "8 hours", resolution: "5 days" },
};

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
    priority: ["Low", "Medium"],
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
 * Type comes from route / query / state ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â never a tab switcher.
 */
export default function TicketCreatePage({ lockedType = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, employeeView } = useAuth();

  const operational = OPERATIONS_ROLES.has(user?.role);
  const employee = user?.role === "user" || employeeView;

  const catalogItem = location.state?.catalogItem || null;
  const beneficiary = params.get("beneficiary") || location.state?.beneficiary || "self";
  const requestingForSomeoneElse = beneficiary === "other";

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
  const isBlankOtherIncident = params.get("blank") === "true" || params.get("catalogue") === "other";
  const lockCatalogueTitle = params.get("lockTitle") === "true" && !isBlankOtherIncident;
  const lockCataloguePriority = params.get("lockPriority") === "true" && !isBlankOtherIncident;
  const cataloguePriority = params.get("priority") || "Medium";
  const module = moduleForTicketType(ticketType);
  const Icon = catalogue?.icon || module.icon;
  const linkedAsset = location.state?.asset || null;
  const requestedWorkspace = params.get("workspace") || location.state?.workspace || "";
  const workspaceTicketContext = location.state?.workspaceTicketContext || null;

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
  const prefillDescription = location.state?.prefillDescription || "";

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
  const [reviewing, setReviewing] = useState(false);
  const errorRef = useRef(null);
  const [fields, setFields] = useState(DEFAULT_FIELDS);

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceResolutionError, setWorkspaceResolutionError] =
  useState("");

  const [workspaceCatalogueItems, setWorkspaceCatalogueItems] = useState([]);

  const [catalogueResolutionError, setCatalogueResolutionError] = useState("");
  // REQUEST_FOR_SOMEONE_ELSE_CONTEXT: 'other' requires an explicit requester; 'self' retains the existing authenticated-requester behavior.
  const [form, setForm] = useState({
    requesterId: "",
    title: prefillTitle,
    description: prefillDescription,
    priority: cataloguePriority,
    workspace: requestedWorkspace || module.workspace,
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
    pdmSupervisorUnavailableReason: "",
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

  const isPdmWorkspace = ["pdm", "process engineering", "process engineering (pdm)"].includes(
    String(requestedWorkspace || form.workspace || module.workspace).trim().toLowerCase()
  );
  const isItWorkspace = ["it", "it helpdesk", "it service desk", "it service request"].includes(
    String(requestedWorkspace || form.workspace || module.workspace).trim().toLowerCase()
  );
  const isProductionUser = String(user?.department || "").trim().toLowerCase() === "production";
  const autoRouteTicket = isPdmWorkspace || (isItWorkspace && (employee || isProductionUser));
  const pdmProxyMode =
    isPdmWorkspace && requestingForSomeoneElse && params.get("pdmProxy") === "true";
  const incidentCataloguePath = isPdmWorkspace
    ? `/incidents/new?workspace=PDM${pdmProxyMode ? "&beneficiary=other&pdmProxy=true" : ""}`
    : `/incidents/catalogue?beneficiary=${beneficiary}`;

  const pdmSupervisorRequesters = useMemo(
    () => requesters.filter((item) =>
      String(item.department || "").trim().toLowerCase() === "production" &&
      String(item.job_title || "").trim().toLowerCase().includes("supervisor")
    ),
    [requesters]
  );

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
      workspace: requestedWorkspace || module.workspace,
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
    requestedWorkspace,
    catalogItem?.name,
  ]);

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
          requestingForSomeoneElse ||
          ((ticketType === "service_request" || ticketType === "asset_request") && operational)
        ) {
          const users = requestingForSomeoneElse
            ? await groupsApi.getRequestBeneficiaries()
            : await groupsApi.getRequesters();
          if (!cancelled) {
            const payload = users.data;
            setRequesters(userApi.unwrapUsers(payload).users);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.response?.status === 404
              ? "Some optional supporting information is not configured. Available form sections remain usable."
              : message(
                  loadError,
                  "Supporting information could not be loaded."
                )
          );
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [employee, operational, catalogueKey, ticketType, requestingForSomeoneElse]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAgents(true);

    const loadEligibleAgents = async () => {
      try {
        const primary = employee ? await groupsApi.getCatalogueAgents() : await groupsApi.getAgents({
          category: form.category || undefined,
          subCategory: form.subCategory || undefined,
        });
        const primaryAgents = Array.isArray(primary.data) ? primary.data : [];
        if (primaryAgents.length > 0) return primaryAgents;
      } catch (primaryError) {
        // Continue to the authoritative eligible-agent directory below.
      }

      try {
        const fallback = await groupsApi.getEligibleAgents();
        return Array.isArray(fallback.data) ? fallback.data : [];
      } catch (fallbackError) {
        return [];
      }
    };

    loadEligibleAgents()
      .then((availableAgents) => {
        if (!cancelled) setAgents(availableAgents);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.category, form.subCategory]);

  const eligibleAgents = useMemo(
    () => agents.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [agents]
  );
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
      const defaultGroups = memberGroups.filter(
        (group) => group.isDefaultAssignment === true || group.is_default_assignment === true
      );
      let nextGroupId = current.assignedGroupId;
      if (!keepGroup) {
        nextGroupId =
          defaultGroups.length === 1
            ? String(defaultGroups[0].id)
            : memberGroups.length === 1
              ? String(memberGroups[0].id)
              : "";
      }
      return { ...current, assignedToUserId: value, assignedGroupId: nextGroupId };
    });
  };

  const agentOptionLabel = (agent) =>
    `${agent.name}${agent.job_title ? ` - ${agent.job_title}` : ""}`;
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

  useEffect(() => {
        let cancelled = false;

        const loadWorkspaces = async () => {
          try {
            const response = await workspacesApi.getAll();

            const rows = Array.isArray(response.data)
              ? response.data
              : Array.isArray(response.data?.items)
                ? response.data.items
                : Array.isArray(response.data?.workspaces)
                  ? response.data.workspaces
                  : [];

            if (!cancelled) {
              setWorkspaces(rows);
              setWorkspaceResolutionError("");
            }
          } catch (workspaceError) {
            if (!cancelled) {
              setWorkspaces([]);

              setWorkspaceResolutionError(
                workspaceError.response?.data?.error ||
                  "The managed workspace directory could not be loaded."
              );
            }
          }
        };

        loadWorkspaces();

        return () => {
          cancelled = true;
        };
      }, []);

      const resolvedWorkspace = useMemo(() => {
        const requestedWorkspace = String(
          form.workspace || ""
        )
          .trim()
          .toLowerCase();

        if (!requestedWorkspace) {
          return null;
        }

        const normalizeWorkspace = (value) =>
          String(value || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(
              /\b(service request|service requests|request service|helpdesk)\b/g,
              " "
            )
            .replace(/\s+/g, " ")
            .trim();

        const normalizedRequestedWorkspace =
          normalizeWorkspace(requestedWorkspace);

        return (
          workspaces.find(
            (workspace) =>
              String(workspace.code || "")
                .trim()
                .toLowerCase() === requestedWorkspace
          ) ||
          workspaces.find(
            (workspace) =>
              normalizeWorkspace(workspace.name) ===
                normalizedRequestedWorkspace ||
              normalizeWorkspace(workspace.code) ===
                normalizedRequestedWorkspace
          ) ||
          null
        );
      }, [workspaces, form.workspace]);

      useEffect(() => {
      if (
        !["incident", "service_request"].includes(
          ticketType
        )
      ) {
        setWorkspaceCatalogueItems([]);
        setCatalogueResolutionError("");
        return;
      }

      let cancelled = false;

      const loadCatalogue = async () => {
        try {
          const response =
            await workspaceCatalogueApi.requestOptions({
          workspace: form.workspace,
          catalogueType: ticketType,
          managedCatalogueItemId: catalogItem?.managedCatalogueItemId || undefined,
        });

          if (!cancelled) {
            setWorkspaceCatalogueItems(
              Array.isArray(response.data?.items)
                ? response.data.items
                : []
            );

            setCatalogueResolutionError("");
          }
        } catch (catalogueError) {
          if (!cancelled) {
            setWorkspaceCatalogueItems([]);

            setCatalogueResolutionError(
              catalogueError.response?.data?.error ||
                "The active workspace catalogue could not be loaded."
            );
          }
        }
      };

      loadCatalogue();

      return () => {
        cancelled = true;
      };
    }, [
      ticketType,
      resolvedWorkspace?.id,
      catalogItem?.managedCatalogueItemId,
      workspaceResolutionError,
      workspaces.length,
      form.workspace,
    ]);

  const resolvedWorkspaceCatalogueItem = useMemo(() => {
    if (!["incident", "service_request"].includes(ticketType)) return null;
    const norm = (value) => String(value ?? "").trim().toLowerCase();
    const requestedId = String(
      catalogItem?.managedCatalogueItemId ||
      params.get("managedCatalogueItemId") ||
      params.get("catalogueItemId") ||
      ""
    );
    if (requestedId) {
      const exact = requestedId ? workspaceCatalogueItems.find((item) => String(item.id) === String(requestedId)) : null;
      if (exact) return exact;
    }
    if (!form.category || !form.itemCategory) return null;
    const matches = workspaceCatalogueItems.filter(
      (item) =>
        norm(item.category) === norm(form.category) &&
        norm(item.sub_category) === norm(form.subCategory) &&
        norm(item.item_name) === norm(form.itemCategory)
    );
    return matches.length === 1 ? matches[0] : null;
  }, [
    workspaceCatalogueItems,
    ticketType,
    form.category,
    form.subCategory,
    form.itemCategory,
    catalogItem?.managedCatalogueItemId,
    params,
  ]);
  useEffect(() => {
    if (!resolvedWorkspaceCatalogueItem?.priority_locked) return;
    const defaultPriority = resolvedWorkspaceCatalogueItem.default_priority || "Medium";
    setForm((current) => current.priority === defaultPriority
      ? current
      : { ...current, priority: defaultPriority });
  }, [
    resolvedWorkspaceCatalogueItem?.id,
    resolvedWorkspaceCatalogueItem?.priority_locked,
    resolvedWorkspaceCatalogueItem?.default_priority,
  ]);
  const cataloguePriorityLocked = Boolean(
    lockCataloguePriority || resolvedWorkspaceCatalogueItem?.priority_locked
  );
  useEffect(() => {
    if (ticketType !== "incident" || cataloguePriorityLocked) return;
    const suggested = form.isMajorIncident ? "Critical" : suggestPriority(form.impact, form.urgency);
    setForm((current) => current.priority === suggested ? current : { ...current, priority: suggested });
  }, [form.impact, form.urgency, form.isMajorIncident, ticketType, cataloguePriorityLocked]);
  const incidentPriorityOptions = useMemo(
    () => [...new Set([
      ...(fields.incident.priority || []),
      resolvedWorkspaceCatalogueItem?.default_priority,
      form.priority,
    ].filter(Boolean))],
    [fields.incident.priority, resolvedWorkspaceCatalogueItem?.default_priority, form.priority]
  );
  const incidentSuggestedSummary = useMemo(() => {
    if (ticketType !== "incident") return "";
    return String(
      resolvedWorkspaceCatalogueItem?.default_summary ||
      resolvedWorkspaceCatalogueItem?.item_name ||
      form.itemCategory ||
      form.subCategory ||
      form.category ||
      ""
    ).trim();
  }, [ticketType, resolvedWorkspaceCatalogueItem, form.itemCategory, form.subCategory, form.category]);

  // OTHER_CATEGORY_SELECTION: one catalogue-level Other item; requester selects a high-level category.
  const selectedCatalogueIsOther = Boolean(
    resolvedWorkspaceCatalogueItem &&
      (resolvedWorkspaceCatalogueItem.is_other === true ||
        (!isPdmWorkspace && String(resolvedWorkspaceCatalogueItem.item_name || "").trim().toLowerCase() === "other"))
  );
  const otherCategoryOptions = [
    "Hardware / Equipment",
    "Application Software",
    "Network",
    "Office Applications",
  ];
  const requestDetails = useMemo(() => {
    const details = {};

    if (ticketType === "incident") {
      details.module = "incident";
      details.catalogItemId =
      resolvedWorkspaceCatalogueItem?.id ||
      catalogItem?.id ||
      params.get("catalogueItemId") ||
      null;

      details.catalogItemName =
      resolvedWorkspaceCatalogueItem?.item_name ||
      catalogItem?.name ||
      params.get("itemName") ||
      form.itemCategory ||
      prefillTitle ||
      null;

      details.catalogCategory =
      (selectedCatalogueIsOther ? form.category : resolvedWorkspaceCatalogueItem?.category) ||
      catalogItem?.categoryName ||
      form.category ||
      null;

      details.catalogSubCategory =
      resolvedWorkspaceCatalogueItem?.sub_category ||
       catalogItem?.subCategory ||
       catalogItem?.sub_category ||
       form.subCategory ||
       null;

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

      details.catalogItemId =
        resolvedWorkspaceCatalogueItem?.id || null;

      details.catalogItemName = resolvedWorkspaceCatalogueItem?.item_name || catalogItem?.name || params.get("itemName") || prefillTitle || null;
      details.catalogCategory = resolvedWorkspaceCatalogueItem?.category || catalogItem?.categoryName || null;
      details.catalogSubCategory = resolvedWorkspaceCatalogueItem?.sub_category || catalogItem?.subCategory || catalogItem?.sub_category || null;
    }

    if (ticketType === "asset_request") {
      details.module = "asset";

      details.catalogItemId =
        catalogItem?.id ||
        params.get("itemId") ||
        params.get("catalogueItemId") ||
        null;

      details.assetItem =
      form.assetItem ||
      catalogItem?.name ||
      null;

      details.quantity =
      Number(form.quantity) ||
      1;

      details.requestReason =
      form.requestReason;

      details.neededBy =
      form.neededBy ||
      null;

      details.deliveryLocation =
      form.deliveryLocation ||
      null;

      details.eta =
      catalogItem?.eta ||
      null;
    }

    if (ticketType === "change") {
      details.module = "change";
      details.changeType =
      form.changeType;
      details.impact =
      form.changeImpact;
      details.risk =
      form.changeRisk;
      details.plannedStart =
      form.plannedStart ||
      null;
      details.plannedEnd =
      form.plannedEnd ||
      null;
      details.changeReason =
      form.changeReason.trim();
      details.changePlan =
      form.changePlan.trim();
      details.backoutPlan =
      form.backoutPlan.trim();
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
    if (workspaceTicketContext?.projectId) {
      details.projectWorkspaceId = String(workspaceTicketContext.projectId);
      details.projectWorkspaceName = String(workspaceTicketContext.projectName || "");
    }
    if (workspaceTicketContext?.source) {
      details.originatingWorkspace = String(workspaceTicketContext.source);
    }
    if (workspaceTicketContext?.station) {
      details.lineStation = String(workspaceTicketContext.station);
    }
    if (pdmProxyMode) {
      details.pdmSupervisorLoginUnavailable = true;
      details.pdmSupervisorLoginUnavailableReason = form.pdmSupervisorUnavailableReason.trim();
    }
    return details;
  }, [form, ticketType, catalogItem, prefillTitle, params, resolvedWorkspaceCatalogueItem, workspaceTicketContext, pdmProxyMode]);


  // SCRIPT_989_CLASSIFICATION_SUMMARY_SYNC
  const priorSuggestedSummaryRef = useRef("");
  useEffect(() => {
    if (ticketType !== "incident" || !incidentSuggestedSummary) return;
    setForm((current) => {
      const currentTitle = String(current.title || "").trim();
      const prior = priorSuggestedSummaryRef.current;
      const shouldSync = !currentTitle || currentTitle === prior || lockCatalogueTitle || currentTitle === prefillTitle;
      if (!shouldSync || currentTitle === incidentSuggestedSummary) return current;
      return { ...current, title: incidentSuggestedSummary };
    });
    priorSuggestedSummaryRef.current = incidentSuggestedSummary;
  }, [ticketType, incidentSuggestedSummary, lockCatalogueTitle, prefillTitle]);

  const changeGuidance = useMemo(() => {
    switch (form.changeType) {
      case "Emergency":
        return {
          tone: "red",
          title: "Emergency change - CAB approval required",
          body: "Use only for production-restoring changes. IT will fast-track CAB review after submission.",
        };
      case "Major":
        return {
          tone: "amber",
          title: "Major change - CAB approval required",
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
    const catalogueSummary = resolvedWorkspaceCatalogueItem?.item_name || form.itemCategory || prefillTitle;
    const ticketTitle = form.title.trim() || (
      autoRouteTicket && ["incident", "service_request"].includes(ticketType) ? catalogueSummary : ""
    );
    const generatedDescription = autoRouteTicket &&
      ["incident", "service_request"].includes(ticketType) &&
      resolvedWorkspaceCatalogueItem
      ? `Reported issue: ${[
        resolvedWorkspaceCatalogueItem.category,
        resolvedWorkspaceCatalogueItem.sub_category,
        resolvedWorkspaceCatalogueItem.item_name,
      ].filter(Boolean).join(" / ")}. No additional details were provided at intake.`
      : "";
    const ticketDescription = descriptionBody || generatedDescription;

    if (requestingForSomeoneElse && !form.requesterId) {
      setError("Select the employee this ticket is for before submitting.");
      return;
    }
    if (isPdmWorkspace && requestingForSomeoneElse && !pdmProxyMode) {
      setError("Only Production operators may submit a PDM report on behalf of a supervisor.");
      return;
    }
    if (pdmProxyMode && form.pdmSupervisorUnavailableReason.trim().length < 10) {
      setError("Explain why the supervisor cannot access their email account (at least 10 characters).");
      return;
    }

    setError("");
    setDuplicateTicket(null);
    setReviewing(false);

    if (!ticketTitle) {
      return setError("A short summary is required.");
    }

    if (ticketType === "incident" && selectedCatalogueIsOther && !otherCategoryOptions.includes(form.category)) {
      return setError("Select whether the Other incident is Hardware / Equipment, Application Software, Network, or Office Applications.");
    }
    if (!ticketDescription) {
      return setError("A detailed description is required.");
    }
    if (!autoRouteTicket && !form.assignedToUserId) {
      if (!employee) return setError("Select an eligible agent before reviewing this request.");
    }
    if (!autoRouteTicket && !form.assignedGroupId) {
      return setError("Select a support team for the chosen agent.");
    }

    if (ticketType === "incident" && !form.category) {
      return setError("Select an incident category.");
    }

    if (
  ticketType === "incident" &&
  form.subCategory &&
  !form.itemCategory &&
  !resolvedWorkspaceCatalogueItem
) {
  return setError(
    "Select the specific catalogue item for this incident before reviewing the request."
    );
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
    if (!reviewing && !autoRouteTicket) {
      setReviewing(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (["incident", "service_request"].includes(ticketType) && !resolvedWorkspaceCatalogueItem) {
      return setError(
  catalogueResolutionError ||
    "Select a valid active catalogue item before submitting this request."
);
    }
    setSubmitting(true);

    try {
      const category =
        ticketType === "incident"
          ? resolvedWorkspaceCatalogueItem?.category || form.category
          : ticketType === "service_request"
            ? catalogItem?.ticketCategory ||
              catalogItem?.categoryName ||
              "Service Catalog"
            : ticketType === "asset_request"
              ? "Hardware Provisioning"
              : ticketType === "project"
                ? "Project Management"
                : ticketType === "incident" ? resolvedWorkspaceCatalogueItem?.category || "Incident" : form.category || "Change";

      const subCategory =
        ticketType === "incident"
          ? resolvedWorkspaceCatalogueItem?.sub_category || form.subCategory || null
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
          ? resolvedWorkspaceCatalogueItem?.item_name || form.itemCategory || null
          : ticketType === "asset_request"
            ? form.assetItem || null
            : null;

      const response = await ticketsApi.create(
        {
          ticketType,
          requesterId: form.requesterId || undefined,
          title: ticketTitle,
          description: ticketDescription,
          priority: employee && !isPdmWorkspace && !form.isMajorIncident && ["High", "Critical"].includes(form.priority) ? "Medium" : form.priority,
          workspace: form.workspace,
          assignedGroupId: form.assignedGroupId || null,
          assignedToUserId: form.assignedToUserId,
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
          source: pdmProxyMode
            ? "PDM Operator Proxy"
            : isPdmWorkspace
              ? "PDM Line Issue"
              : workspaceTicketContext?.source || "Portal",
          requestDetails,
        },
        files
      );
      setCreated(response.data);
      setReviewing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      const existing = submitError?.response?.data?.ticket;
      if (submitError?.response?.status === 409 && existing) {
        setDuplicateTicket(existing);
        setError(
          "A similar ticket was created moments ago - it may already be in progress."
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
    setReviewing(false);
    setForm((current) => ({
      ...current,
      requesterId: pdmProxyMode ? "" : current.requesterId,
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
      pdmSupervisorUnavailableReason: "",
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

  const incidentCategories = useMemo(() => {
    if (ticketType !== "incident" || workspaceCatalogueItems.length === 0) {
      return fields.incident.categories || [];
    }

    const categoryMap = new Map();

    for (const item of workspaceCatalogueItems) {
      const category = String(item.category || item.categoryName || item.ticketCategory || "").trim();
      const subCategory = String(item.sub_category || "").trim();
      const itemName = String(item.item_name || "").trim();
      if (!category) continue;

      if (!categoryMap.has(category)) categoryMap.set(category, new Map());
      const subCategoryMap = categoryMap.get(category);
      if (!subCategoryMap.has(subCategory)) subCategoryMap.set(subCategory, new Set());
      if (itemName) subCategoryMap.get(subCategory).add(itemName);
    }

    return Array.from(categoryMap.entries(), ([category, subCategoryMap]) => ({
      value: category,
      children: Array.from(subCategoryMap.entries(), ([subCategory, itemNames]) => ({
        value: subCategory,
        children: Array.from(itemNames)
          .sort((a, b) => a.localeCompare(b))
          .map((itemName) => ({ value: itemName })),
      })),
    }));
  }, [fields.incident.categories, ticketType, workspaceCatalogueItems]);

  useEffect(() => {
    if (ticketType !== "incident" || workspaceCatalogueItems.length === 0) return;

    const norm = (value) => String(value ?? "").trim().toLowerCase();
    const categoryItems = workspaceCatalogueItems.filter(
      (item) => norm(item.category) === norm(form.category)
    );

    if (form.category && categoryItems.length === 0) {
      setForm((current) => ({
        ...current,
        category: "",
        subCategory: "",
        itemCategory: "",
      }));
      return;
    }

    const subCategoryItems = categoryItems.filter(
      (item) => norm(item.sub_category) === norm(form.subCategory)
    );

    if (form.subCategory && subCategoryItems.length === 0) {
      setForm((current) => ({
        ...current,
        subCategory: "",
        itemCategory: "",
      }));
      return;
    }

    if (
      form.itemCategory &&
      !subCategoryItems.some(
        (item) => norm(item.item_name) === norm(form.itemCategory)
      )
    ) {
      setForm((current) => ({ ...current, itemCategory: "" }));
    }
  }, [
    ticketType,
    workspaceCatalogueItems,
    form.category,
    form.subCategory,
    form.itemCategory,
  ]);
  const changeCategories = fields.change.categories?.length
    ? fields.change.categories
    : incidentCategories;
  const assetReasons = fields.asset.reasons?.length
    ? fields.asset.reasons
    : ASSET_REASONS;
  const selectedRequester = requesters.find(
    (item) => String(item.id) === String(form.requesterId)
  );
  const selectedGroup = groups.find(
    (item) => String(item.id) === String(form.assignedGroupId)
  );
  const selectedAgent = agents.find(
    (item) => String(item.id) === String(form.assignedToUserId)
  );
  const reviewRequester = selectedRequester || user;
  const slaPreview = SLA_PREVIEW[form.priority] || SLA_PREVIEW.Medium;
  const reviewCategory =
    ticketType === "service_request"
      ? resolvedWorkspaceCatalogueItem?.category || catalogItem?.ticketCategory || catalogItem?.categoryName || "Service Catalog"
      : ticketType === "asset_request"
        ? "Hardware Provisioning"
        : ticketType === "project"
          ? "Project Management"
          : ticketType === "incident" ? resolvedWorkspaceCatalogueItem?.category || "Incident" : form.category || "Change";
  const reviewSubCategory =
    ticketType === "incident"
      ? resolvedWorkspaceCatalogueItem?.sub_category || null
      : ticketType === "service_request"
        ? resolvedWorkspaceCatalogueItem?.sub_category || catalogItem?.ticketSubCategory || catalogItem?.name || prefillTitle || null
        : ticketType === "asset_request"
          ? catalogItem?.name || form.assetItem || prefillTitle || null
          : ticketType === "project"
            ? form.projectObjective || null
            : form.changeType || null;

  if (reviewing && !created) {
    return (
      <OperationsShell
        breadcrumb={`Home > ${module.label} > Review`}
        title={`Review ${module.shortLabel}`}
        contentClassName="ticket-create-page bg-[var(--portal-bg)] px-4 py-4 lg:px-6"
      >
        <div className="mx-auto max-w-6xl pb-10">
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
            <header className="border-b border-slate-100 bg-gradient-to-br from-[#172b57] to-[#1f376c] px-6 py-6 text-white sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Final review</p>
              <h1 className="mt-2 text-2xl font-bold">Check the request before it is logged</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/75">
                No ticket has been created yet. Confirm the requester, classification, routing, recipients and attachments below.
              </p>
            </header>
            <div className="grid gap-5 p-6 lg:grid-cols-2 sm:p-8">
              <ReviewSection title="Request">
                <ReviewRow label="Request type" value={module.label} />
                <ReviewRow label="Requested for" value={reviewRequester?.name || reviewRequester?.email || "Current account"} />
                <ReviewRow label="Subject" value={form.title.trim()} />
                <ReviewRow label="Priority" value={form.priority} />
                <ReviewRow label="Workspace" value={form.workspace} />
                <ReviewRow label="Expected first response" value={slaPreview.response} />
                <ReviewRow label="Expected resolution" value={slaPreview.resolution} />
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Targets are calculated from the selected priority when the ticket is created. The governed backend policy remains authoritative.</p>
              </ReviewSection>
              <ReviewSection title="Classification and routing">
                <ReviewRow label="Category" value={reviewCategory || "Not specified"} />
                <ReviewRow label="Subcategory" value={reviewSubCategory || "Not specified"} />
                {ticketType === "incident" ? (
                  <ReviewRow
                    label="Item"
                    value={
                      resolvedWorkspaceCatalogueItem?.item_name ||
                      form.itemCategory ||
                      "Not selected"
                    }
                  />
                ) : null}
                {ticketType === "incident" ? <ReviewRow label="Impact / urgency" value={`${form.impact} / ${form.urgency}`} /> : null}
                <ReviewRow label="Support group" value={selectedGroup?.name || "Not selected"} />
                <ReviewRow label="Selected agent" value={selectedAgent?.name || "Not selected"} />
                <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                  A selected agent is proposed only. Accepted ownership begins after the agent selects Accept and Action.
                </p>
              </ReviewSection>
              <ReviewSection title="Description">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{descriptionBody}</p>
              </ReviewSection>
              <ReviewSection title="Communication and files">
                <ReviewRow label="Requester" value={reviewRequester?.email || "Account notification"} />
                <ReviewRow label="Support group" value={selectedGroup?.notification_email || selectedGroup?.name || "Not selected"} />
                <ReviewRow label="Selected agent" value={selectedAgent?.name || "Not selected"} />
                <ReviewRow label="Attachments" value={files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "None"} />
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  Email remains governed by the system email mode and recipient preferences. Development email may remain disabled while in-app notifications continue.
                </p>
              </ReviewSection>
              {files.length ? (
                <ReviewSection title="Attached files" className="lg:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {files.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <FileText className="h-4 w-4 text-[#172b57]" />
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{file.name}</span>
                        <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </ReviewSection>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
              <button
                type="button"
                onClick={() => {
                  setReviewing(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                Back and Edit
              </button>
              <button
                type="button"
                onClick={() => submit({ preventDefault() {} })}
                disabled={submitting}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#172b57] px-6 py-3 text-sm font-bold text-white hover:bg-[#1f376c] disabled:opacity-60"
              >
                {submitting ? "Creating ticket..." : "Confirm and Submit"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </OperationsShell>
    );
  }
  if (ticketType === "incident" && !resolvedWorkspaceCatalogueItem && !isPdmWorkspace) {
    return (
      <OperationsShell breadcrumb="Home > Report an Incident" title="Report an Incident" contentClassName="ticket-create-page bg-[var(--portal-bg)] px-4 py-4 lg:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <h1 className="text-xl font-black text-slate-950">Choose an Incident from the catalogue</h1>
          <p className="mt-2 text-sm text-slate-600">Incident category, sub-category and item are governed by Workspace Catalogue Manager and cannot be selected manually on this form.</p>
          <button type="button" onClick={() => navigate(incidentCataloguePath)} className="mt-5 rounded-xl bg-[#172b57] px-5 py-3 text-sm font-bold text-white">Open Incident Catalogue</button>
        </div>
      </OperationsShell>
    );
  }
  return (
    <OperationsShell
      breadcrumb={`Home > ${module.label}`}
      title={module.label}
      contentClassName="ticket-create-page bg-[var(--portal-bg)] px-4 py-4 lg:px-6"
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
              {created.catalogueNotice ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  {created.catalogueNotice}
                </p>
              ) : null}
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

            {requestingForSomeoneElse ? (
              <Field label={pdmProxyMode ? "Production supervisor this report is for" : "Requester"}>
                <select
                  value={form.requesterId}
                  onChange={(event) => update("requesterId", event.target.value)}
                  className="input"
                >
                  <option value="">{pdmProxyMode ? "Select active Production supervisor" : "Select active employee"}</option>
                  {(pdmProxyMode ? pdmSupervisorRequesters : requesters).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.email})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {pdmProxyMode ? (
              <Field label="Why can't the supervisor access their email account?">
                <textarea
                  rows={3}
                  value={form.pdmSupervisorUnavailableReason}
                  onChange={(event) => update("pdmSupervisorUnavailableReason", event.target.value)}
                  className="input"
                  minLength={10}
                  required={!autoRouteTicket}
                  placeholder="Describe the email sign-in problem preventing the supervisor from reporting this issue."
                />
              </Field>
            ) : null}

            {(ticketType === "service_request" || ticketType === "asset_request") &&
            operational &&
            !requestingForSomeoneElse ? (
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

            {!isPdmWorkspace ? <Field label="Short Summary">
              <input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                disabled={lockCatalogueTitle}
                readOnly={lockCatalogueTitle}
                aria-describedby={lockCatalogueTitle ? "catalogue-title-lock" : undefined}
                className="input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-700"
                required={!autoRouteTicket}
                placeholder={
                  ticketType === "incident"
                    ? "e.g. Cannot connect to VPN"
                    : ticketType === "change"
                      ? "e.g. Schedule firewall rule update"
                      : "Brief summary of your request"
                }
              />
              {lockCatalogueTitle ? (
                <p id="catalogue-title-lock" className="mt-1 text-xs font-semibold text-slate-500">
                  Short Summary is governed by the selected catalogue item.
                </p>
              ) : null}
            </Field> : (
              <p className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                Summary is generated from the selected PDM catalogue item.
              </p>
            )}

            {!isPdmWorkspace ? <Field
              label={autoRouteTicket ? "Additional details (optional)" : ticketType === "change" ? "Description" : "Detailed Description"}
            >
              <textarea
                rows={ticketType === "change" ? 4 : 5}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                className="input"
                required
                placeholder={
                  ticketType === "incident"
                    ? "What happened, when it started, and who is affected..."
                    : ticketType === "change"
                      ? "Summarise the change and the systems or services involved..."
                      : ticketType === "asset_request"
                        ? "Why do you need this asset, and any specification notes..."
                        : "Provide the details IT needs to fulfil this request..."
                }
              />
            </Field> : null}

            {ticketType === "incident" ? (
              <Section title="Classification">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Incident catalogue item</p>
  <h3 className="mt-2 text-base font-black text-slate-950">{resolvedWorkspaceCatalogueItem?.item_name || "Select an Incident from the catalogue"}</h3>
  <p className="mt-1 text-sm text-slate-600">{resolvedWorkspaceCatalogueItem ? [resolvedWorkspaceCatalogueItem.category, resolvedWorkspaceCatalogueItem.sub_category].filter(Boolean).join(" / ") : "A governed catalogue item is required before the Incident can be submitted."}</p>
  {isPdmWorkspace ? (
    <div className="mt-4">
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
      <p className="mt-2 text-xs text-slate-500">Choose the application, machine, or process issue from the managed PDM line catalogue.</p>
    </div>
  ) : (
    <button type="button" onClick={() => navigate(incidentCataloguePath)} className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Choose another Incident</button>
  )}
</div>
                {selectedCatalogueIsOther ? (
                  <Field label="Category">
                    <select
                      value={form.category}
                      onChange={(event) => update("category", event.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Select the type of issue</option>
                      {otherCategoryOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">The catalogue item remains Other. Choose the closest category so IT can route and review the unlisted issue.</p>
                  </Field>
                ) : null}
                <div className={`mt-4 grid gap-4 ${isPdmWorkspace ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
                  {!isPdmWorkspace ? (
                    <>
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
                    </>
                  ) : null}
                  <Field label="Priority">
                    <select
                      value={form.priority}
                      onChange={(event) => update("priority", event.target.value)}
                      disabled={cataloguePriorityLocked || form.isMajorIncident}
                      aria-describedby={cataloguePriorityLocked ? "catalogue-priority-lock" : undefined}
                      className="input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-700"
                    >
                      {incidentPriorityOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      {cataloguePriorityLocked ? "Priority is governed by the selected catalogue item." : "Suggested from impact and urgency - adjust if needed."}
                    </p>
                  </Field>
                </div>

                {!isPdmWorkspace && (
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
                )}
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
                  Pick a window outside business hours where possible - IT
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
                    placeholder="Steps to implement the change, owners, and verification checks..."
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

            {autoRouteTicket ? (
              <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5">
                <h2 className="text-sm font-bold text-slate-800">Automatic support routing</h2>
                <p className="mt-1 text-xs text-slate-600">
                  {isPdmWorkspace
                    ? "This line issue will be routed to the PDM Line Support group."
                    : isProductionUser
                      ? "Production Network issues are routed to the IT support group."
                      : "Your request will be routed to the appropriate IT support group."}
                </p>
              </section>
            ) : (
            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Select an agent <span className="text-red-600">*</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Helpdesk operations may propose an eligible agent. Employee requests are submitted to the governed support-group queue for acceptance.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Assigned agent">
                  <select
                    value={form.assignedToUserId}
                    disabled={loadingAgents}
                    required
                    aria-required="true"
                    onChange={(event) => selectAgent(event.target.value)}
                    className="input bg-white disabled:bg-slate-100"
                  >
                    <option value="" disabled>
                      {loadingAgents ? "Loading eligible agents..." : "Select an eligible agent"}
                    </option>
                    {eligibleAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agentOptionLabel(agent)}
                      </option>
                    ))}
                  </select>
                  {!loadingAgents && agents.length === 0 ? (
                    <p className="mt-1 text-xs font-semibold text-red-700">
                      No eligible agents are currently listed. The request can still enter the governed support-group queue.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Only active, governed IT support-group members are shown. IT may reassign the ticket later when operationally necessary.
                    </p>
                  )}
                </Field>
                <Field label="Support team">
                  <select
                    value={form.assignedGroupId}
                    required
                    aria-required="true"
                    onChange={(event) => {
                      const nextGroup = event.target.value;
                      setForm((current) => {
                        const agent = agents.find(
                          (item) => String(item.id) === String(current.assignedToUserId)
                        );
                        const stillMember = agent?.groups?.some(
                          (group) => String(group.id) === String(nextGroup)
                        );
                        return {
                          ...current,
                          assignedGroupId: nextGroup,
                          assignedToUserId: stillMember ? current.assignedToUserId : "",
                        };
                      });
                    }}
                    className="input bg-white"
                  >
                    <option value="" disabled>Select a support team</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}{group.is_default_triage ? " (Recommended)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    The selected agent must be an active member of this team.
                  </p>
                </Field>
              </div>
            </section>
            )}
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
                  PNG, JPG, WebP, PDF, TXT, CSV, XLS, or XLSX - up to 5 files, 8 MB each. Files are
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
                disabled={submitting || (!autoRouteTicket && (!form.assignedToUserId || !form.assignedGroupId))}
                className="rounded-xl bg-[#172b57] px-6 py-3 font-bold text-white transition hover:bg-[#1f376c] disabled:opacity-60"
              >
                {submitting
                  ? "Submitting..."
                  : autoRouteTicket
                    ? isPdmWorkspace ? "Submit line issue" : "Submit ticket"
                    : "Review request"}
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
                      ? form.assetItem || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"
                      : ticketType === "incident"
                        ? [resolvedWorkspaceCatalogueItem?.category, resolvedWorkspaceCatalogueItem?.sub_category].filter(Boolean)
                        : [form.category, form.subCategory]
                          .filter(Boolean)
                          .join(" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ -  ") || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"
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
                        ? `${form.plannedStart.replace("T", " ")} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’â€¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ${form.plannedEnd.replace("T", " ")}`
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
                      "The selected agent receives your incident with its impact and urgency.",
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
                  Check the help articles - you may solve it in minutes.
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

function ReviewSection({ title, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="max-w-[68%] text-right text-sm font-semibold text-slate-800">{value}</span>
    </div>
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
