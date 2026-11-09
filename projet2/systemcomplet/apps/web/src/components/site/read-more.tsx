"use client";

/** Texte long replié : un nombre de lignes adapté à l'écran (mobile, tablette, ordinateur) reste visible, le reste
 * est masqué sous un fondu ; « Lire plus » le déplie, « Lire moins » le replie. Le bouton n'apparaît que si le texte
 * dépasse nettement (plus d'une ligne et demie de plus) : un texte court ou presque court s'affiche en entier. Tout le
 * texte reste dans la page (référencement, impression, lecteurs d'écran). */

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { READ_MORE, type Lines } from "./read-more-lines";

/** unknown : avant la mesure (replié par la feuille de style, comme au rendu serveur) ; fit : affiché en entier. */
type Mode = "unknown" | "overflow" | "fit";

export function ReadMore({
  children,
  lines = READ_MORE.lead,
  className,
  onDark = false,
  as: Tag = "div",
  innerClassName,
  toggleClassName,
}: {
  children: ReactNode;
  lines?: Lines;
  /** Classes du texte (taille, interlignage, couleur) : le nombre de lignes se calcule sur cet interlignage. */
  className?: string;
  onDark?: boolean;
  as?: "div" | "blockquote";
  /** Classes du contenu (espacement entre paragraphes). */
  innerClassName?: string;
  toggleClassName?: string;
}) {
  const id = useId();
  const box = useRef<HTMLElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    if (open) return; // déplié : on garde le bouton « Lire moins »
    const outer = box.current;
    const content = inner.current;
    if (!outer || !content) return;
    const measure = () => {
      const style = getComputedStyle(outer);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.65;
      const visible = (parseFloat(style.getPropertyValue("--rm-lines")) || 6) * lineHeight;
      setMode(content.offsetHeight - visible > lineHeight * 1.5 ? "overflow" : "fit");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      // On replie : si le début du texte est remonté hors de l'écran, on y ramène le lecteur.
      const top = box.current?.getBoundingClientRect().top ?? 0;
      if (top < 80) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        box.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    }
    setOpen(!open);
  };

  const [base, sm, lg] = Array.isArray(lines) ? lines : [lines];
  const style = { "--rm-base": base, "--rm-sm": sm ?? base, "--rm-lg": lg ?? sm ?? base } as CSSProperties;

  return (
    <div className="read-more">
      <Tag ref={box as never} id={id} className={clsx("read-more-body", className)} data-open={open ? "true" : "false"} data-mode={mode} style={style}>
        <div ref={inner} className={clsx("read-more-inner", innerClassName)}>
          {children}
        </div>
      </Tag>
      {mode === "overflow" ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          className={clsx(
            "read-more-toggle mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition",
            onDark
              ? "bg-white/10 text-accent-200 ring-white/20 hover:bg-white/15 hover:text-accent-100"
              : "bg-accent-50 text-accent-700 ring-accent-200 hover:bg-accent-100 hover:text-accent-800",
            toggleClassName,
          )}
        >
          {open ? "Lire moins" : "Lire plus"}
          <ChevronDown className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
