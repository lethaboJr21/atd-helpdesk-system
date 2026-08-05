/**
 * Live Freshservice catalog + form-field mirror for the employee request portals.
 *
 * Prefers the Freshservice REST API (cached), falls back to archived fs_records
 * so the Service / Asset catalogs stay truthful even if the API is briefly down.
 */

const freshservice = require("./freshserviceClient");
const pool = require("../db/pool");

const HARDWARE_CATEGORY_ID = 55000007597;
const DATA_SERVICES_CATEGORY_ID = 55000007599;
const APPLICATION_ACCESS_CATEGORY_ID = 55000007600;
const SOFTWARE_INSTALL_CATEGORY_ID = 55000007598;
const COLLABORATION_CATEGORY_ID = 55000007601;
const NETWORK_ACCESS_CATEGORY_ID = 55000043210;
const WORKPLACE_ACCESS_CATEGORY_ID = "atd-workplace-access";
const SYSPRO_CATEGORY_ID = "atd-syspro";
const QMUZIK_CATEGORY_ID = "atd-qmuzik";
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * ATD-local catalog supplements grounded in Freshservice ticket history.
 * Freshservice never published these as catalog items, but the ticket corpus
 * shows clear request demand — so the portal catalog must include them.
 */
const ATD_SERVICE_SUPPLEMENTS = [
  // --- Syspro (access, install, and master-data corrections) ---
  {
    id: "atd-md-bom",
    name: "BOM Updates",
    description:
      "Request a bill-of-materials correction or linkage update in Syspro.",
    categoryId: SYSPRO_CATEGORY_ID,
    categoryName: "Syspro",
    ticketCategory: "Master Data Correction",
    ticketSubCategory: "BOM Updates",
    popular: true,
    iconName: "syspro-bom",
  },
  {
    id: "atd-md-purchase",
    name: "Purchase Price Correction",
    description: "Request a correction to purchase prices in Syspro master data.",
    categoryId: SYSPRO_CATEGORY_ID,
    categoryName: "Syspro",
    ticketCategory: "Master Data Correction",
    ticketSubCategory: "Purchase Prices",
    popular: true,
    iconName: "syspro-purchase",
  },
  {
    id: "atd-md-sales",
    name: "Sales Price Correction",
    description: "Request a correction to sales prices in Syspro master data.",
    categoryId: SYSPRO_CATEGORY_ID,
    categoryName: "Syspro",
    ticketCategory: "Master Data Correction",
    ticketSubCategory: "Sales Prices",
    popular: false,
    iconName: "syspro-sales",
  },
  {
    id: "atd-md-stock",
    name: "Stock Code Correction",
    description: "Request a stock code create, amend, or correction in Syspro.",
    categoryId: SYSPRO_CATEGORY_ID,
    categoryName: "Syspro",
    ticketCategory: "Master Data Correction",
    ticketSubCategory: "Stock Codes",
    popular: true,
    iconName: "syspro-stock",
  },

  // --- QMuzik (access + install; FS only published Client Install) ---
  {
    id: "atd-qmuzik-access",
    name: "QMuzik Access",
    description:
      "Request QMuzik access, environment setup, or role changes.",
    categoryId: QMUZIK_CATEGORY_ID,
    categoryName: "QMuzik",
    ticketCategory: "Application Software",
    ticketSubCategory: "QMuzik",
    popular: true,
    iconName: "qmuzik-access",
  },

  // --- Network Access ---
  {
    id: "atd-net-wifi",
    name: "WiFi Access",
    description: "Request corporate WiFi access or help connecting to WiFi.",
    categoryId: String(NETWORK_ACCESS_CATEGORY_ID),
    categoryName: "Network Access",
    ticketCategory: "Network",
    ticketSubCategory: "Wifi Access",
    popular: true,
    iconName: "network-wifi",
  },
  {
    id: "atd-net-firewall",
    name: "Firewall Rule / Access",
    description:
      "Request a firewall rule change or access through the corporate firewall.",
    categoryId: String(NETWORK_ACCESS_CATEGORY_ID),
    categoryName: "Network Access",
    ticketCategory: "Network",
    ticketSubCategory: "Firewall",
    popular: false,
    iconName: "network-firewall",
  },

  // --- Application Access ---
  {
    id: "atd-app-sharepoint",
    name: "SharePoint Access",
    description: "Request access to a SharePoint site, library, or folder.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Application Software",
    ticketSubCategory: "Sharepoint",
    popular: true,
    iconName: "app-sharepoint",
  },
  {
    id: "atd-app-ritescan",
    name: "RiteScan Access",
    description: "Request access to RiteScan.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Application Software",
    ticketSubCategory: "RiteScan",
    popular: true,
    iconName: "app-ritescan",
  },
  {
    id: "atd-app-p2p",
    name: "P2P Application Access",
    description: "Request access to the P2P application.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Application Software",
    ticketSubCategory: "P2P Application",
    popular: false,
    iconName: "app-p2p",
  },
  {
    id: "atd-app-cad",
    name: "CAD Access",
    description: "Request access to CAD applications or drawings.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Application Software",
    ticketSubCategory: "CAD",
    popular: false,
    iconName: "app-cad",
  },
  {
    id: "atd-app-kepware",
    name: "Kepware Access",
    description: "Request access to Kepware.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Application Software",
    ticketSubCategory: "Kepware",
    popular: false,
    iconName: "app-kepware",
  },
  {
    id: "atd-app-printer-access",
    name: "Printer Access",
    description: "Request access to an existing office or label printer.",
    categoryId: String(APPLICATION_ACCESS_CATEGORY_ID),
    categoryName: "Application Access",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Office Printers",
    popular: true,
    iconName: "app-printer-access",
  },

  // --- Software Installation ---
  {
    id: "atd-sw-ritescan",
    name: "RiteScan Client Install",
    description: "Request installation of the RiteScan client.",
    categoryId: String(SOFTWARE_INSTALL_CATEGORY_ID),
    categoryName: "Software Installation",
    ticketCategory: "Application Software",
    ticketSubCategory: "RiteScan",
    popular: false,
    iconName: "sw-ritescan",
  },
  {
    id: "atd-sw-cad",
    name: "CAD Client Install",
    description: "Request installation of CAD software.",
    categoryId: String(SOFTWARE_INSTALL_CATEGORY_ID),
    categoryName: "Software Installation",
    ticketCategory: "Application Software",
    ticketSubCategory: "CAD",
    popular: false,
    iconName: "sw-cad",
  },
  {
    id: "atd-sw-kepware",
    name: "Kepware Client Install",
    description: "Request installation of the Kepware client.",
    categoryId: String(SOFTWARE_INSTALL_CATEGORY_ID),
    categoryName: "Software Installation",
    ticketCategory: "Application Software",
    ticketSubCategory: "Kepware",
    popular: false,
    iconName: "sw-kepware",
  },

  // --- Collaboration ---
  {
    id: "atd-col-mailbox",
    name: "Mailbox Access",
    description:
      "Request a mailbox, shared mailbox access, or email delivery help.",
    categoryId: String(COLLABORATION_CATEGORY_ID),
    categoryName: "Collaboration",
    ticketCategory: "Office Applications",
    ticketSubCategory: "Mailbox",
    popular: true,
    iconName: "col-mailbox",
  },
  {
    id: "atd-col-ad-account",
    name: "New AD / Email Account",
    description:
      "Request creation of an Active Directory and email account for a new starter.",
    categoryId: String(COLLABORATION_CATEGORY_ID),
    categoryName: "Collaboration",
    ticketCategory: "Employee Onboarding/Offboarding",
    ticketSubCategory: "Onboarding",
    popular: false,
    iconName: "col-ad-account",
  },
  {
    id: "atd-col-offboard",
    name: "Account Offboarding",
    description:
      "Request disablement or offboarding of an AD / email account.",
    categoryId: String(COLLABORATION_CATEGORY_ID),
    categoryName: "Collaboration",
    ticketCategory: "Employee Management",
    ticketSubCategory: "Offboarding",
    popular: false,
    iconName: "col-offboard",
  },

  // --- Workplace Access (ATD virtual category) ---
  {
    id: "atd-wp-cctv",
    name: "CCTV Footage Request",
    description: "Request CCTV / surveillance footage for investigation.",
    categoryId: WORKPLACE_ACCESS_CATEGORY_ID,
    categoryName: "Workplace Access",
    ticketCategory: "Workplace Access and Security",
    ticketSubCategory: "Surveillance system",
    popular: false,
    iconName: "wp-cctv",
  },
  {
    id: "atd-wp-badge",
    name: "Access Badge",
    description: "Request a new or replacement workplace access badge.",
    categoryId: WORKPLACE_ACCESS_CATEGORY_ID,
    categoryName: "Workplace Access",
    ticketCategory: "Workplace Access and Security",
    ticketSubCategory: "Access badge",
    popular: false,
    iconName: "wp-badge",
  },
  {
    id: "atd-wp-biometric",
    name: "Biometric Access",
    description: "Request biometric access enrolment or troubleshooting.",
    categoryId: WORKPLACE_ACCESS_CATEGORY_ID,
    categoryName: "Workplace Access",
    ticketCategory: "Workplace Access and Security",
    ticketSubCategory: "Biometric system",
    popular: false,
    iconName: "wp-biometric",
  },
];

