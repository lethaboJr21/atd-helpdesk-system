/**
 * Cascading Category → Sub-category → Item picker (Freshservice nested fields).
 */
export default function CategoryCascade({
  tree = [],
  category,
  subCategory,
  itemCategory,
  onChange,
  required = false,
  labels = {
    category: "Category",
    subCategory: "Sub-category",
    itemCategory: "Item",
  },
}) {
  const categoryNode = tree.find((node) => node.value === category) || null;
  const subOptions = categoryNode?.children || [];
  const subNode = subOptions.find((node) => node.value === subCategory) || null;
  const itemOptions = subNode?.children || [];

  const selectClass = "input";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="block md:col-span-1">
        <span className="text-sm font-bold text-slate-700">
          {labels.category}
          {required ? " *" : ""}
        </span>
        <div className="mt-2">
          <select
            value={category}
            required={required}
            onChange={(event) =>
              onChange({
                category: event.target.value,
                subCategory: "",
                itemCategory: "",
              })
            }
            className={selectClass}
          >
            <option value="">Select category</option>
            {tree.map((node) => (
              <option key={node.value} value={node.value}>
                {node.value}
              </option>
            ))}
          </select>
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-slate-700">
          {labels.subCategory}
        </span>
        <div className="mt-2">
          <select
            value={subCategory}
            disabled={!category || subOptions.length === 0}
            onChange={(event) =>
              onChange({
                category,
                subCategory: event.target.value,
                itemCategory: "",
              })
            }
            className={`${selectClass} disabled:bg-slate-100`}
          >
            <option value="">
              {subOptions.length ? "Select sub-category" : "Not applicable"}
            </option>
            {subOptions.map((node) => (
              <option key={node.value} value={node.value}>
                {node.value}
              </option>
            ))}
          </select>
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-slate-700">
          {labels.itemCategory}
        </span>
        <div className="mt-2">
          <select
            value={itemCategory}
            disabled={!subCategory || itemOptions.length === 0}
            onChange={(event) =>
              onChange({
                category,
                subCategory,
                itemCategory: event.target.value,
              })
            }
            className={`${selectClass} disabled:bg-slate-100`}
          >
            <option value="">
              {itemOptions.length ? "Select item" : "Not applicable"}
            </option>
            {itemOptions.map((node) => (
              <option key={node.value} value={node.value}>
                {node.value}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  );
}
