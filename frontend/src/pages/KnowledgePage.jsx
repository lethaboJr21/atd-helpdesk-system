import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FolderOpen,
  Home,
  LifeBuoy,
  Loader2,
  Search,
  Shield,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import OperationsShell from "../components/OperationsShell";
import { REQUEST_MODULES } from "../data/requestModules";
import { knowledgeApi } from "../services/api";

const BRAND = "#172b57";

const CATEGORY_ICONS = {
  IT: Wrench,
  HR: Users,
  Finance: Shield,
  General: BookOpen,
};

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function formatDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function KnowledgePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("All");
  const [openArticle, setOpenArticle] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await knowledgeApi.getAll();
      setArticles(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Help articles could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // With a single category the category rail is pointless — group by folder
  // (Freshservice's second level) so the rail still helps people navigate.
  const useFolderNav = useMemo(() => {
    const distinct = new Set(
      articles.map((article) => article.category || "General")
    );
    return distinct.size <= 1;
  }, [articles]);

  const categories = useMemo(() => {
    const counts = new Map();
    articles.forEach((article) => {
      const name =
        (useFolderNav ? article.folder : article.category) || "General";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [
      { name: "All", count: articles.length },
      ...Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [articles, useFolderNav]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      const groupKey =
        (useFolderNav ? article.folder : article.category) || "General";
      if (category !== "All" && groupKey !== category) return false;
      if (!needle) return true;
      return [article.title, article.category, article.folder, article.bodyText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [articles, category, query, useFolderNav]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach((article) => {
      const key = article.folder || article.category || "General";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(article);
    });
    return Array.from(groups.entries());
  }, [filtered]);

  const updateQuery = (value) => {
    setQuery(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const shellActions = (
    <>
      <button
        type="button"
        onClick={() => (openArticle ? setOpenArticle(null) : navigate(-1))}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
      >
        <Home className="h-4 w-4" />
        Home
      </button>
    </>
  );

  // ---- Reading view -------------------------------------------------------
  if (openArticle) {
    const updated = formatDate(openArticle.updatedAt);
    return (
      <OperationsShell
        breadcrumb={`Helpdesk / Knowledge / ${openArticle.category || "General"}`}
        title={openArticle.title}
        subtitle={
          [openArticle.folder, updated ? `Updated ${updated}` : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={shellActions}
      >
        <div className="mx-auto max-w-3xl pb-10">
          <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
            <header className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#172b57]/[0.07] px-3 py-1 text-xs font-bold text-[#172b57]">
                  {openArticle.category || "General"}
                </span>
                {openArticle.folder ? (
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                    {openArticle.folder}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                  <Clock className="h-3 w-3" />
                  {openArticle.readingMinutes} min read
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                {openArticle.title}
              </h1>
            </header>

            <div
              className="kb-article px-6 py-6 sm:px-8"
              dangerouslySetInnerHTML={{
                __html:
                  openArticle.bodyHtml ||
                  `<p>${openArticle.bodyText || "No content available."}</p>`,
              }}
            />

            <footer className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
              <p className="text-sm font-bold text-slate-900">
                Did this solve your problem?
              </p>
              <p className="mt-1 text-sm text-slate-500">
                If you still need help, raise it with IT and include what you
                already tried.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(REQUEST_MODULES.incident.path, {
                      state: { prefillTitle: openArticle.title },
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#172b57] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f376c]"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Report an incident
                </button>
                <button
                  type="button"
                  onClick={() => setOpenArticle(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to articles
                </button>
              </div>
            </footer>
          </article>
        </div>
      </OperationsShell>
    );
  }

  // ---- Browse view --------------------------------------------------------
  return (
    <OperationsShell
      breadcrumb="Helpdesk / Knowledge"
      title="Help Articles"
      subtitle="Policies and guides to fix common issues yourself."
      contentOverflow="hidden"
      contentClassName="flex min-h-0 flex-1 flex-col px-4 py-4 lg:px-6"
      actions={shellActions}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
          <header className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="rounded-2xl p-2.5 text-white"
                  style={{ backgroundColor: BRAND }}
                >
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    Knowledge base
                  </h1>
                  <p className="mt-0.5 max-w-xl text-sm text-slate-500">
                    {loading
                      ? "Loading articles…"
                      : `${articles.length} guide${articles.length === 1 ? "" : "s"} and policies published by IT.`}
                  </p>
                </div>
              </div>

              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder="Search articles…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_1fr]">
            <aside className="flex min-h-0 flex-col overflow-y-auto border-b border-slate-100 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r">
              <nav className="space-y-1">
                {categories.map((entry) => {
                  const CatIcon =
                    entry.name === "All"
                      ? Sparkles
                      : CATEGORY_ICONS[entry.name] || FolderOpen;
                  const active = category === entry.name;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => setCategory(entry.name)}
                      className={
                        active
                          ? "flex w-full items-center gap-2.5 rounded-xl bg-[#172b57]/[0.08] px-3 py-2.5 text-left text-sm font-bold text-[#172b57]"
                          : "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
                      }
                    >
                      <CatIcon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.name === "All" ? "All articles" : entry.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-slate-400">
                        {entry.count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Still stuck?
                </p>
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => navigate(REQUEST_MODULES.incident.path)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-[#172b57]"
                  >
                    <LifeBuoy className="h-3.5 w-3.5" />
                    Report an incident
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(REQUEST_MODULES.service.path)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-[#172b57]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Service catalog
                  </button>
                </div>
              </div>
            </aside>

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {error}
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading articles…
                </div>
              ) : grouped.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                  <p className="font-bold text-slate-800">
                    {articles.length
                      ? "No articles match that search"
                      : "No articles published yet"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    {articles.length
                      ? "Try a different word, or raise an incident and IT will help directly."
                      : "Once IT publishes guides they appear here."}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(REQUEST_MODULES.incident.path, {
                        state: { prefillTitle: query || "" },
                      })
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#172b57] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f376c]"
                  >
                    <LifeBuoy className="h-4 w-4" />
                    Report an incident
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map(([groupName, groupArticles]) => (
                    <section key={groupName}>
                      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        {groupName}
                      </h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {groupArticles.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => setOpenArticle(article)}
                            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#172b57]/35 hover:shadow-md"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#172b57]/[0.06] text-[#172b57]">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <p className="min-w-0 flex-1 font-bold leading-snug text-slate-950">
                                {article.title}
                              </p>
                            </div>
                            {article.summary ? (
                              <p className="mt-2 line-clamp-2 text-sm leading-snug text-slate-500">
                                {article.summary}
                              </p>
                            ) : null}
                            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                              <Clock className="h-3 w-3" />
                              {article.readingMinutes} min read
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </OperationsShell>
  );
}
