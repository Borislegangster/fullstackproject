"""Schémas CMS : blocs éditoriaux typés (médias uniquement par `media_id`), SEO, pages, navigation."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

import nh3
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import settings

_HREF_RE = re.compile(r"^(/(?!uploads)[^\s]*|#[\w-]+|https://[^\s]+|mailto:[^\s]+|tel:[+\d\s]+)$")

# Texte riche du CMS : mise en forme éditoriale ET code HTML saisi par les éditeurs (mise en page en blocs, tableaux,
# encadrés, images de la médiathèque, vidéos intégrées). Rendu tel quel sur le site après assainissement : jamais de
# script, de style global, de formulaire ni d'attribut d'événement (on*).
ALLOWED_TAGS = {
    *("p", "br", "hr", "div", "span", "section", "article", "aside", "header", "footer", "address"),
    *("h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small"),
    *("sup", "sub", "code", "pre", "kbd", "abbr", "cite", "q", "time", "blockquote"),
    *("a", "ul", "ol", "li", "dl", "dt", "dd", "details", "summary"),
    *("table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td"),
    *("figure", "figcaption", "img", "picture", "source", "video", "iframe"),
}
_GLOBAL_ATTRIBUTES = {"class", "id", "style", "title", "lang", "dir", "role"}
ALLOWED_ATTRIBUTES = {
    "*": _GLOBAL_ATTRIBUTES,
    "a": {"href", "target"},
    "img": {"src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"},
    "source": {"src", "srcset", "type", "media", "sizes"},
    "video": {"src", "poster", "controls", "muted", "loop", "playsinline", "preload", "width", "height"},
    "iframe": {"src", "width", "height", "allow", "allowfullscreen", "loading", "referrerpolicy"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
    "col": {"span"},
    "colgroup": {"span"},
    "ol": {"start", "type", "reversed"},
    "time": {"datetime"},
    "details": {"open"},
    "blockquote": {"cite"},
    "q": {"cite"},
}
# Propriétés CSS autorisées dans l'attribut style (mise en page et typographie ; pas de positionnement par-dessus
# la page, pas d'image de fond externe).
ALLOWED_STYLE_PROPERTIES = {
    *("color", "background-color", "opacity", "text-align", "vertical-align", "font-weight", "font-style"),
    *("font-size", "line-height", "letter-spacing", "text-transform", "text-decoration", "white-space"),
    *("margin", "margin-top", "margin-right", "margin-bottom", "margin-left"),
    *("padding", "padding-top", "padding-right", "padding-bottom", "padding-left"),
    *("border", "border-top", "border-right", "border-bottom", "border-left", "border-color", "border-width"),
    *("border-style", "border-radius", "border-collapse", "box-shadow", "outline"),
    *("width", "min-width", "max-width", "height", "min-height", "max-height", "aspect-ratio", "object-fit"),
    *("display", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "gap", "row-gap"),
    *("column-gap", "justify-content", "align-items", "align-self", "align-content", "order", "float", "clear"),
    *("grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "list-style-type", "overflow"),
}
_MEDIA_SRC = re.compile(rf"^{re.escape(settings.API_PREFIX)}/public/media/[0-9a-f-]{{36}}/[a-z0-9_]+$")
_MEDIA_REF = re.compile(rf"{re.escape(settings.API_PREFIX)}/public/media/([0-9a-f-]{{36}})/")
_EMBED_SRC = re.compile(
    r"^https://(www\.youtube-nocookie\.com/embed/|www\.youtube\.com/embed/|player\.vimeo\.com/video/"
    r"|www\.google\.com/maps/embed|www\.openstreetmap\.org/export/embed\.html)[^\s\"'<>]*$"
)


def _attribute_filter(element: str, attribute: str, value: str) -> str | None:
    if element in ("img", "video", "source") and attribute in ("src", "poster"):
        return value if _MEDIA_SRC.match(value) else None  # images et vidéos : médiathèque uniquement
    if attribute in ("srcset",):
        parts = [p.strip().split(" ")[0] for p in value.split(",") if p.strip()]
        return value if parts and all(_MEDIA_SRC.match(p) for p in parts) else None
    if element == "iframe" and attribute == "src":
        return value if _EMBED_SRC.match(value) else None  # intégrations : YouTube, Vimeo, cartes
    if element == "a" and attribute == "target":
        return value if value in ("_blank", "_self") else None
    if attribute == "style" and re.search(r"url\s*\(|expression\s*\(|@import|javascript:", value, re.I):
        return None
    return value


def sanitize_html(value: str) -> str:
    """HTML éditorial assaini : balises et styles de mise en page autorisés, médias de la médiathèque uniquement,
    intégrations vidéo / carte reconnues ; jamais de script, d'attribut d'événement ni de formulaire."""
    if "/uploads" in value:
        raise ValueError("Chemin de fichier libre interdit : utiliser la médiathèque (media_id)")
    return nh3.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        attribute_filter=_attribute_filter,
        filter_style_properties=ALLOWED_STYLE_PROPERTIES,
        generic_attribute_prefixes={"data-", "aria-"},
        url_schemes={"https", "mailto", "tel"},
        link_rel="noopener noreferrer",
        set_tag_attribute_values={"iframe": {"loading": "lazy", "referrerpolicy": "strict-origin-when-cross-origin"}},
    )


def html_media_ids(value: str | None) -> set[uuid.UUID]:
    """Médias de la médiathèque référencés dans un texte riche (images, vidéos insérées)."""
    return {uuid.UUID(x) for x in _MEDIA_REF.findall(value or "")}


def html_warnings(value: str) -> list[str]:
    """Ce que l'assainissement retire d'un code HTML saisi (affiché à l'éditeur avant insertion)."""
    checks = [
        (r"<\s*script", "Les scripts sont retirés (sécurité du site) ; les balises de mesure se règlent dans SEO."),
        (r"\son[a-z]+\s*=", "Les attributs d'événement (onclick, onload…) sont retirés."),
        (r"<\s*style", "Les balises <style> sont retirées : utilisez l'attribut style sur les éléments."),
        (r"<\s*(form|input|button|select|textarea)\b", "Les formulaires sont retirés : utilisez le bloc Formulaire."),
        (r"<\s*(object|embed|applet|link|meta|base)\b", "Les balises object, embed, link, meta et base sont retirées."),
        (r"javascript:", "Les liens javascript: sont retirés."),
    ]
    out = [message for pattern, message in checks if re.search(pattern, value, re.I)]
    for src in re.findall(r"<\s*(?:img|video|source)\b[^>]*\ssrc\s*=\s*[\"']?([^\"'\s>]+)", value, re.I):
        if not _MEDIA_SRC.match(src):
            out.append("Images ou vidéos hors médiathèque retirées : utilisez le bouton « Image de la médiathèque ».")
            break
    for src in re.findall(r"<\s*iframe\b[^>]*\ssrc\s*=\s*[\"']?([^\"'\s>]+)", value, re.I):
        if not _EMBED_SRC.match(src):
            out.append("Intégrations acceptées : YouTube, Vimeo, Google Maps et OpenStreetMap (adresse « embed »).")
            break
    return out


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CtaLink(Strict):
    label: str = Field(min_length=1, max_length=80)
    href: str = Field(max_length=500)
    style: Literal["primary", "accent", "secondary", "ghost", "whatsapp"] = "primary"
    track_id: str | None = Field(default=None, max_length=60)

    @field_validator("href")
    @classmethod
    def _href(cls, v: str) -> str:
        if not _HREF_RE.match(v.strip()):
            raise ValueError("Lien invalide (chemin interne, ancre, https, mailto ou tel)")
        return v.strip()


class HeroSlide(Strict):
    title: str = Field(max_length=160)
    subtitle: str | None = Field(default=None, max_length=300)
    media_id: uuid.UUID
    cta: CtaLink | None = None


class HeroBlock(Strict):
    kind: Literal["hero"]
    layout: Literal["video_then_slides", "image", "split", "minimal"] = "image"
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str = Field(max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    media_id: uuid.UUID | None = None
    video_media_id: uuid.UUID | None = None
    overlay_opacity: float = Field(default=0.45, ge=0, le=1)
    slides: list[HeroSlide] = Field(default_factory=list, max_length=8)
    ctas: list[CtaLink] = Field(default_factory=list, max_length=3)
    trust_points: list[str] = Field(default_factory=list, max_length=5)


class RichTextBlock(Strict):
    kind: Literal["rich_text"]
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=160)
    media_id: uuid.UUID | None = None
    media_position: Literal["left", "right"] = "right"
    html: str = Field(max_length=100_000)

    @field_validator("html")
    @classmethod
    def _clean(cls, v: str) -> str:
        return sanitize_html(v)


class FeatureItem(Strict):
    icon: str | None = Field(default=None, max_length=60)
    title: str = Field(max_length=120)
    text: str | None = Field(default=None, max_length=600)
    media_id: uuid.UUID | None = None
    href: str | None = Field(default=None, max_length=500)

    @field_validator("href")
    @classmethod
    def _href(cls, v: str | None) -> str | None:
        if v and not _HREF_RE.match(v):
            raise ValueError("Lien invalide")
        return v


class FeaturesBlock(Strict):
    kind: Literal["features"]
    eyebrow: str | None = Field(default=None, max_length=80)
    style: Literal["cards", "bento", "minimal"] = "cards"
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    columns: Literal[2, 3, 4] = 3
    items: list[FeatureItem] = Field(min_length=1, max_length=12)


class StatItem(Strict):
    value: Decimal
    prefix: str | None = Field(default=None, max_length=10)
    suffix: str | None = Field(default=None, max_length=20)
    label: str = Field(max_length=120)


class StatsBlock(Strict):
    kind: Literal["stats"]
    eyebrow: str | None = Field(default=None, max_length=80)
    media_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=160)
    source: Literal["key_figures", "inline"] = "key_figures"
    items: list[StatItem] = Field(default_factory=list, max_length=8)


