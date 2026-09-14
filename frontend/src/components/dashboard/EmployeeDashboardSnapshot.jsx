import { useMemo } from "react";

function buildSnapshotUrl(templateId, visibleWidgets, appearance, actions) {
  const url = new URL("employee", document.baseURI);
  url.searchParams.set("dashboardSnapshot", "1");
  url.searchParams.set("template", templateId || "employee");
  url.searchParams.set("widgets", (visibleWidgets || []).join(","));
  url.searchParams.set("actions", (actions || []).join(","));
  if (appearance?.mode) url.searchParams.set("mode", appearance.mode);
  if (appearance?.style) url.searchParams.set("style", appearance.style);
  if (appearance?.accent) url.searchParams.set("accent", appearance.accent);
  return url.toString();
}

export default function EmployeeDashboardSnapshot({
  templateId,
  visibleWidgets = [],
  appearance,
  actions = [],
  label = "Employee Dashboard preview",
  selected = false,
  height = 280,
}) {
  const source = useMemo(
    () => buildSnapshotUrl(templateId, visibleWidgets, appearance, actions),
    [templateId, visibleWidgets, appearance, actions]
  );

  return (
    <div
      className={`employee-dashboard-snapshot ${selected ? "employee-dashboard-snapshot-selected" : ""}`}
      style={{ height }}
      aria-label={label}
    >
      <iframe title={label} src={source} tabIndex={-1} />
      <div className="employee-dashboard-snapshot-shield" aria-hidden="true" />
    </div>
  );
}