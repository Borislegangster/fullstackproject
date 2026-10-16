/** Rendu des médias de la médiathèque (images responsives WebP/AVIF, vidéos locales, vidéos YouTube/Vimeo). */

import clsx from "clsx";

import type { Media } from "@/lib/cms-types";

function srcSet(media: Media, names: string[]): string | undefined {
  const parts = names
    .map((n) => media.variants?.[n])
    .filter((v): v is NonNullable<typeof v> => !!v && !!v.width)
    .map((v) => `${v.url} ${v.width}w`);
  return parts.length ? parts.join(", ") : undefined;
}

export function MediaImage({
  media,
  className,
  sizes = "100vw",
  priority,
  alt,
  rounded,
}: {
  media?: Media | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  alt?: string;
  rounded?: boolean;
}) {
  if (!media || !media.url) return null;
  const focal = media.focal ? `${Math.round(media.focal.x * 100)}% ${Math.round(media.focal.y * 100)}%` : undefined;
  const avif = srcSet(media, ["md_avif", "lg_avif"]);
  const webp = srcSet(media, ["thumb", "md", "lg"]);
  return (
    <picture>
      {avif ? <source type="image/avif" srcSet={avif} sizes={sizes} /> : null}
      {webp ? <source type="image/webp" srcSet={webp} sizes={sizes} /> : null}
      <img
        src={media.variants?.lg?.url ?? media.url}
        alt={alt ?? media.alt ?? ""}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={clsx("object-cover", rounded && "rounded-2xl", className)}
        style={focal ? { objectPosition: focal } : undefined}
      />
    </picture>
  );
}

export function MediaVideo({
  media,
  className,
  autoPlay,
  title,
  poster,
}: {
  media?: Media | null;
  className?: string;
  autoPlay?: boolean;
  title?: string;
  poster?: Media | null;
}) {
  if (!media) return null;
  if (media.kind === "external_video" && media.embed_url) {
    const params = autoPlay ? "?autoplay=1&mute=1&rel=0" : "?rel=0";
    return (
      <div className={clsx("relative aspect-video w-full overflow-hidden rounded-2xl bg-brand-900", className)}>
        <iframe
          src={`${media.embed_url}${params}`}
          title={title ?? media.title ?? "Vidéo"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  if (!media.url) return null;
  return (
    <video
      className={clsx("w-full rounded-2xl bg-brand-900", className)}
      controls={!autoPlay}
      autoPlay={autoPlay}
      muted={autoPlay}
      loop={autoPlay}
      playsInline
      preload="metadata"
      poster={poster?.variants?.lg?.url ?? poster?.url ?? media.poster_url}
      aria-label={title ?? media.title ?? "Vidéo"}
    >
      <source src={media.url} type={media.mime ?? "video/mp4"} />
    </video>
  );
}

export function MediaAny({ media, className, sizes }: { media?: Media | null; className?: string; sizes?: string }) {
  if (!media) return null;
  if (media.kind === "video" || media.kind === "external_video") return <MediaVideo media={media} className={className} />;
  if (media.kind === "image" || media.kind === "svg") return <MediaImage media={media} className={className} sizes={sizes} />;
  if (media.url)
    return (
      <a href={media.url} className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">
        {media.title ?? "Télécharger le document"}
      </a>
    );
  return null;
}
