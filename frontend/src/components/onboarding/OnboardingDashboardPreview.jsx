import EmployeeDashboardSnapshot from "../dashboard/EmployeeDashboardSnapshot";

export default function OnboardingDashboardPreview({ template, visibleWidgets = [], appearance, actions = [] }) {
  const widgets = visibleWidgets.length ? visibleWidgets : (template?.widgets || []);
  return (
    <section className="mt-6" aria-label="Exact Employee Dashboard preview">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--portal-primary)]">Exact dashboard preview</p>
          <p className="portal-title font-black">{template?.label || "Employee Dashboard"}</p>
        </div>
        <span className="portal-muted text-xs font-semibold">Scaled snapshot of the applied result</span>
      </div>
      <EmployeeDashboardSnapshot
        templateId={template?.id || "employee"}
        visibleWidgets={widgets}
        appearance={appearance}
        actions={actions}
        label={`${template?.label || "Employee"} onboarding dashboard snapshot`}
        height={430}
      />
    </section>
  );
}
