import { useRef, useCallback } from "react";

const MAX_TRAIL_SIZE = 20;

export function usePulseActionTrail() {
  const trailRef = useRef([]);

  const recordAction = useCallback((action) => {
    const entry = {
      type: action.type || "unknown",
      path: action.path || window.location.pathname,
      timestamp: new Date().toISOString(),
      detail: action.detail || null,
    };
    trailRef.current.push(entry);
    if (trailRef.current.length > MAX_TRAIL_SIZE) {
      trailRef.current = trailRef.current.slice(-MAX_TRAIL_SIZE);
    }
    if (typeof window !== "undefined") {
      window.__pulseActionTrail = trailRef.current;
    }
  }, []);

  const getTrail = useCallback(() => trailRef.current, []);

  return { recordAction, getTrail };
}