import { LoadingState, EmptyState, ErrorState } from "./DashboardStatePatterns";
import DashboardNav from "./DashboardNav";

export default function CanonicalDashboardLayout({
  title,
  subtitle,
  navItems,
  navGroups,
  activeNavId,
  onNavSelect,
  summaryGrid,
  detailSections,
  actionLists,
  loading,
  error,
  empty,
  onRetry,
  headerActions,
  sidePanel,
}) {
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <LayoutHeader title={title} subtitle={subtitle} />
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <LayoutHeader title={title} subtitle={subtitle} />
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  const hasNav = navItems || navGroups;
  const hasContent = summaryGrid || detailSections || actionLists;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <LayoutHeader title={title} subtitle={subtitle} actions={headerActions} />

      {!hasContent && empty ? (
        <EmptyState message={empty} />
      ) : (
        <div className={hasNav ? "grid gap-6 lg:grid-cols-[220px_1fr]" : "grid gap-6"}>
          {hasNav && (
            <aside>
              <DashboardNav
                items={navItems}
                groups={navGroups}
                activeId={activeNavId}
                onSelect={onNavSelect}
              />
            </aside>
          )}

          <div className="space-y-6">
            {summaryGrid && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {summaryGrid}
              </section>
            )}

            {detailSections && (
              <section className="space-y-4">
                {detailSections}
              </section>
            )}

            {actionLists && (
              <section className="space-y-4">
                {actionLists}
              </section>
            )}
          </div>

          {sidePanel && (
            <aside className="space-y-4">
              {sidePanel}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function LayoutHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}