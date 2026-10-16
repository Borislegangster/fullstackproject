"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  text?: string;
}

interface ToastApi {
  show: (tone: ToastTone, title: string, text?: string) => void;
  success: (title: string, text?: string) => void;
  error: (title: string, text?: string) => void;
  info: (title: string, text?: string) => void;
  warning: (title: string, text?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const STYLES = {
  success: "border-emerald-200 text-emerald-800",
  error: "border-red-200 text-red-800",
  info: "border-brand-200 text-brand-800",
  warning: "border-amber-200 text-amber-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (tone: ToastTone, title: string, text?: string) => {
      const id = ++counter;
      setItems((list) => [...list.slice(-4), { id, tone, title, text }]);
      setTimeout(() => remove(id), tone === "error" ? 8000 : 4500);
    },
    [remove],
  );
  const value = useMemo<ToastApi>(
    () => ({
      show,
      success: (t, x) => show("success", t, x),
      error: (t, x) => show("error", t, x),
      info: (t, x) => show("info", t, x),
      warning: (t, x) => show("warning", t, x),
    }),
    [show],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              className={clsx(
                "pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg",
                STYLES[t.tone],
              )}
              role={t.tone === "error" ? "alert" : "status"}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.text ? <p className="mt-0.5 text-sm text-ink/80">{t.text}</p> : null}
              </div>
              <button type="button" onClick={() => remove(t.id)} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast hors ToastProvider");
  return ctx;
}
