import CatalogueCard from "./CatalogueCard";
import CatalogueSkeletonGrid from "./CatalogueSkeletonGrid";

export default function CatalogueCardGrid({ items, loading, loadingFull, skeletonCount = 6, onItemSelect, iconResolver, artSrcResolver, adminLink, emptyMessage = "No matching items" }) {
  if (loading || loadingFull) return <CatalogueSkeletonGrid count={skeletonCount} />;
  if (!items || items.length === 0) return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {adminLink}
      {items.map(item => (
        <CatalogueCard key={item.id || item.managedCatalogueItemId} item={item} onSelect={onItemSelect} iconResolver={iconResolver} artSrcResolver={artSrcResolver} />
      ))}
    </div>
  );
}