class StepItem(Strict):
    title: str = Field(max_length=120)
    text: str | None = Field(default=None, max_length=600)
    icon: str | None = Field(default=None, max_length=60)
    media_id: uuid.UUID | None = None


class StepsBlock(Strict):
    kind: Literal["steps"]
    eyebrow: str | None = Field(default=None, max_length=80)
    media_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    style: Literal["timeline", "cards", "funnel"] = "timeline"
    items: list[StepItem] = Field(min_length=1, max_length=10)


class CtaBlock(Strict):
    kind: Literal["cta"]
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str = Field(max_length=160)
    text: str | None = Field(default=None, max_length=500)
    ctas: list[CtaLink] = Field(min_length=1, max_length=3)
    media_id: uuid.UUID | None = None
    theme: Literal["primary", "accent", "dark", "light"] = "primary"


class MediaBlock(Strict):
    kind: Literal["media"]
    media_id: uuid.UUID
    caption: str | None = Field(default=None, max_length=300)
    layout: Literal["full", "contained"] = "contained"


class GalleryBlock(Strict):
    kind: Literal["gallery"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    title: str | None = Field(default=None, max_length=160)
    media_ids: list[uuid.UUID] = Field(min_length=1, max_length=40)
    layout: Literal["grid", "masonry", "carousel"] = "grid"


class VideoBlock(Strict):
    kind: Literal["video"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    title: str | None = Field(default=None, max_length=160)
    media_id: uuid.UUID
    caption: str | None = Field(default=None, max_length=300)
    autoplay: bool = False


class SelectionBlock(Strict):
    kind: Literal["testimonials", "projects"]
    eyebrow: str | None = Field(default=None, max_length=80)
    layout: Literal["grid", "carousel"] = "grid"
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    mode: Literal["featured", "universe", "ids", "latest"] = "featured"
    universe: str | None = Field(default=None, max_length=20)
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=24)
    limit: int = Field(default=6, ge=1, le=24)


class UniversesBlock(Strict):
    kind: Literal["universes"]
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    keys: list[str] = Field(default_factory=list, max_length=10)


class OffersBlock(Strict):
    kind: Literal["offers"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    title: str | None = Field(default=None, max_length=160)
    universe: str | None = Field(default=None, max_length=20)
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=24)


class CatalogBlock(Strict):
    kind: Literal["expertises", "services", "team", "partners", "certifications", "videos", "blog", "faq"]
    eyebrow: str | None = Field(default=None, max_length=80)
    media_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)
    category: str | None = Field(default=None, max_length=120)
    universe: str | None = Field(default=None, max_length=20)
    family: str | None = Field(default=None, max_length=20)
    limit: int = Field(default=6, ge=1, le=30)


