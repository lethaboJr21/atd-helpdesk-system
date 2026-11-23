import { Loader2, Inbox, AlertCircle } from "lucide-react";

export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      <span className="ml-2 text-sm text-slate-500">{message}</span>
    </div>
  );
}

export function EmptyState({ message = "No data available.", icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="mt-2 text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
        >
          Try again
        </button>
      )}
    </div>
  );
}