const ATD_ASSET_SUPPLEMENTS = [
  {
    id: "atd-asset-mobile",
    name: "Mobile Device",
    description: "Request a company mobile phone or handheld device.",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Mobile Phone",
    popular: true,
    iconName: "asset-mobile",
    kind: "asset",
  },
  {
    id: "atd-asset-label-printer",
    name: "Label Printer",
    description: "Request a label printer (e.g. RSB or Blowmoulding).",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Label Printers",
    popular: true,
    iconName: "asset-label-printer",
    kind: "asset",
  },
  {
    id: "atd-asset-sim",
    name: "SIM Card",
    description: "Request a corporate SIM card for mobile connectivity.",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Mobile Phone",
    popular: false,
    iconName: "asset-sim",
    kind: "asset",
  },
  {
    id: "atd-asset-keyboard",
    name: "Keyboard",
    description: "Request a keyboard for your workstation.",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Laptop / Computer",
    popular: false,
    iconName: "asset-keyboard",
    kind: "asset",
  },
  {
    id: "atd-asset-dock",
    name: "Docking Station",
    description: "Request a docking station for laptop use.",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Laptop / Computer",
    popular: false,
    iconName: "asset-dock",
    kind: "asset",
  },
  {
    id: "atd-asset-charger",
    name: "Laptop Charger",
    description: "Request a replacement laptop charger.",
    categoryId: String(HARDWARE_CATEGORY_ID),
    categoryName: "Hardware Provisioning",
    ticketCategory: "Hardware /Equipment",
    ticketSubCategory: "Laptop / Computer",
    popular: false,
    iconName: "asset-charger",
    kind: "asset",
  },
];

