export const APPEARANCE_STORAGE_KEY = "atd-helpdesk-appearance";
export const LEGACY_THEME_STORAGE_KEY = "atd-helpdesk-theme";
export const APPEARANCE_EVENT = "atd-helpdesk:appearance-change";

export const APPEARANCE_MODES = Object.freeze(["light", "dark", "system"]);
export const APPEARANCE_STYLES = Object.freeze(["solid", "two-color", "gradient"]);
export const ACCENT_THEMES = Object.freeze([
  { id: "atd-blue", label: "ATD Blue", primary: "#2563eb", secondary: "#22d3ee" },
  { id: "slate", label: "Slate", primary: "#475569", secondary: "#94a3b8" },
  { id: "cyan", label: "Cyan", primary: "#0891b2", secondary: "#22d3ee" },
  { id: "teal", label: "Teal", primary: "#0f766e", secondary: "#2dd4bf" },
  { id: "sky", label: "Sky", primary: "#0284c7", secondary: "#7dd3fc" },
  { id: "violet", label: "Violet", primary: "#7c3aed", secondary: "#c4b5fd" },
  { id: "rose", label: "Rose", primary: "#e11d48", secondary: "#fda4af" },
  { id: "amber", label: "Amber", primary: "#d97706", secondary: "#fcd34d" },
  { id: "green", label: "Green", primary: "#15803d", secondary: "#4ade80" },
]);

const validMode = (value) => APPEARANCE_MODES.includes(value) ? value : "system";
const validStyle = (value) => APPEARANCE_STYLES.includes(value) ? value : "solid";
const validAccent = (value) => ACCENT_THEMES.some((item) => item.id === value) ? value : "atd-blue";

export function defaultAppearance() {
  let legacy = "system";
  try { legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY) || "system"; } catch {}
  return { mode: validMode(legacy), style: "solid", accent: "atd-blue" };
}

export function readAppearance() {
  try {
    const value = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || "null");
    if (!value) return defaultAppearance();
    return { mode: validMode(value.mode), style: validStyle(value.style), accent: validAccent(value.accent) };
  } catch { return defaultAppearance(); }
}

export function resolvedMode(mode) {
  return mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}

export function applyAppearance(value = readAppearance(), { persist = true, broadcast = true } = {}) {
  const appearance = { mode: validMode(value.mode), style: validStyle(value.style), accent: validAccent(value.accent) };
  const accent = ACCENT_THEMES.find((item) => item.id === appearance.accent) || ACCENT_THEMES[0];
  const root = document.documentElement;
  root.dataset.theme = resolvedMode(appearance.mode);
  root.dataset.themePreference = appearance.mode;
  root.dataset.appearanceStyle = appearance.style;
  root.dataset.accent = appearance.accent;
  root.style.colorScheme = root.dataset.theme;
  root.style.setProperty("--portal-primary", accent.primary);
  root.style.setProperty("--portal-primary-hover", accent.primary);
  root.style.setProperty("--portal-accent", accent.primary);
  root.style.setProperty("--portal-accent-secondary", accent.secondary);
  root.style.setProperty("--portal-accent-gradient", `linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`);
  if (persist) {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, appearance.mode);
  }
  if (broadcast) window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: appearance }));
  return appearance;
}

export function updateAppearance(patch) {
  return applyAppearance({ ...readAppearance(), ...patch });
}

export function initializeAppearance() {
  const apply = () => applyAppearance(readAppearance(), { persist: false, broadcast: false });
  apply();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const mediaListener = () => { if (readAppearance().mode === "system") apply(); };
  const storageListener = (event) => { if ([APPEARANCE_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY].includes(event.key)) apply(); };
  media.addEventListener?.("change", mediaListener);
  window.addEventListener("storage", storageListener);
  return () => { media.removeEventListener?.("change", mediaListener); window.removeEventListener("storage", storageListener); };
}
