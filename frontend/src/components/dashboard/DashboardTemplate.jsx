export default function DashboardTemplate({
  templateId = "default",
  header,
  children,
  className = "",
}) {
  return (
    <section
      data-dashboard-template={templateId}
      className={`relative z-0 space-y-4 ${className}`.trim()}
    >
      {header}
      {children}
    </section>
  );
}