const ITEM_DESCRIPTIONS = {
  Omnex: "Request access to the Omnex quality management system.",
  "Password Reset": "Request help resetting or unlocking your account password.",
  "Revoke Application Access": "Request removal of application access for a user.",
  "Syspro Access": "Request Syspro ERP access or role changes.",
  "Microsoft Teams": "Request Teams access, channel help, or meeting support.",
  "Data Backup": "Request a data backup for files, folders, or systems.",
  "File restore": "Request restoration of a deleted or corrupted file.",
  "DMS Access": "Request access to the Document Management System.",
  "Android Scanner": "Request a handheld Android scanner for warehouse or shop-floor use.",
  Monitor: "Request a new or additional monitor.",
  Headset: "Request a headset for meetings and calls.",
  Mouse: "Request a new mouse or pointing device.",
  "Office Desktop": "Request assignment of a desktop computer.",
  Printer: "Request a printer, printer access, or printer provisioning.",
  "Recover Company Assets": "Request recovery or return of company-issued assets.",
  Laptop: "Request a new or replacement laptop.",
  "VPN Access": "Request or troubleshoot remote VPN connectivity.",
  "Office 365": "Request Office 365 licence, mailbox, or app access.",
  "QMuzik Client Install": "Request installation of the QMuzik client.",
  "QMuzik Access":
    "Request QMuzik access, environment setup, or role changes.",
  "Syspro Client Install": "Request installation of the Syspro client.",
  "VPN Client": "Request installation of the corporate VPN client.",
  "BOM Updates":
    "Request a bill-of-materials correction or linkage update in Syspro.",
  "Purchase Price Correction":
    "Request a correction to purchase prices in master data.",
  "Sales Price Correction":
    "Request a correction to sales prices in master data.",
  "Stock Code Correction":
    "Request a stock code create, amend, or correction.",
  "WiFi Access": "Request corporate WiFi access or help connecting to WiFi.",
  "Firewall Rule / Access":
    "Request a firewall rule change or access through the corporate firewall.",
  "SharePoint Access":
    "Request access to a SharePoint site, library, or folder.",
  "RiteScan Access": "Request access to RiteScan.",
  "P2P Application Access": "Request access to the P2P application.",
  "CAD Access": "Request access to CAD applications or drawings.",
  "Kepware Access": "Request access to Kepware.",
  "Printer Access": "Request access to an existing office or label printer.",
  "RiteScan Client Install": "Request installation of the RiteScan client.",
  "CAD Client Install": "Request installation of CAD software.",
  "Kepware Client Install": "Request installation of the Kepware client.",
  "Mailbox Access":
    "Request a mailbox, shared mailbox access, or email delivery help.",
  "New AD / Email Account":
    "Request creation of an Active Directory and email account for a new starter.",
  "Account Offboarding":
    "Request disablement or offboarding of an AD / email account.",
  "CCTV Footage Request":
    "Request CCTV / surveillance footage for investigation.",
  "Access Badge": "Request a new or replacement workplace access badge.",
  "Biometric Access":
    "Request biometric access enrolment or troubleshooting.",
  "Mobile Device": "Request a company mobile phone or handheld device.",
  "Label Printer": "Request a label printer (e.g. RSB or Blowmoulding).",
  "SIM Card": "Request a corporate SIM card for mobile connectivity.",
  Keyboard: "Request a keyboard for your workstation.",
  "Docking Station": "Request a docking station for laptop use.",
  "Laptop Charger": "Request a replacement laptop charger.",
};

