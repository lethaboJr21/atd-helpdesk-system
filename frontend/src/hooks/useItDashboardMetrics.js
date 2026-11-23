import { useEffect, useState, useCallback } from "react";
import { itDashboardApi } from "../services/api";

export function useItDashboardMetrics(range = "7d", filters = {}) {
  const [metrics, setMetrics] = useState(null);
  const [agentWorkload, setAgentWorkload] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { range, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const [m, a, t] = await Promise.all([
        itDashboardApi.getMetrics(params),
        itDashboardApi.getAgentWorkload({ range }),
        itDashboardApi.getTrends({ range }),
      ]);
      setMetrics(m.data);
      setAgentWorkload(a.data.agents || []);
      setTrends(t.data.trends || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [range, JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  return { metrics, agentWorkload, trends, loading, error, refetch: load };
}