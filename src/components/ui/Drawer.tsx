"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A side panel built on the native <dialog> element, which already traps
 * focus, closes on Escape and returns focus to whatever opened it. It slides
 * in from the inline end — the right in English, the left in Arabic.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "end",
  closeLabel,
  footer,
  children,
  widthClass = "",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "start" | "end";
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={`dc-drawer ${side === "end" ? "drawer-end" : "drawer-start"} ${widthClass}`.trim()}
    >
      <div className="dc-drawer-shell">
        <div className="dc-drawer-header">
          <h2 className="dc-drawer-title">{title}</h2>
          <button type="button" onClick={onClose} className="dc-drawer-close" aria-label={closeLabel}>
            <X size={20} />
          </button>
        </div>
        <div className="dc-drawer-body">{children}</div>
        {footer && <div className="dc-drawer-footer">{footer}</div>}
      </div>
    </dialog>
  );
}
