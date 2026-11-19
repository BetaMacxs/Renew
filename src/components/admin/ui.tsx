"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import styles from "./admin.module.css";

/* ------------------------------------------------------------- structure */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLead}>
        {back && <div className={styles.pageHeaderBack}>{back}</div>}
        <h1 className={`display ${styles.pageTitle}`}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  padded = true,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`${styles.panel} ${className}`}>
      {(title || actions) && (
        <div className={styles.panelHeader}>
          <div>
            {title && <h2 className={styles.panelTitle}>{title}</h2>}
            {description && <p className={styles.panelDesc}>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? styles.panelBody : ""}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- fields */

function useFieldId(explicit?: string) {
  const generated = useId();
  return explicit ?? generated;
}

const controlClass = (invalid: boolean) => `${styles.control} ${invalid ? styles.controlInvalid : ""}`;

type FieldShell = { label: ReactNode; hint?: ReactNode; error?: string; className?: string; optional?: boolean };

function Shell({ id, label, hint, error, className = "", optional, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={styles.fieldLabel}>
        <span>{label}</span>
        {optional && <span className={styles.fieldOptional}>Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  optional,
  prefix,
  prefixVariant = "short",
  suffix,
  id,
  ...input
}: FieldShell &
  InputHTMLAttributes<HTMLInputElement> & {
    prefix?: ReactNode;
    prefixVariant?: "short" | "products" | "grouping";
    suffix?: ReactNode;
  }) {
  const fieldId = useFieldId(id);
  const prefixClass =
    prefixVariant === "products"
      ? styles.controlPrefixProducts
      : prefixVariant === "grouping"
        ? styles.controlPrefixGrouping
        : styles.controlPrefixShort;

  const control = (
    <input
      id={fieldId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
      {...input}
      className={`${controlClass(Boolean(error))} ${prefix ? prefixClass : ""} ${suffix ? styles.controlSuffixPad : ""}`}
    />
  );
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      {prefix || suffix ? (
        <div className={styles.controlWrap}>
          {prefix && <span className={styles.controlPrefix}>{prefix}</span>}
          {control}
          {suffix && <span className={styles.controlSuffix}>{suffix}</span>}
        </div>
      ) : (
        control
      )}
    </Shell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  ...textarea
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = useFieldId(id);
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...textarea}
        className={`${controlClass(Boolean(error))} ${styles.textarea}`}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  children,
  ...select
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = useFieldId(id);
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        {...select}
        className={`${controlClass(Boolean(error))} ${styles.select}`}
      >
        {children}
      </select>
    </Shell>
  );
}

/** An on/off switch with a label and a one-line explanation. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useFieldId();
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <label htmlFor={id} className={styles.toggleLabel}>
          {label}
        </label>
        {description && <p className={styles.toggleDesc}>{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`${styles.switchBtn} ${checked ? styles.switchBtnChecked : ""}`}
      >
        <span className={`${styles.switchThumb} ${checked ? styles.switchThumbChecked : ""}`} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ pills */

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted" | "accent";

const toneClass: Record<Tone, string> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  warning: styles.toneWarning,
  success: styles.toneSuccess,
  danger: styles.toneDanger,
  muted: styles.toneMuted,
  accent: styles.toneAccent,
};

export function Pill({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`${styles.pill} ${toneClass[tone]} ${className}`}>{children}</span>;
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Info : CircleAlert;
  return (
    <div className={`${styles.notice} ${toneClass[tone]}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon size={18} className={styles.noticeIcon} />
      <div className={styles.noticeBody}>
        {title && <p className={styles.noticeTitle}>{title}</p>}
        {children && <div className={title ? styles.noticeTextWithTitle : ""}>{children}</div>}
      </div>
      {action && <div className={styles.noticeAction}>{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyDesc}>{children}</div>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- dialogs */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      // React lets `close` bubble, so a confirm dialog opened from inside this
      // one would close both. Only react to our own.
      onClose={(event) => event.target === event.currentTarget && onClose()}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={`${styles.modal} ${size === "lg" ? styles.modalLg : styles.modalMd}`}
    >
      <div className={styles.modalInner}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </dialog>
  );
}

/** A button that asks before doing something that cannot be undone. */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "outline",
  confirmVariant = "danger",
  size = "md",
  disabled,
  className,
}: {
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={buttonClass({ variant, size, className })}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={title}
        footer={
          <>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass({ variant: confirmVariant })}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                  setOpen(false);
                }
              }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </>
        }
      >
        <div className={styles.confirmDesc}>{description}</div>
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------------- toasts */

type Toast = { id: number; tone: "success" | "danger" | "info"; text: string };
const ToastContext = createContext<(tone: Toast["tone"], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, text }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === "danger" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.tone === "danger" ? styles.toastDanger : styles.toastDefault}`}
            role={toast.tone === "danger" ? "alert" : "status"}
          >
            {toast.tone === "success" ? <CircleCheck size={16} /> : toast.tone === "danger" ? <CircleAlert size={16} /> : <Info size={16} />}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
