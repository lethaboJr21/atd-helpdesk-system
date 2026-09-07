export default function DashboardWidgetGrid({ children, columns = 4, className = "" }) {
  const layouts = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 xl:grid-cols-3",
    4: "md:grid-cols-2 xl:grid-cols-4",
  };
  return <div className={`grid gap-4 ${layouts[columns] || layouts[4]} ${className}`.trim()}>{children}</div>;
}