const POPULAR_SERVICE = new Set([
  "password reset",
  "vpn access",
  "syspro access",
  "qmuzik access",
  "microsoft teams",
  "office 365",
  "dms access",
  "file restore",
  "bom updates",
  "purchase price correction",
  "stock code correction",
  "wifi access",
  "sharepoint access",
  "ritescan access",
  "printer access",
  "mailbox access",
]);

const POPULAR_ASSET = new Set([
  "laptop",
  "office desktop",
  "monitor",
  "headset",
  "mouse",
  "mobile device",
  "label printer",
  "printer",
]);

const IT_CATEGORY_NAMES = new Set([
  "Hardware /Equipment",
  "Application Software",
  "Office Applications",
  "Network",
  "Master Data Correction",
  "Workplace Access and Security",
  "Other",
]);

const cache = {
  catalog: null,
  catalogExpires: 0,
  fields: null,
  fieldsExpires: 0,
};

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name) {
  return String(name || "").trim();
}

function describeItem(name) {
  const key = normalizeName(name);
  if (ITEM_DESCRIPTIONS[key]) return ITEM_DESCRIPTIONS[key];
  const withoutSpace = Object.keys(ITEM_DESCRIPTIONS).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );
  if (withoutSpace) return ITEM_DESCRIPTIONS[withoutSpace];
  return `Request ${key} from IT.`;
}

