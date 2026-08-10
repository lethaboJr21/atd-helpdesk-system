import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  Clock,
  FileStack,
  FolderOpen,
  HardDrive,
  Home,
  KeyRound,
  Laptop,
  Loader2,
  Monitor,
  PackagePlus,
  RotateCcw,
  Search,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Users,
  Wrench,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import OperationsShell from "../components/OperationsShell";
import {
  REQUEST_MODULES,
  formPathForType,
} from "../data/requestModules";
import { catalogIconSrc } from "../data/catalogIcons";
import { catalogApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const BRAND = "#172b57";

const CATEGORY_ICONS = {
  "Application Access": KeyRound,
  "Software Installation": Wrench,
  "Hardware Provisioning": PackagePlus,
  "Data Services": HardDrive,
  Syspro: Monitor,
  QMuzik: Monitor,
  Collaboration: Users,
  "Network Access": Shield,
  "Workplace Access": Shield,
  Computers: Laptop,
  Peripherals: Monitor,
  "Mobile & Connectivity": Smartphone,
};

const ITEM_ICONS = [
  { match: /password|unlock|key|badge|biometric/, icon: KeyRound },
  { match: /vpn|firewall|network|wifi/, icon: Shield },
  { match: /teams|collaboration|meeting/, icon: Users },
  { match: /office\s*365|mailbox|outlook|email|ad \/|offboard/, icon: Cloud },
  { match: /file\s*restore|restore/, icon: RotateCcw },
  { match: /backup|data|bom|price|stock|master-data/, icon: HardDrive },
  { match: /dms|document|sharepoint|cctv|footage/, icon: FileStack },
  { match: /syspro|qmuzik|omnex|ritescan|p2p|cad|kepware|application|access|revoke/, icon: KeyRound },
  { match: /install|client|software/, icon: Wrench },
  { match: /laptop|charger|dock|keyboard/, icon: Laptop },
  { match: /desktop|monitor|pc/, icon: Monitor },
  { match: /mobile|android|phone|sim/, icon: Smartphone },
  { match: /printer|label|headset|mouse|scanner|hardware|asset|recover/, icon: PackagePlus },
];

function iconForCategory(name) {
  return CATEGORY_ICONS[name] || FolderOpen;
}

function iconForItem(item) {
  const hay = `${item.iconName || ""} ${item.name || ""} ${item.categoryName || ""}`.toLowerCase();
  const hit = ITEM_ICONS.find((entry) => entry.match.test(hay));
  return hit?.icon || ShoppingCart;
}

/**
 * Freshservice-style catalog portal.
 * Used separately for Service Catalog and Asset Requests — never mixed.
 */
export default function RequestCatalogPage({ moduleKey }) {
  const navigate = useNavigate();
  const { user, employeeView } = useAuth();
  const [searchParams] = useSearchParams();
  const module = REQUEST_MODULES[moduleKey];

  const initialCategory = searchParams.get("category") || "popular";
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  const homePath =
    user?.role === "user" || employeeView
      ? user?.role === "user"
        ? "/"
        : "/employee"
      : "/";

  useEffect(() => {
    const fromQuery = searchParams.get("category");
    if (fromQuery) setCategoryId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response =
          moduleKey === "asset"
            ? await catalogApi.getAssets()
            : await catalogApi.getService();
        if (cancelled) return;
        setCategories(Array.isArray(response.data?.categories) ? response.data.categories : []);
        setItems(Array.isArray(response.data?.items) ? response.data.items : []);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.response?.data?.error ||
              "The catalog could not be loaded. Please try again."
          );
          setCategories([]);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  const navCategories = useMemo(() => {
    const dynamic = categories.map((category) => ({
      id: category.id,
      label: category.name,
      icon: iconForCategory(category.name),
    }));

    return [
      { id: "popular", label: "Popular Items", icon: Star },
      {
        id: "all",
        label: moduleKey === "asset" ? "All Assets" : "All Service Items",
        icon: FolderOpen,
      },
      ...dynamic,
    ];
  }, [categories, moduleKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        categoryId === "all"
          ? true
          : categoryId === "popular"
            ? item.popular
            : item.categoryId === categoryId;

      if (!matchesCategory) return false;
      if (!needle) return true;

      return (
        item.name.toLowerCase().includes(needle) ||
        (item.description || "").toLowerCase().includes(needle) ||
        (item.categoryName || "").toLowerCase().includes(needle)
      );
    });
  }, [items, categoryId, query]);

  const openItem = (item) => {
    if (moduleKey === "asset") {
      navigate(
        formPathForType("asset_request", {
          itemId: item.id,
          assetItem: item.name,
          prefillTitle: item.name,
        }),
        {
          state: {
            createMode: "asset_request",
            catalogItem: item,
            assetItem: item.name,
            prefillTitle: item.name,
          },
        }
      );
      return;
    }

    navigate(
      formPathForType("service_request", {
        itemId: item.id,
        prefillTitle: item.name,
      }),
      {
        state: {
          createMode: "service_request",
          catalogItem: item,
          prefillTitle: item.name,
        },
      }
    );
  };

  const Icon = module.icon;
  const sectionTitle =
    categoryId === "popular"
      ? "Popular Items"
      : categoryId === "all"
        ? moduleKey === "asset"
          ? "All Assets"
          : "All Service Items"
        : navCategories.find((c) => c.id === categoryId)?.label || "Items";

  return (
    <OperationsShell
      breadcrumb={`Home > ${module.label}`}
      title={module.label}
      contentOverflow="hidden"
      contentClassName="flex min-h-0 flex-1 flex-col bg-[#eef2f7] px-4 py-4 lg:px-6"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(homePath)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(homePath)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm"
          >
            <Home className="h-4 w-4" />
            Home
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
          <header className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="rounded-2xl p-2.5 text-white"
                  style={{ backgroundColor: BRAND }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    {moduleKey === "asset" ? "Asset Catalog" : "Service Catalog"}
                  </h1>
                  <p className="mt-0.5 max-w-xl text-sm text-slate-500">
                    {moduleKey === "asset"
                      ? "Browse hardware provisioning items and raise an asset request."
                      : "Browse IT services and raise a standard service request."}
                  </p>
                </div>
              </div>

              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    moduleKey === "asset"
                      ? "Search assets…"
                      : "Search services…"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_1fr]">
            <aside className="flex min-h-0 flex-col overflow-y-auto border-b border-slate-100 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
              <nav className="space-y-1">
                {navCategories.map((category) => {
                  const CatIcon = category.icon || FolderOpen;
                  const active = categoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      className={
                        active
                          ? "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#172b57] bg-[#172b57]/[0.08]"
                          : "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                      }
                    >
                      <CatIcon className="h-4 w-4 shrink-0" />
                      {category.label}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Other modules
                </p>
                <div className="mt-2 space-y-1">
                  {Object.values(REQUEST_MODULES)
                    .filter((item) => item.key !== moduleKey)
                    .map((item) => {
                      const SiblingIcon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-[#172b57]"
                        >
                          <SiblingIcon className="h-3.5 w-3.5" />
                          {item.shortLabel}
                        </button>
                      );
                    })}
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col">
              <div className="shrink-0 border-b border-slate-100 px-5 py-3 sm:px-6">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {sectionTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {loading
                    ? "Loading catalog…"
                    : categoryId === "popular"
                      ? moduleKey === "asset"
                        ? "Most requested equipment"
                        : "Top requested service items"
                      : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
                    <p className="font-bold">{error}</p>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading catalog…
                  </div>
                ) : filtered.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((item) => {
                      const ItemIcon = iconForItem(item);
                      const artSrc = catalogIconSrc(item.name);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItem(item)}
                          className="group flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#172b57]/35 hover:shadow-md"
                        >
                          <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200/80">
                            {artSrc ? (
                              <img
                                src={artSrc}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-contain p-1.5 transition duration-200 group-hover:scale-[1.04]"
                              />
                            ) : (
                              <div className="rounded-xl bg-white p-2.5 text-[#172b57] shadow-sm ring-1 ring-slate-200/70">
                                <ItemIcon className="h-6 w-6" strokeWidth={1.75} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <p className="font-bold leading-snug text-slate-950">
                              {item.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-500">
                              {item.description}
                            </p>
                            {item.eta ? (
                              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                                <Clock className="h-3 w-3" />
                                {item.eta}
                              </p>
                            ) : null}
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#172b57]" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                    <p className="font-bold text-slate-800">No matching items</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try another category or clear your search.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OperationsShell>
  );
}
