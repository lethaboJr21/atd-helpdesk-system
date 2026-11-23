import { useEffect, useState, useCallback, useRef } from "react";
import { catalogApi } from "../services/api";
import { get as cacheGet, set as cacheSet, invalidate as cacheInvalidate, cacheKey, DEFAULT_TTL } from "./useCatalogueCache";

const TIMEOUT_MS = 15000;

export default function useCatalogueData({ catalogueType, workspaceCode = "IT", moduleKey, beneficiary, popularFirst = true, cacheTtlMs = DEFAULT_TTL }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [error, setError] = useState("");
  const [allItemsLoaded, setAllItemsLoaded] = useState(false);
  const cancelRef = useRef(false);

  const cKey = cacheKey(catalogueType, workspaceCode);
  const apiMethod = catalogueType === "incident" ? catalogApi.getManagedItIncidents : catalogApi.getManagedItServices;

  const fetchItems = useCallback(async (popularOnly) => {
    const params = popularOnly ? { popular: "true" } : {};
    const response = await Promise.race([
      apiMethod(params),
      new Promise((_, reject) => setTimeout(() => reject(new Error("The catalogue took too long to load. Refresh or contact IT if this continues.")), TIMEOUT_MS)),
    ]);
    return (response.data?.items || []).map(item => ({
      ...item,
      id: item.managedCatalogueItemId || item.id,
      category: item.categoryName || item.ticketCategory || item.category,
      sub_category: item.ticketSubCategory || item.subCategory || item.sub_category || null,
      item_name: item.name || item.item_name,
      user_description: item.description || item.user_description || "",
      default_priority: item.priority || item.default_priority || "Medium",
    }));
  }, [apiMethod]);

  useEffect(() => {
    cancelRef.current = false;
    setLoading(true);
    setError("");

    const cached = cacheGet(cKey);
    if (cached && cached.items.length > 0) {
      if (!cancelRef.current) {
        setItems(cached.items);
        setCategories(cached.categories || []);
        setLoading(false);
        setAllItemsLoaded(true);
      }
      return;
    }

    (async () => {
      try {
        const popularItems = popularFirst ? await fetchItems(true) : await fetchItems(false);
        if (cancelRef.current) return;
        setItems(popularItems);
        const catNames = [...new Set(popularItems.map(i => i.categoryName || i.category).filter(Boolean))];
        setCategories(catNames.map(name => ({ id: name, name })));
        setLoading(false);
        if (!popularFirst) setAllItemsLoaded(true);
      } catch (err) {
        if (cancelRef.current) return;
        setError(err?.response?.data?.error || err?.message || "The catalogue could not be loaded.");
        setLoading(false);
      }
    })();

    return () => { cancelRef.current = true; };
  }, [catalogueType, workspaceCode, moduleKey, cKey, popularFirst, fetchItems]);

  const loadAllItems = useCallback(async () => {
    if (allItemsLoaded) return;
    setLoadingFull(true);
    setError("");
    try {
      const allItems = await fetchItems(false);
      if (cancelRef.current) return;
      const filtered = moduleKey === "asset"
        ? allItems.filter(i => {
            const cat = String(i.category || i.categoryName || "").trim().toLowerCase();
            const sub = String(i.sub_category || i.subCategory || "").trim().toLowerCase();
            return cat === "hardware /equipment" && sub.startsWith("asset ");
          })
        : allItems.filter(i => !i.isOther && String(i.item_name || i.name || "").trim().toLowerCase() !== "other");
      setItems(filtered);
      const catNames = [...new Set(filtered.map(i => i.categoryName || i.category).filter(Boolean))];
      setCategories(catNames.map(name => ({ id: name, name })));
      cacheSet(cKey, filtered, catNames.map(name => ({ id: name, name })), cacheTtlMs);
      setAllItemsLoaded(true);
    } catch (err) {
      if (cancelRef.current) return;
      setError(err?.response?.data?.error || err?.message || "The full catalogue could not be loaded.");
    } finally {
      if (!cancelRef.current) setLoadingFull(false);
    }
  }, [allItemsLoaded, fetchItems, moduleKey, cKey, cacheTtlMs]);

  const refresh = useCallback(async () => {
    cacheInvalidate(cKey);
    setAllItemsLoaded(false);
    setLoading(true);
    try {
      const popularItems = popularFirst ? await fetchItems(true) : await fetchItems(false);
      setItems(popularItems);
      const catNames = [...new Set(popularItems.map(i => i.categoryName || i.category).filter(Boolean))];
      setCategories(catNames.map(name => ({ id: name, name })));
      setError("");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "The catalogue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [popularFirst, fetchItems, cKey]);

  const popularItems = items.filter(i => i.popular === true);

  return { items, categories, loading, loadingFull, error, allItemsLoaded, popularItems, loadAllItems, refresh };
}