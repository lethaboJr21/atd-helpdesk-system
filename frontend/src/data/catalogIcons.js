/**
 * Unique ATD catalog artwork for Service / Asset catalog cards.
 * Product-style hardware shots + soft 3D service marks — not Freshservice clones.
 */

const BASE = "/helpdesk/catalog-icons";

const ICON_FILES = {
  // Hardware / assets
  Monitor: "monitor.png",
  Mouse: "mouse.png",
  "Office Desktop": "office-desktop.png",
  Laptop: "laptop.png",
  Headset: "headset.png",
  Printer: "printer.png",
  "Android Scanner": "android-scanner.png",
  "Docking Station": "dock.png",
  "Laptop Charger": "charger.png",
  Keyboard: "keyboard.png",
  "Mobile Device": "mobile.png",
  "SIM Card": "sim.png",
  "Label Printer": "label-printer.png",
  "Recover Company Assets": "recover-assets.png",

  // Access / collaboration / network — official / supplied brand marks where available
  "Password Reset": "password-reset.png",
  "VPN Access": "vpn.png",
  "VPN Client": "vpn.png",
  "Microsoft Teams": "brand-teams.png",
  "Office 365": "brand-office365.png",
  "Mailbox Access": "brand-outlook.png",
  "WiFi Access": "wifi.png",
  "Firewall Rule / Access": "firewall.png",
  "Data Backup": "backup.png",
  "File restore": "file-restore.png",
  "Access Badge": "badge.png",
  "Biometric Access": "biometric.png",
  "CCTV Footage Request": "cctv.png",
  "Revoke Application Access": "revoke.png",
  "SharePoint Access": "brand-sharepoint.png",
  "DMS Access": "dms.png",
  "New AD / Email Account": "ad-new.png",
  "Account Offboarding": "ad-offboard.png",

  // ERP / apps — official brand marks
  "Syspro Access": "brand-syspro.png",
  "Syspro Client Install": "brand-syspro.png",
  "BOM Updates": "brand-syspro.png",
  "Purchase Price Correction": "brand-syspro.png",
  "Sales Price Correction": "brand-syspro.png",
  "Stock Code Correction": "brand-syspro.png",
  "QMuzik Access": "brand-qmuzik.png",
  "QMuzik Client Install": "brand-qmuzik.png",
  Omnex: "brand-omnex.png",
  "CAD Access": "brand-autocad.png",
  "CAD Client Install": "brand-autocad.png",
  "RiteScan Access": "brand-ritescan.png",
  "RiteScan Client Install": "brand-ritescan.png",
  "P2P Application Access": "p2p.png",
  "Kepware Access": "brand-kepware.png",
  "Kepware Client Install": "brand-kepware.png",
  "Printer Access": "printer.png",
};

const PATTERN_FALLBACKS = [
  { match: /monitor/i, file: "monitor.png" },
  { match: /mouse/i, file: "mouse.png" },
  { match: /desktop|workstation/i, file: "office-desktop.png" },
  { match: /laptop|notebook/i, file: "laptop.png" },
  { match: /headset|headphone/i, file: "headset.png" },
  { match: /label\s*printer/i, file: "label-printer.png" },
  { match: /printer|print/i, file: "printer.png" },
  { match: /scanner|android/i, file: "android-scanner.png" },
  { match: /dock/i, file: "dock.png" },
  { match: /charger|power\s*adapter/i, file: "charger.png" },
  { match: /keyboard|mx\s*keys|\bkeys\b|peripheral/i, file: "keyboard.png" },
  { match: /mobile|phone|handset/i, file: "mobile.png" },
  { match: /sim/i, file: "sim.png" },
  { match: /syspro|bom|stock code|purchase price|sales price/i, file: "brand-syspro.png" },
  { match: /qmuzik|qmusik|qmuzic/i, file: "brand-qmuzik.png" },
  { match: /password|unlock/i, file: "password-reset.png" },
  { match: /vpn/i, file: "vpn.png" },
  { match: /teams/i, file: "brand-teams.png" },
  { match: /office\s*365|o365/i, file: "brand-office365.png" },
  { match: /mailbox|email|outlook/i, file: "brand-outlook.png" },
  { match: /wifi|wi-fi/i, file: "wifi.png" },
  { match: /firewall/i, file: "firewall.png" },
  { match: /backup/i, file: "backup.png" },
  { match: /restore|file\s*restore/i, file: "file-restore.png" },
  { match: /badge/i, file: "badge.png" },
  { match: /biometric|fingerprint/i, file: "biometric.png" },
  { match: /cctv|surveillance|camera/i, file: "cctv.png" },
  { match: /revoke/i, file: "revoke.png" },
  { match: /sharepoint/i, file: "brand-sharepoint.png" },
  { match: /dms/i, file: "dms.png" },
  { match: /offboard/i, file: "ad-offboard.png" },
  { match: /ad\s*\/|new\s*ad|onboard|account/i, file: "ad-new.png" },
  { match: /cad|autocad/i, file: "brand-autocad.png" },
  { match: /omnex/i, file: "brand-omnex.png" },
  { match: /ritescan/i, file: "brand-ritescan.png" },
  { match: /p2p/i, file: "p2p.png" },
  { match: /kepware/i, file: "brand-kepware.png" },
  { match: /recover|return\s*asset/i, file: "recover-assets.png" },
];

export function catalogIconSrc(itemName) {
  const name = String(itemName || "").trim();
  if (!name) return null;

  const exact = ICON_FILES[name];
  if (exact) return `${BASE}/${exact}`;

  const hit = PATTERN_FALLBACKS.find((entry) => entry.match.test(name));
  return hit ? `${BASE}/${hit.file}` : null;
}

export function hasCatalogIcon(itemName) {
  return Boolean(catalogIconSrc(itemName));
}