function etaLabel(hours) {
  if (hours == null || hours === "") return null;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} Hrs`;
}

function simplifyTree(nodes = []) {
  return nodes.map((node) => ({
    value: node.value,
    children: simplifyTree(node.nested_options || node.children || []),
  }));
}

function mapItem(raw, categoryName) {
  const name = normalizeName(raw.name);
  const categoryId = Number(raw.category_id || raw.parent_fs_id);
  const isHardware = categoryId === HARDWARE_CATEGORY_ID;
  return {
    id: String(raw.id || raw.fs_id),
    name,
    description: describeItem(name),
    categoryId: String(categoryId),
    categoryName: categoryName || null,
    deliveryTimeHours: raw.delivery_time ?? null,
    eta: etaLabel(raw.delivery_time),
    allowQuantity: Boolean(raw.allow_quantity),
    allowAttachments: Boolean(raw.allow_attachments),
    iconName: raw.icon_name || null,
    popular: isHardware
      ? POPULAR_ASSET.has(name.toLowerCase())
      : POPULAR_SERVICE.has(name.toLowerCase()),
    kind: isHardware ? "asset" : "service",
  };
}

async function loadFromFreshservice() {
  if (!freshservice.isConfigured()) return null;

  const [categoriesBody, items] = await Promise.all([
    freshservice.get("/api/v2/service_catalog/categories"),
    freshservice.fetchAll("/api/v2/service_catalog/items", "service_items"),
  ]);

  const categories = (categoriesBody?.service_categories || [])
    .filter((category) => !category.deleted)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((category) => ({
      id: String(category.id),
      name: normalizeName(category.name),
      description: stripHtml(category.description),
      position: category.position,
      kind: Number(category.id) === HARDWARE_CATEGORY_ID ? "asset" : "service",
    }));

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const mappedItems = items
    .filter((item) => !item.deleted && Number(item.visibility) !== 1)
    .map((item) =>
      mapItem(item, categoryNames.get(String(item.category_id)))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return { categories, items: mappedItems, source: "freshservice" };
}

async function loadFromArchive() {
  const [categoriesResult, itemsResult] = await Promise.all([
    pool.query(
      `SELECT fs_id, name, parent_fs_id, raw
       FROM fs_records
       WHERE kind = 'service_category'
       ORDER BY COALESCE((raw->>'position')::int, 999), name`
    ),
    pool.query(
      `SELECT fs_id, name, parent_fs_id, raw
       FROM fs_records
       WHERE kind = 'service_item'
       ORDER BY name`
    ),
  ]);

  const categories = categoriesResult.rows.map((row) => ({
    id: String(row.fs_id),
    name: normalizeName(row.name),
    description: stripHtml(row.raw?.description),
    position: Number(row.raw?.position) || 999,
    kind: Number(row.fs_id) === HARDWARE_CATEGORY_ID ? "asset" : "service",
  }));

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const items = itemsResult.rows
    .filter((row) => row.raw?.deleted !== true && Number(row.raw?.visibility) !== 1)
    .map((row) =>
      mapItem(
        { ...row.raw, id: row.fs_id, name: row.name, category_id: row.parent_fs_id },
        categoryNames.get(String(row.parent_fs_id))
      )
    );

  return { categories, items, source: "archive" };
}

function mapSupplement(item) {
  const kind = item.kind === "asset" ? "asset" : "service";
  return {
    id: item.id,
    name: item.name,
    description: item.description || describeItem(item.name),
    categoryId: String(item.categoryId),
    categoryName: item.categoryName,
    ticketCategory: item.ticketCategory || null,
    ticketSubCategory: item.ticketSubCategory || null,
    deliveryTimeHours: item.deliveryTimeHours ?? null,
    eta: etaLabel(item.deliveryTimeHours),
    allowQuantity: kind === "asset",
    allowAttachments: true,
    iconName: item.iconName,
    popular: Boolean(item.popular),
    kind,
    source: "atd",
  };
}

function ensureCategory(categories, { id, name, description, kind, position }) {
  const exists = categories.some(
    (category) =>
      String(category.id) === String(id) || category.name === name
  );
  if (exists) return categories;
  return [
    ...categories,
    {
      id: String(id),
      name,
      description: description || "",
      position: position ?? 99,
      kind,
    },
  ];
}

function mergeAtDSupplements(catalog) {
  if (!catalog) return catalog;

  let categories = [...(catalog.categories || [])];
  categories = ensureCategory(categories, {
    id: SYSPRO_CATEGORY_ID,
    name: "Syspro",
    description: "Syspro access, client install, and master-data corrections.",
    kind: "service",
    position: 0,
  });
  categories = ensureCategory(categories, {
    id: QMUZIK_CATEGORY_ID,
    name: "QMuzik",
    description: "QMuzik access and client install.",
    kind: "service",
    position: 1,
  });
  categories = ensureCategory(categories, {
    id: DATA_SERVICES_CATEGORY_ID,
    name: "Data Services",
    description: "Backups and file restore.",
    kind: "service",
    position: 4,
  });
  categories = ensureCategory(categories, {
    id: WORKPLACE_ACCESS_CATEGORY_ID,
    name: "Workplace Access",
    description: "Badges, biometrics, and CCTV footage requests.",
    kind: "service",
    position: 20,
  });
  categories = ensureCategory(categories, {
    id: HARDWARE_CATEGORY_ID,
    name: "Hardware Provisioning",
    description: "Equipment and peripherals.",
    kind: "asset",
    position: 3,
  });

  const existingNames = new Set(
    (catalog.items || []).map((item) => item.name.toLowerCase())
  );

  const supplements = [...ATD_SERVICE_SUPPLEMENTS, ...ATD_ASSET_SUPPLEMENTS]
    .filter((item) => !existingNames.has(item.name.toLowerCase()))
    .map(mapSupplement);

  // Pull Freshservice ERP app items into dedicated categories.
  const APP_CATEGORY_REMAP = [
    { pattern: /syspro/i, categoryId: SYSPRO_CATEGORY_ID, categoryName: "Syspro" },
    {
      pattern: /qmuzik|qmusik|qmuzic/i,
      categoryId: QMUZIK_CATEGORY_ID,
      categoryName: "QMuzik",
    },
  ];

  const items = [...(catalog.items || []), ...supplements]
    .map((item) => {
      const remap = APP_CATEGORY_REMAP.find((entry) =>
        entry.pattern.test(item.name || "")
      );
      if (!remap) return item;
      const isInstall = /install/i.test(item.name || "");
      return {
        ...item,
        categoryId: remap.categoryId,
        categoryName: remap.categoryName,
        ticketCategory:
          item.ticketCategory ||
          (isInstall ? "Software Installation" : "Application Software"),
        ticketSubCategory:
          item.ticketSubCategory ||
          (isInstall ? item.name : remap.categoryName),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Keep ERP apps near the top of the category list for employees.
  const PINNED = new Set(["Syspro", "QMuzik"]);
  categories = categories.sort((a, b) => {
    const aPin = PINNED.has(a.name) ? 0 : 1;
    const bPin = PINNED.has(b.name) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return (a.position || 999) - (b.position || 999) || a.name.localeCompare(b.name);
  });

  return { ...catalog, categories, items };
}

async function getCatalog(force = false) {
  if (!force && cache.catalog && Date.now() < cache.catalogExpires) {
    return cache.catalog;
  }

  let catalog;
  try {
    catalog = await loadFromFreshservice();
  } catch (error) {
    console.error("Freshservice catalog fetch failed:", error.message);
  }

  if (!catalog?.items?.length) {
    catalog = await loadFromArchive();
  }

  if (!catalog?.items?.length) {
    throw new Error("Service catalog is unavailable.");
  }

  catalog = mergeAtDSupplements(catalog);
  cache.catalog = catalog;
  cache.catalogExpires = Date.now() + CACHE_TTL_MS;
  return catalog;
}

function partitionCatalog(catalog) {
  const serviceCategories = catalog.categories.filter((c) => c.kind === "service");
  const assetCategories = catalog.categories.filter((c) => c.kind === "asset");
  const serviceItems = catalog.items.filter((i) => i.kind === "service");
  const assetItems = catalog.items.filter((i) => i.kind === "asset");

  return {
    source: catalog.source,
    service: {
      categories: serviceCategories,
      items: serviceItems,
    },
    asset: {
      categories: assetCategories.length
        ? assetCategories
        : [{ id: String(HARDWARE_CATEGORY_ID), name: "Hardware Provisioning", description: "", kind: "asset" }],
      items: assetItems,
    },
  };
}

async function loadFormFieldsFromFreshservice() {
  if (!freshservice.isConfigured()) return null;

  const [ticketBody, changeBody] = await Promise.all([
    freshservice.get("/api/v2/ticket_form_fields"),
    freshservice.get("/api/v2/change_form_fields"),
  ]);

  const ticketFields = ticketBody?.ticket_fields || ticketBody?.ticket_form_fields || [];
  const changeFields = changeBody?.change_fields || [];

  const categoryField = ticketFields.find((field) => field.name === "category");
  const allCategories = simplifyTree(categoryField?.choices || []);
  const incidentCategories = allCategories.filter((node) =>
    IT_CATEGORY_NAMES.has(node.value)
  );

  const pickChoices = (fields, name) =>
    (fields.find((field) => field.name === name)?.choices || []).map(
      (choice) => choice.value
    );

  return {
    source: "freshservice",
    incident: {
      categories: incidentCategories.length ? incidentCategories : allCategories,
      impact: pickChoices(ticketFields, "impact"),
      urgency: pickChoices(ticketFields, "urgency"),
      priority: ["Low", "Medium", "High", "Critical"],
      majorIncidentTypes: pickChoices(ticketFields, "major_incident_type"),
    },
    change: {
      changeTypes: pickChoices(changeFields, "change_type"),
      impact: pickChoices(changeFields, "impact"),
      risk: pickChoices(changeFields, "risk"),
      priority: pickChoices(changeFields, "priority").map((value) =>
        value === "Urgent" ? "Critical" : value
      ),
      categories: incidentCategories.length ? incidentCategories : allCategories,
    },
    asset: {
      reasons: [
        "New Item",
        "Replacement",
        "Additional Item",
        "Temporary Loan",
        "Repair",
        "Return",
        "Lost or Missing",
        "Damaged",
      ],
    },
  };
}

function fallbackFormFields() {
  return {
    source: "fallback",
    incident: {
      categories: [
        {
          value: "Hardware /Equipment",
          children: [
            {
              value: "Laptop / Computer",
              children: [
                { value: "Laptop", children: [] },
                { value: "PC", children: [] },
                { value: "Other", children: [] },
              ],
            },
            {
              value: "Monitor",
              children: [{ value: "Not Working", children: [] }],
            },
            {
              value: "Mobile Phone",
              children: [
                { value: "New Issue", children: [] },
                { value: "Replacement", children: [] },
                { value: "Report Loss", children: [] },
              ],
            },
          ],
        },
        {
          value: "Application Software",
          children: [
            {
              value: "Syspro",
              children: [
                { value: "Syspro Not Accessible", children: [] },
                { value: "Function cannot be used", children: [] },
                { value: "Others", children: [] },
              ],
            },
            {
              value: "QMuzik",
              children: [
                { value: "Cannot Connect", children: [] },
                { value: "Cannot Transact", children: [] },
              ],
            },
            { value: "Others", children: [] },
          ],
        },
        {
          value: "Office Applications",
          children: [
            { value: "Office365", children: [] },
            { value: "Mailbox", children: [] },
            { value: "Teams", children: [] },
          ],
        },
        {
          value: "Network",
          children: [
            { value: "Wifi Access", children: [] },
            { value: "VPN Access", children: [] },
            { value: "Firewall", children: [] },
          ],
        },
        { value: "Other", children: [] },
      ],
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
    asset: {
      reasons: [
        "New Item",
        "Replacement",
        "Additional Item",
        "Temporary Loan",
        "Repair",
        "Return",
        "Lost or Missing",
        "Damaged",
      ],
    },
  };
}

async function getFormFields(force = false) {
  if (!force && cache.fields && Date.now() < cache.fieldsExpires) {
    return cache.fields;
  }

  let fields;
  try {
    fields = await loadFormFieldsFromFreshservice();
  } catch (error) {
    console.error("Freshservice form fields fetch failed:", error.message);
  }

  if (!fields) fields = fallbackFormFields();
  if (!fields.change.categories?.length) {
    fields.change.categories = fields.incident.categories;
  }

  cache.fields = fields;
  cache.fieldsExpires = Date.now() + CACHE_TTL_MS;
  return fields;
}

module.exports = {
  HARDWARE_CATEGORY_ID,
  getCatalog,
  partitionCatalog,
  getFormFields,
  clearCache() {
    cache.catalog = null;
    cache.catalogExpires = 0;
    cache.fields = null;
    cache.fieldsExpires = 0;
  },
};
