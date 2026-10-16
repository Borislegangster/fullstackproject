"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { errorMessage } from "@/lib/api";

import { Alert, Button } from "./primitives";
import { Field, Textarea } from "./form";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  description?: ReactNode;
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className={clsx(
            "flex max-h-[92vh] w-full animate-fade-in flex-col rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl",
            { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl", full: "sm:max-w-[96vw]" }[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = "lg",
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
  subtitle?: ReactNode;
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex justify-end bg-brand-900/30 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <aside
          role="dialog"
          aria-modal="true"
          className={clsx("flex h-full w-full flex-col bg-surface shadow-2xl", { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-6xl" }[width])}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
              {subtitle ? <div className="mt-0.5 text-sm text-muted">{subtitle}</div> : null}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-white px-5 py-3">{footer}</div> : null}
        </aside>
      </div>
    </Portal>
  );
}

/** Confirmation d'une action, avec motif obligatoire si `reasonLabel` est fourni. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = "Confirmer",
  tone = "primary",
  reasonLabel,
  reasonMin = 3,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "accent";
  reasonLabel?: string;
  reasonMin?: number;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);
  const invalid = !!reasonLabel && reason.trim().length < reasonMin;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : tone === "accent" ? "accent" : "primary"}
            loading={busy}
            disabled={invalid}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm(reason.trim());
                onClose();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text ? <div className="text-sm text-muted">{text}</div> : null}
      {children}
      {reasonLabel ? (
        <Field label={reasonLabel} required className="mt-4" help={`${reasonMin} caractères minimum`}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </Field>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </Modal>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: string; label: ReactNode; count?: number | null; hidden?: boolean }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  // Onglet actif toujours visible dans la barre défilante (ex. lien profond « ?onglet=sequestre »).
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = strip.current;
    const active = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !active || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: Math.max(0, active.offsetLeft - box.clientWidth / 2 + active.offsetWidth / 2) });
  }, [value]);
  return (
    <div ref={strip} className={clsx("relative -mx-1 overflow-x-auto", className)}>
      <div role="tablist" className="flex min-w-max gap-1 border-b border-line px-1">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={value === t.key}
              onClick={() => onChange(t.key)}
              className={clsx(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                value === t.key ? "border-accent-500 text-brand-700" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.count !== undefined && t.count !== null ? (
                <span className={clsx("rounded-full px-1.5 text-xs", value === t.key ? "bg-accent-100 text-accent-700" : "bg-slate-100 text-muted")}>{t.count}</span>
              ) : null}
            </button>
          ))}
      </div>
    </div>
  );
}

export function Dropdown({ trigger, children, align = "right" }: { trigger: (toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen((o) => !o))}
      {open ? (
        <div className={clsx("absolute z-50 mt-1 min-w-[14rem] rounded-xl border border-line bg-white p-1 shadow-xl", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ onClick, children, danger, href }: { onClick?: () => void; children: ReactNode; danger?: boolean; href?: string }) {
  const cls = clsx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50", danger ? "text-red-600" : "text-ink");
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
