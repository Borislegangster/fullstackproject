"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";

/** Règles alignées sur la politique serveur (validate_password_strength). */
export function passwordIssues(password: string, minLength = 12): string[] {
  const issues: string[] = [];
  if (password.length < minLength) issues.push(`${minLength} caractères minimum`);
  if (!/[a-z]/.test(password)) issues.push("une minuscule");
  if (!/[A-Z]/.test(password)) issues.push("une majuscule");
  if (!/\d/.test(password)) issues.push("un chiffre");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("un caractère spécial");
  return issues;
}

export function PasswordStrength({ password, minLength = 12 }: { password: string; minLength?: number }) {
  const rules = [
    { label: `${minLength} caractères minimum`, ok: password.length >= minLength },
    { label: "Une minuscule", ok: /[a-z]/.test(password) },
    { label: "Une majuscule", ok: /[A-Z]/.test(password) },
    { label: "Un chiffre", ok: /\d/.test(password) },
    { label: "Un caractère spécial", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter((r) => r.ok).length;
  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex gap-1">
        {rules.map((_, i) => (
          <span key={i} className={clsx("h-1 flex-1 rounded-full", i < score ? (score >= 5 ? "bg-emerald-500" : score >= 3 ? "bg-amber-400" : "bg-red-400") : "bg-slate-200")} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {rules.map((r) => (
          <li key={r.label} className={clsx("flex items-center gap-1", r.ok ? "text-emerald-700" : "text-muted")}>
            {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