class ComparisonRow(Strict):
    label: str = Field(max_length=160)
    values: list[str] = Field(max_length=5)


class ComparisonBlock(Strict):
    kind: Literal["comparison"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    highlight_column: int | None = Field(default=None, ge=0, le=4)
    title: str | None = Field(default=None, max_length=160)
    columns: list[str] = Field(min_length=1, max_length=5)
    rows: list[ComparisonRow] = Field(min_length=1, max_length=20)


class TrustBlock(Strict):
    kind: Literal["trust"]
    eyebrow: str | None = Field(default=None, max_length=80)
    media_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=160)
    subtitle: str | None = Field(default=None, max_length=400)
    items: list[FeatureItem] = Field(min_length=1, max_length=8)


class MapBlock(Strict):
    kind: Literal["map"]
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=160)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    zoom: int = Field(default=14, ge=1, le=20)
    address: str | None = Field(default=None, max_length=300)


class FormBlock(Strict):
    kind: Literal["form"]
    eyebrow: str | None = Field(default=None, max_length=80)
    media_id: uuid.UUID | None = None
    form_key: str = Field(max_length=60)
    title: str | None = Field(default=None, max_length=160)
    text: str | None = Field(default=None, max_length=500)


class Model3DBlock(Strict):
    kind: Literal["model3d"]
    eyebrow: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, max_length=160)
    media_id: uuid.UUID
    caption: str | None = Field(default=None, max_length=300)


