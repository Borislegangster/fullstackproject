"use client";

import clsx from "clsx";
import { Search, Upload, X } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  Fragment,
  isValidElement,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { fileSize } from "@/lib/format";

export const controlClass =
  "block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted aria-[invalid=true]:border-red-400";

export function Field({
  label,
  required,
  help,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  // Association automatique libellé ↔ contrôle (nom accessible, aide et erreur annoncées) quand le champ
  // contient un contrôle unique : lecteurs d'écran, tests et clic sur le libellé fonctionnent partout.
  const autoId = useId();
  const describedBy = error || help ? `${autoId}-desc` : undefined;
  let target = htmlFor;
  let control = children;
  if (!target && isValidElement<{ id?: string; "aria-describedby"?: string }>(children) && children.type !== Fragment) {
    target = children.props.id ?? `${autoId}-ctl`;
    control = cloneElement(children, { id: target, "aria-describedby": children.props["aria-describedby"] ?? describedBy });
  }
  return (
    <div className={clsx("min-w-0", className)}>
      {label ? (
        <label htmlFor={target} className="mb-1 block text-sm font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-red-600" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {control}
      {error ? (
        <p id={describedBy} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={describedBy} className="mt-1 text-xs text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} className={clsx(controlClass, className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={clsx(controlClass, "min-h-[5rem]", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export interface Option {
  value: string;
  label: string;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string; invalid?: boolean }
>(function Select({ className, options, placeholder, invalid, ...props }, ref) {
  return (
    <select ref={ref} className={clsx(controlClass, "pr-8", className)} aria-invalid={invalid || undefined} {...props}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  description,
  id,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: ReactNode;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-500 focus:ring-brand-300"
      />
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm text-ink disabled:opacity-50"
    >
      <span className={clsx("relative inline-flex h-5 w-9 items-center rounded-full transition", checked ? "bg-brand-500" : "bg-slate-300")}>
        <span className={clsx("inline-block h-4 w-4 rounded-full bg-white shadow transition", checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Rechercher…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(controlClass, "pl-9")}
        aria-label={placeholder}
      />
    </div>
  );
}

/** Sélection de fichiers avec glisser-déposer, aperçu des noms et tailles. */
export function FileDrop({
  files,
  onChange,
  multiple,
  accept,
  label = "Déposez un fichier ou cliquez pour parcourir",
  maxSizeMb,
  capture,
  id,
  "aria-describedby": describedBy,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  maxSizeMb?: number;
  capture?: "user" | "environment";
  id?: string;
  "aria-describedby"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    if (maxSizeMb && picked.some((f) => f.size > maxSizeMb * 1024 * 1024)) {
      setError(`Taille maximale : ${maxSizeMb} Mo par fichier`);
      return;
    }
    setError(null);
    onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  };
  return (
    <div>
      <button
        id={id}
        type="button"
        aria-describedby={describedBy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition",
          over ? "border-brand-400 bg-brand-50" : "border-line bg-white hover:border-brand-300",
        )}
      >
        <Upload className="h-5 w-5 text-brand-500" aria-hidden="true" />
        <span className="text-ink">{label}</span>
        {accept ? <span className="text-xs text-muted">Formats : {accept}</span> : null}
      </button>
      <input
        ref={ref}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        capture={capture}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {files.length ? (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span className="truncate">{f.name}</span>
              <span className="flex items-center gap-2 text-muted">
                {fileSize(f.size)}
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Retirer ${f.name}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Saisie d'une liste de valeurs texte (étiquettes, mots-clés). */
export function TagInput({
  value,
  onChange,
  placeholder = "Ajouter puis Entrée",
  id,
  "aria-describedby": describedBy,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState("");
  const commit = () => {
    const v = text.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
  };
  return (
    <div className={clsx(controlClass, "flex flex-wrap items-center gap-1.5 py-1.5")}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Retirer ${tag}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 border-0 bg-transparent p-0.5 text-sm focus:outline-none focus:ring-0"
      />
    </div>
  );
}

/** Saisie d'un code à 6 chiffres (OTP / TOTP). */
export function CodeInput({ value, onChange, length = 6, autoFocus }: { value: string; onChange: (v: string) => void; length?: number; autoFocus?: boolean }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={length}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
      className={clsx(controlClass, "text-center font-mono text-2xl tracking-[0.5em]")}
      aria-label="Code de vérification"
    />
  );
}
