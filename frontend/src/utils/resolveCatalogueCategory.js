import { catalogApi } from "../services/api";

export async function resolveCatalogueCategory(catalogueItemId, catalogueType) {
  try {
    const r = await catalogApi.resolveCategory(catalogueItemId, catalogueType);
    const data = r.data;

    if (data.mappingStatus === "ambiguous" && data.ambiguousOptions?.length) {
      const choice = window.prompt(
        `Multiple categories match this item. Choose one:\n${data.ambiguousOptions.map((o, i) => `${i + 1}. ${o.ticketCategory}${o.ticketSubCategory ? " > " + o.ticketSubCategory : ""}`).join("\n")}\n\nEnter 1-${data.ambiguousOptions.length}:`
      );
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < data.ambiguousOptions.length) {
        const selected = data.ambiguousOptions[idx];
        return {
          ticketCategory: selected.ticketCategory,
          ticketSubCategory: selected.ticketSubCategory,
          isLocked: selected.isLocked,
          fallbackApplied: false,
          ambiguous: true,
        };
      }
    }

    return {
      ticketCategory: data.ticketCategory,
      ticketSubCategory: data.ticketSubCategory,
      isLocked: data.isLocked,
      fallbackApplied: data.fallbackApplied,
      mappingStatus: data.mappingStatus,
    };
  } catch (e) {
    return {
      ticketCategory: "Other",
      ticketSubCategory: null,
      isLocked: false,
      fallbackApplied: true,
      mappingStatus: "unmapped",
      error: e.response?.data?.error || e.message,
    };
  }
}