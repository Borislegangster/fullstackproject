/** Texte saisi dans le CMS : découpé en paragraphes (les retours à la ligne de l'éditeur sont respectés) et replié
 * au-delà d'un nombre de lignes adapté à l'écran (« Lire plus » / « Lire moins »). */

import clsx from "clsx";

import { ReadMore } from "./read-more";
import { READ_MORE, type Lines } from "./read-more-lines";

export function Paragraphs({ text, className, firstClassName }: { text?: string | null; className?: string; firstClassName?: string }) {
  const parts = (text ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <>
      {parts.map((part, i) => (
        <p key={i} className={clsx(className, i === 0 && firstClassName)}>
          {part}
        </p>
      ))}
    </>
  );
}

/** Paragraphes repliés. `className` porte la typographie (taille, interlignage, couleur) sur laquelle se comptent les
 * lignes visibles ; l'espacement entre paragraphes est inclus. */
export function LongText({
  text,
  lines = READ_MORE.lead,
  className,
  firstClassName,
  onDark,
  toggleClassName,
}: {
  text?: string | null;
  lines?: Lines;
  className?: string;
  firstClassName?: string;
  onDark?: boolean;
  toggleClassName?: string;
}) {
  if (!text?.trim()) return null;
  return (
    <ReadMore lines={lines} onDark={onDark} className={className} innerClassName="space-y-4" toggleClassName={toggleClassName}>
      <Paragraphs text={text} firstClassName={firstClassName} />
    </ReadMore>
  );
}
