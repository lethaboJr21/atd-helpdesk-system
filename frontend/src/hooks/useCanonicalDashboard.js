import { useState, useEffect, useCallback } from "react";
import { getLayoutDefinition } from "../components/dashboard/dashboardLayoutRegistry";

export function useCanonicalDashboard(dashboardId, dataLoader) {
  const layout = getLayoutDefinition(dashboardId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!dataLoader) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await dataLoader();
      setData(result);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [dataLoader]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    return load();
  }, [load]);

  return {
    layout,
    data,
    loading,
    error,
    refresh,
    isRegistered: Boolean(layout),
  };
}