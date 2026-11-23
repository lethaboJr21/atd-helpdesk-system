import { Component } from "react";
import { pulseApi } from "../../services/api";

export default class AtdPulseErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: false };
  }

  componentDidCatch(error, errorInfo) {
    const context = {
      source: "error_boundary",
      activeRoute: window.location.pathname,
      componentHierarchy: errorInfo?.componentStack || null,
      userSessionContext: { userAgent: navigator.userAgent, timestamp: new Date().toISOString() },
      recentActionTrail: window.__pulseActionTrail || [],
      environmentMetadata: { buildVersion: import.meta.env?.VITE_BUILD_VERSION || null },
      isPartial: false,
      missingFields: [],
    };
    pulseApi.logError({ error: { name: error.name, message: error.message, stack: error.stack }, context }).catch(() => {});
  }

  render() {
    return this.props.children;
  }
}