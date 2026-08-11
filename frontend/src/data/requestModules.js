import {
  BriefcaseBusiness,
  ClipboardCheck,
  FolderKanban,
  KeyRound,
  Laptop,
  LifeBuoy,
  Monitor,
  PackagePlus,
  Printer,
  ShoppingCart,
} from "lucide-react";

/**
 * Four top-level request modules — separate portals, not tabs on one form.
 * Catalog contents come from Freshservice via /api/catalog/*.
 */

export const REQUEST_MODULES = {
  incident: {
    key: "incident",
    ticketType: "incident",
    label: "Report an Incident",
    shortLabel: "Incident",
    description: "Something is broken, unavailable, or working incorrectly.",
    path: "/incidents/new",
    catalogPath: null,
    workspace: "IT",
    icon: LifeBuoy,
    tone: "green",
    submitLabel: "Submit Incident",
  },
  service: {
    key: "service",
    ticketType: "service_request",
    label: "Request a Service",
    shortLabel: "Service",
    description: "Browse IT services and raise a standard service request.",
    path: "/services",
    catalogPath: "/services",
    formPath: "/services/request",
    workspace: "IT Service Request",
    icon: ShoppingCart,
    tone: "amber",
    submitLabel: "Submit Service Request",
  },
  asset: {
    key: "asset",
    ticketType: "asset_request",
    label: "Request an Asset",
    shortLabel: "Asset",
    description: "Request new, replacement, or temporary equipment.",
    path: "/request-asset",
    catalogPath: "/request-asset",
    formPath: "/request-asset/new",
    workspace: "IT Service Request",
    icon: PackagePlus,
    tone: "indigo",
    submitLabel: "Submit Asset Request",
  },
  change: {
    key: "change",
    ticketType: "change",
    label: "Request a Change",
    shortLabel: "Change",
    description: "Request a planned change that needs assessment and scheduling.",
    path: "/changes/new",
    catalogPath: null,
    workspace: "Change Management",
    icon: BriefcaseBusiness,
    tone: "teal",
    submitLabel: "Submit Change Request",
  },
  project: {
    key: "project",
    ticketType: "project",
    label: "Create a Project",
    shortLabel: "Project",
    description: "Initiate a structured project with objectives, ownership, dates and deliverables.",
    path: "/projects/new",
    catalogPath: null,
    workspace: "Project Management",
    icon: FolderKanban,
    tone: "purple",
    submitLabel: "Create Project",
  },};

/**
 * High-volume incident shortcuts from Freshservice history (Syspro, printers).
 * Prefill category tree on /incidents/new — not separate modules.
 */
export const GUIDED_INCIDENTS = [
  {
    key: "syspro_issue",
    title: "Syspro issue",
    description: "Syspro not accessible or a function cannot be used.",
    icon: Monitor,
    tone: "amber",
    category: "Application Software",
    subCategory: "Syspro",
    itemCategory: "",
    prefillTitle: "Syspro issue",
  },
  {
    key: "qmuzik_issue",
    title: "QMuzik issue",
    description: "QMuzik access, connection, or transaction problems.",
    icon: Monitor,
    tone: "amber",
    category: "Application Software",
    subCategory: "QMuzik",
    itemCategory: "",
    prefillTitle: "QMuzik issue",
  },
  {
    key: "printer_issue",
    title: "Printer or scanner issue",
    description: "Unable to print, connect, or use a printer/scanner.",
    icon: Printer,
    tone: "indigo",
    category: "Hardware /Equipment",
    subCategory: "Office Printers",
    itemCategory: "",
    prefillTitle: "Printer issue",
  },
  {
    key: "laptop_issue",
    title: "Laptop or PC issue",
    description: "Laptop or desktop not working correctly.",
    icon: Laptop,
    tone: "green",
    category: "Hardware /Equipment",
    subCategory: "Laptop / Computer",
    itemCategory: "",
    prefillTitle: "Laptop / PC issue",
  },
];

/** Legacy catalogue keys used by assets page and deep links */
export const LEGACY_CATALOGUE = {
  asset_request: { title: "Request an Asset", type: "asset_request" },
  asset_problem: { title: "Report an Asset Problem", type: "incident" },
  asset_replacement: {
    title: "Request Asset Replacement",
    type: "asset_request",
  },
  laptop_checkup: { title: "Laptop Checkup", type: "incident", icon: Laptop },
  device_registration: {
    title: "Register Current Device",
    type: "service_request",
    icon: ClipboardCheck,
  },
  create_for_other: {
    title: "Create a Ticket for Someone Else",
    type: "incident",
  },
};

export const ASSET_REASONS = [
  "New Item",
  "Replacement",
  "Additional Item",
  "Temporary Loan",
  "Repair",
  "Return",
  "Lost or Missing",
  "Damaged",
];

/** Freshservice-aligned impact × urgency → priority (ITIL style). */
export function suggestPriority(impact, urgency) {
  const rank = { Low: 1, Medium: 2, High: 3 };
  const score = (rank[impact] || 2) + (rank[urgency] || 2);
  if (score >= 6) return "Critical";
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

export function moduleForTicketType(ticketType) {
  return (
    Object.values(REQUEST_MODULES).find(
      (module) => module.ticketType === ticketType
    ) || REQUEST_MODULES.incident
  );
}

export function formPathForType(ticketType, options = {}) {
  const module = moduleForTicketType(ticketType);
  const params = new URLSearchParams();

  if (options.catalogue) params.set("catalogue", options.catalogue);
  if (options.item) params.set("item", options.item);
  if (options.itemId) params.set("itemId", options.itemId);
  if (options.prefillTitle) params.set("title", options.prefillTitle);
  if (options.assetItem) params.set("assetItem", options.assetItem);
  if (options.category) params.set("category", options.category);
  if (options.subCategory) params.set("subCategory", options.subCategory);
  if (options.itemCategory) params.set("itemCategory", options.itemCategory);

  const query = params.toString();
  const base =
    module.formPath ||
    module.path ||
    `/tickets/new?type=${module.ticketType}`;

  if (base.includes("?")) {
    return query ? `${base}&${query}` : base;
  }

  return query ? `${base}?${query}` : base;
}

export function guidedIncidentPath(guide) {
  return formPathForType("incident", {
    prefillTitle: guide.prefillTitle || guide.title,
    category: guide.category,
    subCategory: guide.subCategory,
    itemCategory: guide.itemCategory,
  });
}

/** Icon hint from Freshservice icon_name / item title. */
export function catalogIconHint(item = {}) {
  const haystack = `${item.iconName || ""} ${item.name || ""}`.toLowerCase();
  if (haystack.includes("password") || haystack.includes("key")) return KeyRound;
  if (haystack.includes("laptop")) return Laptop;
  if (haystack.includes("clipboard") || haystack.includes("register")) {
    return ClipboardCheck;
  }
  if (haystack.includes("package") || haystack.includes("hardware")) {
    return PackagePlus;
  }
  return ShoppingCart;
}
