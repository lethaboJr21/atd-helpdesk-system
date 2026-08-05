import { useCallback, useState } from "react";

const STORAGE_KEY = "atd-helpdesk-sidebar-collapsed";

function readStoredCollapsed(defaultCollapsed) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return defaultCollapsed;
    return stored === "true";
  } catch {
    return defaultCollapsed;
  }
}

/**
 * Sidebar starts collapsed by default so the main workspace has more room.
 * The user's expand/collapse choice is remembered across pages.
 */
export default function useSidebarCollapsed(defaultCollapsed = true) {
  const [collapsed, setCollapsed] = useState(() =>
    readStoredCollapsed(defaultCollapsed)
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage failures (private mode, quota, etc.).
      }

      return next;
    });
  }, []);

  return [collapsed, toggleCollapsed];
}
