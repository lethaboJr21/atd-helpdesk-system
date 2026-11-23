import { pulseApi } from "../services/api";

let installed = false;

export function setupPulseFrontend() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const buildVersion = import.meta.env?.VITE_BUILD_VERSION || null;

  const capture = (error, context = {}) => {
    pulseApi.logError({
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack || null,
        buildVersion,
      },
      context: {
        ...context,
        activeRoute: window.location.pathname,
        recentActionTrail: window.__pulseActionTrail || [],
        environmentMetadata: { userAgent: navigator.userAgent, buildVersion },
      },
    }).catch(() => {});
  };

  window.addEventListener("error", (event) => {
    capture(event.error || event, { source: "window_onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    capture(event.reason || new Error("Unhandled promise rejection"), { source: "unhandledrejection" });
  });

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok && response.status >= 500) {
          capture(new Error(`Fetch failed: ${response.status} ${response.statusText}`), { source: "fetch_interceptor", status: response.status });
        }
        return response;
      } catch (err) {
        capture(err, { source: "fetch_interceptor" });
        throw err;
      }
    };
  }
}