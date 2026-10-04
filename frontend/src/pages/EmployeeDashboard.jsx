
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CheckSquare,
  HardDrive,
  Inbox,
  Lightbulb,
  BriefcaseBusiness,
  FolderKanban,
  LifeBuoy,
  PackagePlus,
  ShoppingCart,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  X,
} from "lucide-react";

import OperationsShell from "../components/OperationsShell";
import BrandAtmosphere from "../components/BrandAtmosphere";
import RequestEntryMenu from "../components/tickets/RequestEntryMenu";
import DashboardConfigurationPanel from "../components/dashboard/DashboardConfigurationPanel";
import DashboardTemplate from "../components/dashboard/DashboardTemplate";
import CompanyAnnouncements from "../components/dashboard/CompanyAnnouncements";
import EmployeePinnedActions from "../components/dashboard/EmployeePinnedActions";

import {
  GUIDED_INCIDENTS,
  REQUEST_MODULES,
  guidedIncidentPath,
} from "../data/requestModules";
import { useAuth } from "../hooks/useAuth";
import useDashboardPreferences from "../hooks/useDashboardPreferences";
import useEmployeePinnedActions from "../hooks/useEmployeePinnedActions";
import { applyAppearance, readAppearance } from "../services/appearance";
import {
  assetsApi,
  knowledgeApi,
  notificationApi,
  ticketsApi,
} from "../services/api";