class QuoteBlock(Strict):
    kind: Literal["quote"]
    media_id: uuid.UUID | None = None
    background_media_id: uuid.UUID | None = None
    text: str = Field(max_length=600)
    author: str | None = Field(default=None, max_length=120)
    role: str | None = Field(default=None, max_length=120)


class BeforeAfterItem(Strict):
    before_media_id: uuid.UUID
    after_media_id: uuid.UUID
    caption: str | None = Field(default=None, max_length=200)


class BeforeAfterBlock(Strict):
    kind: Literal["before_after"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    title: str | None = Field(default=None, max_length=160)
    items: list[BeforeAfterItem] = Field(min_length=1, max_length=12)


class ContactInfoBlock(Strict):
    kind: Literal["contact_info"]
    eyebrow: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    media_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=160)


Block = Annotated[
    HeroBlock
    | RichTextBlock
    | FeaturesBlock
    | StatsBlock
    | StepsBlock
    | CtaBlock
    | MediaBlock
    | GalleryBlock
    | VideoBlock
    | SelectionBlock
    | UniversesBlock
    | OffersBlock
    | CatalogBlock
    | ComparisonBlock
    | TrustBlock
    | MapBlock
    | FormBlock
    | Model3DBlock
    | QuoteBlock
    | BeforeAfterBlock
    | ContactInfoBlock,
    Field(discriminator="kind"),
]
BLOCK_KINDS = sorted(
    {
        "hero",
        "rich_text",
        "features",
        "stats",
        "steps",
        "cta",
        "media",
        "gallery",
        "video",
        "testimonials",
        "projects",
        "universes",
        "offers",
        "expertises",
        "services",
        "team",
        "partners",
        "certifications",
        "videos",
        "blog",
        "faq",
        "comparison",
        "trust",
        "map",
        "form",
        "model3d",
        "quote",
        "before_after",
        "contact_info",
    }
)


class BlockIn(Strict):
    id: uuid.UUID | None = None
    visible: bool = True
    data: Block


class SectionIn(Strict):
    id: uuid.UUID | None = None
    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    title: str | None = Field(default=None, max_length=250)
    visible: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)
    blocks: list[BlockIn] = Field(default_factory=list, max_length=30)

    @field_validator("settings")
    @classmethod
    def _settings(cls, v: dict[str, Any]) -> dict[str, Any]:
        allowed = {"background", "anchor", "width", "theme", "padding", "media_id"}
        unknown = set(v) - allowed
        if unknown:
            raise ValueError(f"Réglages inconnus : {', '.join(sorted(unknown))}")
        return v


class SeoIn(Strict):
    title: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=320)
    slug: str | None = Field(default=None, max_length=160)
    canonical_url: str | None = Field(default=None, max_length=500)
    robots_index: bool = True
    robots_follow: bool = True
    og_title: str | None = Field(default=None, max_length=160)
    og_description: str | None = Field(default=None, max_length=320)
    og_image_media_id: uuid.UUID | None = None
    twitter_card: Literal["summary", "summary_large_image"] = "summary_large_image"
    twitter_image_media_id: uuid.UUID | None = None
    h1: str | None = Field(default=None, max_length=250)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    sitemap_priority: Decimal = Field(default=Decimal("0.5"), ge=0, le=1)
    sitemap_changefreq: Literal["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"] = "weekly"

    @field_validator("canonical_url")
    @classmethod
    def _canonical(cls, v: str | None) -> str | None:
        if v and not (v.startswith("https://") or v.startswith("/")):
            raise ValueError("URL canonique absolue (https) ou chemin interne attendu")
        return v


