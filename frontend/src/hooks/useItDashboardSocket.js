import { useEffect, useState, useRef } from "react";

const POLL_INTERVAL = parseInt(import.meta.env?.VITE_IT_DASHBOARD_POLL_INTERVAL_MS || "30000", 10);

export function useItDashboardSocket(onUpdate) {
  const [isLive, setIsLive] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let socket = null;
    try {
      const io = window.io;
      if (io) {
        socket = io();
        socket.on("connect", () => { setIsLive(true); setIsPolling(false); });
        socket.on("disconnect", () => { setIsLive(false); setIsPolling(true); });
        socket.on("it-dashboard:metrics-updated", () => { onUpdate?.(); });
      }
    } catch (e) {
      // Socket.io not available — fall back to polling
    }

    pollRef.current = setInterval(() => {
      if (!socket?.connected) {
        setIsPolling(true);
        onUpdate?.();
      }
    }, POLL_INTERVAL);

    return () => {
      if (socket) socket.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [onUpdate]);

  return { isLive, isPolling };
}