const CLOSED_STATUSES = new Set(["closed", "resolved"]);
const ACTION_STATUSES = new Set(["waiting approval", "pending"]);
const BRAND = "#172b57";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function extractArray(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

function extractAssets(response) {
  return Array.isArray(response?.data?.assets) ? response.data.assets : [];
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function firstName(user) {
  const full = String(user?.name || "").trim();
  if (full) return full.split(/\s+/)[0];
  const email = String(user?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "there";
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [participatedTickets, setParticipatedTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [personalization, setPersonalization] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showRequestMenu, setShowRequestMenu] = useState(false);
  const [showDashboardConfiguration, setShowDashboardConfiguration] = useState(false);
  const {
    templateId,
    visibleWidgets,
    isWidgetVisible: preferenceIsWidgetVisible,
    applyTemplate,
    toggleWidget,
    customLayouts,
    activeCustomLayoutId,
    applyCustomLayout,
    saveCustomLayout,
    updateCustomLayout,
    renameCustomLayout,
    duplicateCustomLayout,
    deleteCustomLayout,
    resetPreferences,
  } = useDashboardPreferences(user?.id);
  const {
    isPinned: preferenceIsPinned,
    togglePinnedAction,
    resetPinnedActions,
  } = useEmployeePinnedActions(user?.id);

  const dashboardSnapshot = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("dashboardSnapshot") !== "1") return null;
    const split = (name) => String(params.get(name) || "").split(",").map((value) => value.trim()).filter(Boolean);
    return {
      templateId: params.get("template") || templateId,
      visibleWidgets: split("widgets"),
      actions: split("actions"),
      appearance: {
        mode: params.get("mode") || readAppearance().mode,
        style: params.get("style") || readAppearance().style,
        accent: params.get("accent") || readAppearance().accent,
      },
    };
  }, [location.search, templateId]);

  useEffect(() => {
    if (!dashboardSnapshot) return;
    applyAppearance(dashboardSnapshot.appearance, { persist: false, broadcast: false });
  }, [dashboardSnapshot]);

  const displayedTemplateId = dashboardSnapshot?.templateId || templateId;
  const displayedWidgets = useMemo(
    () => new Set(dashboardSnapshot?.visibleWidgets || visibleWidgets),
    [dashboardSnapshot, visibleWidgets]
  );
  const displayedActions = useMemo(
    () => new Set(dashboardSnapshot?.actions || []),
    [dashboardSnapshot]
  );
  const isWidgetVisible = useCallback(
    (widgetId) => dashboardSnapshot ? displayedWidgets.has(widgetId) : preferenceIsWidgetVisible(widgetId),
    [dashboardSnapshot, displayedWidgets, preferenceIsWidgetVisible]
  );
  const isPinned = useCallback(
    (actionId) => dashboardSnapshot ? displayedActions.has(actionId) : preferenceIsPinned(actionId),
    [dashboardSnapshot, displayedActions, preferenceIsPinned]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setSectionErrors([]);

    const requests = [
      {
        key: "tickets",
        label: "Tickets",
        execute: () => ticketsApi.getEmployeeView(),
        apply: (response) => setTickets(extractArray(response)),
      },
      { key:"participatedTickets", label:"Someone else's tickets", execute:()=>ticketsApi.getParticipantView(), apply:(response)=>setParticipatedTickets(extractArray(response)) },
      {
        key: "assets",
        label: "Assets",
        execute: () => assetsApi.getMine(),
        apply: (response) => setAssets(extractAssets(response)),
      },
      {
        key: "knowledge",
        label: "Knowledge",
        execute: () => knowledgeApi.getAll(),
        apply: (response) => setKnowledge(extractArray(response)),
      },
      {
        key: "notifications",
        label: "Notifications",
        execute: () => notificationApi.getAll({ module: "helpdesk" }),
        apply: (response) => setNotifications(extractArray(response)),
      },
      {
        key: "modules",
        label: "Personalized modules",
        execute: () => ticketsApi.getMyModules(),
        apply: (response) => setPersonalization(response?.data || null),
      },
    ];

    const results = await Promise.allSettled(
      requests.map((request) => request.execute())
    );

    const errors = [];

    results.forEach((result, index) => {
      const request = requests[index];

      if (result.status === "fulfilled") {
        request.apply(result.value);
        return;
      }

      // Personalization is optional — don't block the home experience.
      if (request.key === "modules") {
        setPersonalization(null);
        return;
      }

      errors.push({
        key: request.key,
        label: request.label,
        message: getErrorMessage(
          result.reason,
          `${request.label} could not be loaded.`
        ),
      });
    });

    setSectionErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("configure") === "dashboard") {
      setShowDashboardConfiguration(true);
    }
  }, [location.search]);

  const rankedModules = useMemo(() => {
    const modules = Object.values(REQUEST_MODULES);
    const order = personalization?.modules?.map((item) => item.key) || [];
    if (!order.length) return modules;
    return [...modules].sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [personalization]);

  const rankedShortcuts = useMemo(() => {
    const catalogLinks = [
      {
        key: "syspro_catalog",
        label: "Syspro",
        hint: "Catalog",
        icon: HardDrive,
        onClick: () => navigate("/services?category=atd-syspro"),
      },
      {
        key: "qmuzik_catalog",
        label: "QMuzik",
        hint: "Catalog",
        icon: HardDrive,
        onClick: () => navigate("/services?category=atd-qmuzik"),
      },
    ];

    const guided = GUIDED_INCIDENTS.map((guide) => ({
      key: guide.key,
      label: guide.title,
      hint: null,
      icon: guide.icon,
      onClick: () => navigate(guidedIncidentPath(guide)),
    }));

    const all = [...guided, ...catalogLinks];
    const order = personalization?.shortcuts?.map((item) => item.key) || [];
    if (!order.length) return all;

    return [...all].sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [personalization, navigate]);

  const pinnableActions = useMemo(() => [
    { key: "incident", label: "Report Incident", icon: LifeBuoy, onClick: () => navigate(REQUEST_MODULES.incident.path) },
    { key: "service", label: "Request Service", icon: ShoppingCart, onClick: () => navigate(REQUEST_MODULES.service.path) },
    { key: "asset", label: "Request Asset", icon: PackagePlus, onClick: () => navigate(REQUEST_MODULES.asset.path) },
    { key: "change", label: "Request Change", icon: BriefcaseBusiness, onClick: () => navigate(REQUEST_MODULES.change.path) },
    { key: "project", label: "Create Project", icon: FolderKanban, onClick: () => navigate(REQUEST_MODULES.project.path) },
    ...rankedShortcuts,
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.key === item.key) === index), [navigate, rankedShortcuts]);

  const personalizationLabel = personalization?.label || null;
  const recentTickets = useMemo(
    () => [...tickets]
      .sort((left, right) => new Date(right.created_at || right.updated_at || 0) - new Date(left.created_at || left.updated_at || 0))
      .slice(0, 3),
    [tickets]
  );

  const openTickets = useMemo(
    () =>
      tickets.filter(
        (item) => !CLOSED_STATUSES.has(normalizeStatus(item.status))
      ),
    [tickets]
  );

  const waitingForMe = useMemo(
    () =>
      tickets.filter((item) =>
        ACTION_STATUSES.has(normalizeStatus(item.status))
      ),
    [tickets]
  );

  const unreadNotifications = useMemo(
    () =>
      notifications.filter(
        (item) => !item.read_at && !item.is_read && item.read !== true
      ),
    [notifications]
  );

  const notificationCount =
    unreadNotifications.length || notifications.length;

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { articles: [], actions: [], tickets: [] };

    const actions = [
      {
        id: "action-items",
        title: "Complete your action items",
        description: "Approvals and items waiting for you.",
        onSelect: () =>
          navigate("/tickets?view=mine&status=Waiting%20Approval"),
      },
      {
        id: "knowledge",
        title: "Browse help articles",
        description: "Policies, FAQs, and self-help guides.",
        onSelect: () => navigate("/knowledge"),
      },
      ...Object.values(REQUEST_MODULES).map((module) => ({
        id: module.key,
        title: module.label,
        description: module.description,
        onSelect: () => navigate(module.path),
      })),
      ...GUIDED_INCIDENTS.map((guide) => ({
        id: guide.key,
        title: guide.title,
        description: guide.description,
        onSelect: () => navigate(guidedIncidentPath(guide)),
      })),
      {
        id: "syspro-catalog",
        title: "Syspro requests",
        description: "Access, install, BOM, prices, and stock codes.",
        onSelect: () => navigate("/services?category=atd-syspro"),
      },
      {
        id: "qmuzik-catalog",
        title: "QMuzik requests",
        description: "Access and client install for QMuzik.",
        onSelect: () => navigate("/services?category=atd-qmuzik"),
      },
    ].filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle)
    );

    const articles = knowledge
      .filter((article) =>
        String(article.title || "")
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 6);

    const matchedTickets = tickets
      .filter((ticket) => {
        const haystack = [ticket.ticket_ref, ticket.title, ticket.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 5);

    return {
      articles,
      actions: actions.slice(0, 8),
      tickets: matchedTickets,
    };
  }, [query, knowledge, tickets, navigate]);

  const showSearchPanel = query.trim().length > 0;
  const greetingName = firstName(user);

  return (
    <OperationsShell
      breadcrumb="Employee Self-Service"
      title="Employee Home"
      contentOverflow="hidden"
      contentClassName="portal-canvas flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-3 lg:px-5 lg:py-3 xl:px-6"
      actions={
        <>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] px-3.5 py-2 text-sm font-semibold text-[var(--portal-text-soft)] shadow-soft transition hover:border-slate-300 hover:bg-[var(--portal-surface-muted)] disabled:opacity-60"
          >
            <RefreshCw
              className={classNames("mr-2 h-4 w-4", loading && "animate-spin")}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowRequestMenu(true)}
            className="inline-flex items-center gap-2 rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </>
      }
    >
      <DashboardTemplate
        templateId={displayedTemplateId}
        className="flex min-h-full flex-col gap-3 pb-6"
      >
        <CompanyAnnouncements />
        {sectionErrors.length > 0 && (
          <div className="shrink-0 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 shadow-soft">
            <p className="font-bold text-amber-900">
              Some dashboard information could not be loaded.
            </p>
            <ul className="mt-1 space-y-1 text-sm text-amber-800">
              {sectionErrors.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}:</strong> {item.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hero — Freshservice mental model, ATD brand */}
        <div
          className="employee-hero relative z-10 shrink-0 overflow-visible rounded-[1.75rem] px-5 py-5 text-white shadow-lift sm:px-8 sm:py-6"
          style={{
            backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #1a3470 48%, #0f2348 100%)`,
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
            <BrandAtmosphere tone="dark" />
          </div>

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
              ATD IT Support
            </p>
            <h2 className="mt-1.5 text-[1.55rem] font-extrabold tracking-tight sm:text-[1.85rem]">
              Hi {greetingName}, how can we help?
            </h2>
            <p className="mx-auto mt-1.5 max-w-xl text-sm text-slate-200/85">
              Incidents, services, assets, and changes — each in its own place.
            </p>

            <div className="relative mx-auto mt-4 max-w-2xl">
              <label className="sr-only" htmlFor="employee-home-search">
                Search for solutions, services, and tickets
              </label>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input
                id="employee-home-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for solutions, services, and tickets"
                className="employee-hero-search w-full rounded-2xl border py-3 pl-12 pr-12 text-sm text-[var(--portal-text)] shadow-glow outline-none ring-0 transition placeholder:text-[var(--portal-text-muted)] focus:ring-2 focus:ring-sky-300 sm:text-[15px]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--portal-text-muted)] transition hover:bg-[var(--portal-surface-muted)] hover:text-[var(--portal-text-soft)]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}

              {showSearchPanel ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[min(22rem,45vh)] overflow-y-auto rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-raised)] text-left text-[var(--portal-text)] shadow-lift">
                  <SearchSection title="Actions" empty="No matching actions.">
                    {searchResults.actions.map((item) => (
                      <SearchRow
                        key={item.id}
                        title={item.title}
                        description={item.description}
                        onClick={item.onSelect}
                      />
                    ))}
                  </SearchSection>
                  <SearchSection title="Tickets" empty="No matching tickets.">
                    {searchResults.tickets.map((item) => (
                      <SearchRow
                        key={item.id}
                        title={item.ticket_ref || `TICKET-${item.id}`}
                        description={item.title}
                        meta={item.status || "Open"}
                        onClick={() => navigate(`/tickets/${item.id}`)}
                      />
                    ))}
                  </SearchSection>
                  <SearchSection
                    title="Help articles"
                    empty="No matching articles."
                  >
                    {searchResults.articles.map((article) => (
                      <SearchRow
                        key={article.id || article.title}
                        title={article.title}
                        description="Knowledge base"
                        onClick={() => {
                          const term = article.title;
                          setQuery("");
                          navigate(
                            `/knowledge?q=${encodeURIComponent(term)}`
                          );
                        }}
                      />
                    ))}
                  </SearchSection>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isWidgetVisible("supportActions") ? (
          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
          <IntentCard
            icon={CheckSquare}
            tone="indigo"
            title="Complete your action items"
            description={
              waitingForMe.length > 0
                ? `${waitingForMe.length} item${
                    waitingForMe.length === 1 ? "" : "s"
                  } waiting for you`
                : "Manage pending approvals and follow-ups"
            }
            badge={waitingForMe.length > 0 ? waitingForMe.length : null}
            onClick={() =>
              navigate("/tickets?view=mine&status=Waiting%20Approval")
            }
          />
          <IntentCard
            icon={Lightbulb}
            tone="teal"
            title="Browse solutions"
            description="Look up policies or FAQs to fix issues on your own"
            onClick={() => navigate("/knowledge")}
          />
          </div>
        ) : null}

        {/* Four separate request modules — never mixed on one form */}
        {isWidgetVisible("requestModules") ? (
          <div className="shrink-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
              Raise a request
            </p>
            {personalizationLabel ? (
              <p className="text-[11px] font-semibold text-[var(--portal-text-muted)]">
                {personalizationLabel}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {rankedModules.map((module) => (
              <IntentCard
                key={module.key}
                icon={module.icon}
                tone={module.tone}
                title={module.label}
                description={module.description}
                onClick={() => navigate(module.path)}
              />
            ))}
            </div>
          </div>
        ) : null}

        {isWidgetVisible("pinnedActions") ? (
          <EmployeePinnedActions
            actions={pinnableActions}
            isPinned={isPinned}
            onToggle={togglePinnedAction}
            onReset={resetPinnedActions}
          />
        ) : null}

        {/* Compact shortcuts — ranked for this person / department */}
        {isWidgetVisible("quickLinks") ? (
          <div className="shrink-0 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2.5 shadow-soft backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
              Quick links
            </p>
            {rankedShortcuts.map((link) => (
              <QuickLink
                key={link.key}
                icon={link.icon}
                label={link.label}
                hint={link.hint}
                onClick={link.onClick}
              />
            ))}
            </div>
          </div>
        ) : null}

        {/* My work — dense strip, not a second dashboard */}
        {isWidgetVisible("myWork") ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3.5 py-2.5 shadow-soft backdrop-blur-sm">
          <p className="mr-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            My work
          </p>
          <WorkChip
            icon={Ticket}
            label="Open"
            value={openTickets.length}
            onClick={() => navigate("/tickets?view=mine")}
          />
          <WorkChip
            icon={Bell}
            label="Waiting"
            value={waitingForMe.length}
            emphasize={waitingForMe.length > 0}
            onClick={() =>
              navigate("/tickets?view=mine&status=Waiting%20Approval")
            }
          />
          <WorkChip
            icon={HardDrive}
            label="Assets"
            value={assets.length}
            onClick={() => navigate("/assets")}
          />
          <WorkChip
            icon={Inbox}
            label="Alerts"
            value={notificationCount}
            emphasize={notificationCount > 0}
            tone="sky"
            onClick={() => navigate("/tickets?view=mine")}
          />
          </div>
        ) : null}

        {isWidgetVisible("participatedTickets") && participatedTickets.length ? <DashboardPanel title="Someone else's tickets" count={participatedTickets.length} actionLabel="View all" onAction={()=>navigate("/tickets?view=participating")}><div className="space-y-1">{participatedTickets.slice(0,5).map(item=><button key={item.id} type="button" onClick={()=>navigate(`/tickets/${item.id}`)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--portal-surface-muted)]"><div className="min-w-0"><p className="portal-ticket-reference text-xs font-bold">{item.ticket_ref||`TICKET-${item.id}`}</p><p className="portal-title truncate text-sm font-semibold">{item.title}</p><p className="portal-muted truncate text-xs">Requester: {item.requester_name||"Unknown"}</p></div><span className="portal-accent-soft rounded-full px-2 py-1 text-xs font-bold">{item.status}</span></button>)}</div></DashboardPanel>:null}
        {/* Follow-through panels */}
        {isWidgetVisible("recentTickets") || isWidgetVisible("assignedAssets") ? (
          <div className="grid min-h-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {isWidgetVisible("recentTickets") ? (
            <DashboardPanel
              title="Recent tickets"
            count={recentTickets.length}
            actionLabel="View all"
            onAction={() => navigate("/tickets?view=mine")}
            className="lg:col-span-3"
          >
            {tickets.length > 0 ? (
              <div className="space-y-0.5">
                {recentTickets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/tickets/${item.id}`)}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[var(--portal-surface-muted)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-wide text-[var(--portal-primary)]">
                        {item.ticket_ref || `TICKET-${item.id}`}
                      </p>
                      <p className="truncate text-sm font-semibold text-[var(--portal-text)]">
                        {item.title}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--portal-surface-muted)] px-2.5 py-1 text-[11px] font-bold text-[var(--portal-text-soft)]">
                      {item.status || "Open"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel
                icon={Ticket}
                title="You're all clear"
                message="No open tickets. Report an incident or open the service catalog when you need help."
                primaryLabel="Report an Incident"
                onPrimary={() => navigate(REQUEST_MODULES.incident.path)}
                secondaryLabel="Request a Service"
                onSecondary={() => navigate(REQUEST_MODULES.service.path)}
              />
            )}
            </DashboardPanel>
          ) : null}

          {isWidgetVisible("assignedAssets") ? (
            <DashboardPanel
              title="Your assets"
              count={assets.length}
              actionLabel="Manage"
              onAction={() => navigate("/assets")}
              className="lg:col-span-2"
            >
            {assets.length > 0 ? (
              <div className="space-y-1">
                {assets.slice(0, 6).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => navigate("/assets")}
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[var(--portal-surface-muted)]"
                  >
                    <div className="mt-0.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 p-2.5 text-[var(--portal-text-soft)] ring-1 ring-slate-200/80">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--portal-text)]">
                        {asset.name || "Assigned asset"}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        <p className="truncate text-[11px] text-[var(--portal-text-muted)]">
                          <span className="font-semibold text-[var(--portal-text-muted)]">
                            Tag
                          </span>{" "}
                          <span className="font-semibold text-[var(--portal-primary)]">
                            {asset.asset_tag || `ASSET-${asset.id}`}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-[var(--portal-text-muted)]">
                          <span className="font-semibold text-[var(--portal-text-muted)]">
                            Serial
                          </span>{" "}
                          <span className="font-medium text-[var(--portal-text-soft)]">
                            {asset.serial_number || "—"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel
                icon={HardDrive}
                title="No assets assigned"
                message="When IT assigns equipment, it will show up here."
              />
            )}
            </DashboardPanel>
          ) : null}
        </div>
        ) : null}
      </DashboardTemplate>

      <RequestEntryMenu
        open={showRequestMenu}
        onClose={() => setShowRequestMenu(false)}
        onSelect={(entry) => {
          setShowRequestMenu(false);
          navigate(entry.path);
        }}
      />

      <DashboardConfigurationPanel
        open={showDashboardConfiguration}
        onClose={() => setShowDashboardConfiguration(false)}
        role={user?.role || "user"}
        templateId={templateId}
        visibleWidgets={visibleWidgets}
        customLayouts={customLayouts}
        activeCustomLayoutId={activeCustomLayoutId}
        onTemplateChange={applyTemplate}
        onApplyCustom={applyCustomLayout}
        onSaveCustom={saveCustomLayout}
        onUpdateCustom={updateCustomLayout}
        onRenameCustom={renameCustomLayout}
        onDuplicateCustom={duplicateCustomLayout}
        onDeleteCustom={deleteCustomLayout}
        onToggleWidget={toggleWidget}
        onReset={resetPreferences}
      />
    </OperationsShell>
);
}

const TONE_STYLES = {
  indigo: "bg-gradient-to-br from-indigo-50 to-indigo-100/60 text-indigo-700 ring-indigo-100",
  teal: "bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-700 ring-teal-100",
  green: "bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700 ring-emerald-100",
  amber: "bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 ring-amber-100",
  sky: "bg-gradient-to-br from-sky-50 to-blue-50 text-sky-700 ring-sky-100",
};

function IntentCard({
  icon: Icon,
  title,
  description,
  onClick,
  tone = "indigo",
  badge,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-5 py-4 text-left shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-[var(--portal-selected-border)] hover:shadow-lift"
    >
      <div
        className={classNames(
          "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
          TONE_STYLES[tone] || TONE_STYLES.indigo
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
        {badge != null ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold tracking-tight text-[var(--portal-text)]">
          {title}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-[var(--portal-text-muted)]">
          {description}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500" />
    </button>
  );
}

function WorkChip({ icon: Icon, label, value, onClick, emphasize, tone }) {
  const activeTone =
    tone === "sky"
      ? "border-sky-300 bg-sky-50 hover:bg-sky-100"
      : "border-amber-300 bg-amber-50 hover:bg-amber-100";
  const activeIcon = tone === "sky" ? "text-sky-700" : "text-amber-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition duration-150",
        emphasize
          ? activeTone
          : "border-slate-200/80 bg-[var(--portal-surface-muted)] hover:border-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]"
      )}
    >
      <Icon
        className={classNames(
          "h-3.5 w-3.5",
          emphasize ? activeIcon : "text-[var(--portal-text-muted)]"
        )}
      />
      <span className="text-xs font-medium text-[var(--portal-text-muted)]">{label}</span>
      <span className="text-sm font-bold tabular-nums text-[var(--portal-text)]">
        {value}
      </span>
    </button>
  );
}

function QuickLink({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint ? `${label} — ${hint}` : label}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-[var(--portal-surface-muted)] px-2.5 py-1.5 text-left transition hover:border-[var(--portal-primary)] hover:bg-[var(--portal-selected-bg)]"
    >
      <Icon className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" strokeWidth={1.75} />
      <span className="text-xs font-semibold text-[var(--portal-text-soft)]">{label}</span>
      {hint ? (
        <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[var(--portal-text-muted)] sm:inline">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function DashboardPanel({
  title,
  count,
  children,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={classNames(
        "flex min-h-[11rem] flex-col rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 shadow-soft backdrop-blur-sm lg:min-h-0",
        className
      )}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--portal-text)]">
            {title}
          </h2>
          {typeof count === "number" ? (
            <span className="rounded-full bg-[var(--portal-surface-muted)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--portal-text-soft)]">
              {count}
            </span>
          ) : null}
        </div>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="text-sm font-bold text-[var(--portal-primary)] transition hover:text-[var(--portal-primary-hover)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <div className="flex h-full min-h-[9rem] flex-col items-center justify-center rounded-xl bg-[radial-gradient(ellipse_at_center,rgba(241,245,249,0.9)_0%,transparent_70%)] px-4 py-7 text-center">
      <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-white p-3.5 text-[var(--portal-text-muted)] shadow-soft ring-1 ring-slate-200/80">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="mt-3.5 text-sm font-bold tracking-tight text-[var(--portal-text)]">
        {title}
      </p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--portal-text-muted)]">
        {message}
      </p>
      {primaryLabel || secondaryLabel ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryLabel ? (
            <button
              type="button"
              onClick={onPrimary}
              className="rounded-xl portal-accent-fill bg-[var(--portal-primary)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
            >
              {primaryLabel}
            </button>
          ) : null}
          {secondaryLabel ? (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[var(--portal-text-soft)] shadow-sm transition hover:bg-[var(--portal-surface-muted)]"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchSection({ title, children, empty }) {
  const items = Array.isArray(children)
    ? children.filter(Boolean)
    : [children].filter(Boolean);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <p className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--portal-text-muted)]">
        {title}
      </p>
      {items.length > 0 ? (
        items
      ) : (
        <p className="px-4 py-3 text-sm text-[var(--portal-text-muted)]">{empty}</p>
      )}
    </div>
  );
}

function SearchRow({ title, description, meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-[var(--portal-text)]">{title}</p>
        {description ? (
          <p className="truncate text-sm text-[var(--portal-text-muted)]">{description}</p>
        ) : null}
      </div>
      {meta ? (
        <span className="shrink-0 rounded-full bg-[var(--portal-surface-muted)] px-2 py-1 text-xs font-bold text-[var(--portal-text-soft)]">
          {meta}
        </span>
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
      )}
    </button>
  );
}
