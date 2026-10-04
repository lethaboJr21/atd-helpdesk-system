import { useEffect, useMemo, useRef, useState } from "react";
const PREVIEW_WIDTH = 1440;
const PREVIEW_HEIGHT = 1120;
function buildSnapshotUrl(templateId, visibleWidgets, appearance, actions) {
  const url = new URL("employee", document.baseURI);
  url.searchParams.set("dashboardSnapshot", "1");
  url.searchParams.set("previewCommunications", "1");
  url.searchParams.set("template", templateId || "employee");
  url.searchParams.set("widgets", (visibleWidgets || []).join(","));
  url.searchParams.set("actions", (actions || []).join(","));
  if (appearance?.mode) url.searchParams.set("mode", appearance.mode);
  if (appearance?.style) url.searchParams.set("style", appearance.style);
  if (appearance?.accent) url.searchParams.set("accent", appearance.accent);
  return url.toString();
}
export default function EmployeeDashboardSnapshot({ templateId, visibleWidgets = [], appearance, actions = [], label = "Employee Dashboard preview", selected = false, height = 280, expanded = false }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(.25);
  const source = useMemo(() => buildSnapshotUrl(templateId, visibleWidgets, appearance, actions), [templateId, visibleWidgets, appearance, actions]);
  useEffect(() => {
    const frame = frameRef.current;if (!frame) return undefined;
    const resize = () => setScale(Math.min(Math.max(frame.clientWidth,1)/PREVIEW_WIDTH,Math.max(frame.clientHeight,1)/PREVIEW_HEIGHT));
    resize();const observer=new ResizeObserver(resize);observer.observe(frame);return()=>observer.disconnect();
  }, [height, expanded]);
  return <div ref={frameRef} className={`employee-dashboard-snapshot ${expanded?"employee-dashboard-snapshot-expanded":""} ${selected?"employee-dashboard-snapshot-selected":""}`} style={{height,"--employee-dashboard-snapshot-scale":scale}} aria-label={label}><iframe title={label} src={source} tabIndex={-1}/><div className="employee-dashboard-snapshot-shield" aria-hidden="true"/></div>;
}