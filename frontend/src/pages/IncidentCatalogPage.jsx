import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search, Star } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import OperationsShell from "../components/OperationsShell";
import { catalogApi } from "../services/api";
import { formPathForType } from "../data/requestModules";
import { catalogIconSrc } from "../data/catalogIcons";
import { useAuth } from "../hooks/useAuth";

const norm = (value) => String(value ?? "").trim().toLowerCase();
function incidentIconKey(item) {
  if (item?.iconKey || item?.icon_key) return item.iconKey || item.icon_key;
  const text = [item?.name, item?.categoryName, item?.categoryId, item?.subCategory].filter(Boolean).join(" ").toLowerCase();
  const mappings = [
    [["syspro", "erp"], "brand-syspro"],
    [["qmuzik"], "brand-qmuzik"],
    [["office 365", "microsoft 365", "outlook", "email"], "brand-office365"],
    [["teams"], "brand-teams"],
    [["sharepoint", "onedrive"], "brand-sharepoint"],
    [["laptop", "computer", "desktop"], "laptop"],
    [["label printer"], "label-printer"],
    [["printer"], "printer"],
    [["scanner", "barcode"], "android-scanner"],
    [["mobile", "phone"], "mobile"],
    [["wi-fi", "wifi", "wireless"], "wifi"],
    [["vpn"], "vpn"],
    [["password", "authentication", "sign-in", "login"], "password-reset"],
    [["backup"], "backup"],
    [["restore", "recover"], "file-restore"],
    [["badge"], "badge"],
    [["biometric"], "biometric"],
    [["cctv", "surveillance"], "cctv"],
  ];
  for (const [needles, key] of mappings) if (needles.some((needle) => text.includes(needle))) return key;
  return "atd-helpdesk-icon";
}

export default function IncidentCatalogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProductionLineUser = String(user?.department || "").trim().toLowerCase() === "production";
  const [params] = useSearchParams();
  const beneficiary = params.get("beneficiary") === "other" ? "other" : "self";
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(isProductionLineUser ? "all" : "popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isProductionLineUser) setCategory("all");
  }, [isProductionLineUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await catalogApi.getManagedItIncidents();
        const catalogueItems = Array.isArray(response.data?.items) ? response.data.items : [];
        const visibleItems = isProductionLineUser
          ? catalogueItems.filter((item) =>
              String(item.categoryName || item.categoryId || "").trim().toLowerCase().startsWith("network")
            )
          : catalogueItems;
        if (!cancelled) { setItems(visibleItems); setError(""); }
      } catch (e) {
        if (!cancelled) { setItems([]); setError(e.response?.data?.error || e.message || "The Incident catalogue could not be loaded."); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isProductionLineUser]);

  const categories = useMemo(() => [...new Set(items.map((x) => x.categoryName || x.categoryId).filter(Boolean))].sort(), [items]);
  // SINGLE_CATALOGUE_OTHER: only one Other card is visible in the Incident catalogue.
  const canonicalOtherId = useMemo(() => {
    const others = items.filter((item) => item.isOther === true || String(item.name || "").trim().toLowerCase() === "other");
    const catalogueOther = others.find((item) => ["other", ""].includes(String(item.categoryName || item.categoryId || "").trim().toLowerCase()));
    return String((catalogueOther || others[0])?.id || "");
  }, [items]);
  const filtered = useMemo(() => {
    const needle = norm(query);
    return items.filter((item) => {
      if ((item.isOther === true || String(item.name || "").trim().toLowerCase() === "other") && String(item.id) !== canonicalOtherId) return false;
      const itemCategory = item.categoryName || item.categoryId || "Other";
      const categoryOk = category === "all" ? true : category === "popular" ? item.popular === true : itemCategory === category;
      const haystack = [item.name, item.description, itemCategory, item.subCategory].join(" ").toLowerCase();
      return categoryOk && (!needle || haystack.includes(needle));
    });
  }, [items, category, query, canonicalOtherId]);

  const openItem = (item) => navigate(formPathForType("incident", {
    managedCatalogueItemId: item.managedCatalogueItemId || item.id,
    catalogueItemId: item.managedCatalogueItemId || item.id,
    prefillTitle: item.name,
    category: item.categoryName || item.categoryId,
    subCategory: item.subCategory || "",
    beneficiary,
  }), { state: { createMode: "incident", catalogItem: item, beneficiary, prefillTitle: item.name } });

  return <OperationsShell breadcrumb="Home > Report an Incident" title="Report an Incident" subtitle={isProductionLineUser ? "Choose an IT Network incident from the approved catalogue." : "Choose the Incident catalogue item that best matches the problem."}>
    <section className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="text-xl font-black">Incident Catalogue</h2><p className="text-sm text-slate-500">Items are governed through Workspace Catalogue Manager.</p></div><label className="relative min-w-64 flex-1 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} className="w-full rounded-xl border px-9 py-2.5" placeholder="Search incidents..."/></label></header>
      <div className="grid md:grid-cols-[220px_1fr]"><aside className="space-y-1 border-r p-4"><button type="button" onClick={()=>setCategory("popular")} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${category==="popular"?"bg-slate-100 font-bold":""}`}><Star className="mr-2 inline h-4 w-4"/>Popular Items</button><button type="button" onClick={()=>setCategory("all")} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${category==="all"?"bg-slate-100 font-bold":""}`}>All Incident Items</button>{categories.map((x)=><button type="button" key={x} onClick={()=>setCategory(x)} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${category===x?"bg-slate-100 font-bold":""}`}>{x}</button>)}</aside>
      <main className="p-5">{loading?<p className="p-10 text-center text-slate-500">Loading Incident catalogue...</p>:null}{error?<p className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</p>:null}{!loading&&!error?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item)=><button type="button" key={item.id} onClick={()=>openItem(item)} className="rounded-2xl border p-4 text-left hover:border-blue-300 hover:bg-blue-50/40"><div className="flex items-start gap-3">
  <img src={catalogIconSrc(incidentIconKey(item))} alt="" className="h-9 w-9 shrink-0 object-contain" aria-hidden="true" />
  <div className="min-w-0"><strong className="block">{item.name}</strong><span className="mt-1 block text-xs text-slate-500">{item.description || [item.categoryName,item.subCategory].filter(Boolean).join(" / ")}</span></div>
</div>{item.isOther?<span className="mt-2 inline-block rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Other</span>:null}</button>)}</div>:null}{!loading&&!error&&!filtered.length?<div className="p-10 text-center text-slate-500"><AlertTriangle className="mx-auto h-6 w-6"/><p className="mt-2">{isProductionLineUser ? "No active Network incident items are available. Contact IT to update the Network catalogue." : "No managed Incident items match this view. Add or activate the required item in Workspace Catalogue Manager."}</p></div>:null}</main></div>
    </section>
  </OperationsShell>;
}