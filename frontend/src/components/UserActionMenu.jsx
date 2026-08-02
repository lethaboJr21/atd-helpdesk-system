import { useEffect, useRef, useState } from "react";
import { EllipsisVertical } from "lucide-react";

export default function UserActionMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100" aria-label="Open user actions" aria-expanded={open}>
        <EllipsisVertical className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {actions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No actions available.</p>
          ) : actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50 ${action.danger ? "text-red-700" : "text-slate-700"}`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
