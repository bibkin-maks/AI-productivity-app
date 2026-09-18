import { useEffect } from "react";
import { X } from "lucide-react";

// Single status message with an optional action (e.g. Undo). Auto-dismisses unless it's an error.
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast || toast.tone === "error") return;
    const t = setTimeout(onDismiss, toast.action ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="app-toast" data-tone={toast.tone || "info"} role={toast.tone === "error" ? "alert" : "status"}>
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="app-toast__action"
          onClick={() => {
            toast.action.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="app-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
