import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal surface for the app. variant "dialog" = centred card, "sheet" = right drawer (bottom sheet on mobile).
// Renders into <body>, traps focus, closes on Escape / backdrop, restores focus on close.
export default function Dialog({ open, onClose, title, description, variant = "dialog", theme, children, footer, initialFocus }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const panel = panelRef.current;
    const target = (initialFocus && panel?.querySelector(initialFocus)) || panel?.querySelector(FOCUSABLE);
    target?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="app app-overlay" data-theme={theme} data-variant={variant} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="app-dialog"
        data-variant={variant}
      >
        <header className="app-dialog__head">
          <div className="min-w-0">
            <h2 id={titleId} className="app-display text-3xl">{title}</h2>
            {description && <p id={descId} className="app-muted mt-1">{description}</p>}
          </div>
          <button type="button" className="app-icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="app-dialog__body">{children}</div>
        {footer && <footer className="app-dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