class PageIn(Strict):
    route_key: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    path: str = Field(min_length=1, max_length=250)
    title: str = Field(min_length=1, max_length=250)
    template: Literal["default", "landing", "legal", "listing"] = "default"
    summary: str | None = Field(default=None, max_length=1000)
    body: str | None = Field(default=None, max_length=200_000)
    sort_order: int = 0
    publish_at: datetime | None = None
    unpublish_at: datetime | None = None
    sections: list[SectionIn] = Field(default_factory=list, max_length=40)
    seo: SeoIn | None = None

    @field_validator("path")
    @classmethod
    def _path(cls, v: str) -> str:
        if not v.startswith("/") or "//" in v or v.startswith("/api") or v.startswith("/uploads"):
            raise ValueError("Chemin de page invalide")
        return v.rstrip("/") or "/"

    @field_validator("body")
    @classmethod
    def _body(cls, v: str | None) -> str | None:
        return sanitize_html(v) if v else v


class TransitionIn(Strict):
    target: Literal["draft", "in_review", "validated", "published", "archived"]
    note: str | None = Field(default=None, max_length=1000)
    publish_at: datetime | None = None
    unpublish_at: datetime | None = None


class NavItemIn(Strict):
    # Identifiant renvoyé par la lecture du menu : accepté puis ignoré (le menu est réécrit à chaque publication).
    id: uuid.UUID | None = None
    label: str = Field(min_length=1, max_length=120)
    link_type: Literal["page", "path", "url", "anchor"] = "page"
    page_route_key: str | None = Field(default=None, max_length=80)
    url: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=250)
    icon: str | None = Field(default=None, max_length=60)
    open_new_tab: bool = False
    highlight: bool = False
    visible: bool = True
    children: list[NavItemIn] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _target(self) -> NavItemIn:
        if self.link_type == "page" and not self.page_route_key:
            raise ValueError(f"choisissez la page vers laquelle pointe « {self.label} »")
        if self.link_type != "page" and (not self.url or not _HREF_RE.match(self.url)):
            raise ValueError(
                f"lien « {self.label} » : indiquez un chemin commençant par « / », une ancre « # » "
                "ou une adresse « https:// » (ou mailto: / tel:)"
            )
        return self


class NavigationIn(Strict):
    title: str = Field(min_length=1, max_length=150)
    items: list[NavItemIn] = Field(default_factory=list, max_length=40)


class MediaUpdate(Strict):
    title: str | None = Field(default=None, max_length=250)
    alt_text: str | None = Field(default=None, max_length=300)
    caption: str | None = Field(default=None, max_length=2000)
    credits: str | None = Field(default=None, max_length=250)
    folder: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = None
    focal_x: float | None = Field(default=None, ge=0, le=1)
    focal_y: float | None = Field(default=None, ge=0, le=1)
    poster_media_id: uuid.UUID | None = None


class ExternalVideoIn(Strict):
    url: str = Field(max_length=500)
    title: str = Field(max_length=250)
    alt_text: str | None = Field(default=None, max_length=300)
    caption: str | None = Field(default=None, max_length=2000)
    folder: str = "videos"
    tags: list[str] = Field(default_factory=list)
    poster_media_id: uuid.UUID | None = None


class CommentIn(Strict):
    author_name: str = Field(min_length=2, max_length=120)
    author_email: str | None = Field(default=None, max_length=254)
    content: str = Field(min_length=3, max_length=3000)
    parent_id: uuid.UUID | None = None
    website: str | None = Field(default=None, max_length=200)  # pot de miel anti-bot
    rendered_at: int | None = None  # horodatage d'affichage du formulaire (anti-bot)


class ShareIn(Strict):
    network: Literal["facebook", "linkedin", "whatsapp", "x", "email", "copy", "telegram"]


class FeedbackIn(Strict):
    helpful: bool
