"""CMS headless & médiathèque (§5) : Page, Section, Block, Navigation, Media, Redirect, SeoMetadata,
SchemaMarkup, SocialLink, FormDefinition, AutoReplyTemplate + collections éditoriales (univers, offres,
expertises, services, projets, blog, FAQ, aide, témoignages, équipe, partenaires, certifications, chiffres,
vidéos, bannières/popups).

Règle « Zero Hardcode » : tout contenu éditorial public provient de ces tables ; une base vide produit un
état vide explicite. Tout média utilisé est référencé par `media_id` (aucun chemin libre).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Float,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    bigint_col,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    str_col,
    text_col,
)
from app.core.database import (
    SoftDelete as SoftDeleteMixin,
)
from app.core.security import EncryptedString
from app.core.utils import utcnow

PUBLICATION_STATUSES = ("draft", "in_review", "validated", "published", "archived")


class Publishable:
    """Cycle : brouillon → revue → validation → publication → dépublication planifiée → archivage (§5.2)."""

    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    publish_at: Mapped[datetime | None] = dt_col()
    unpublish_at: Mapped[datetime | None] = dt_col()
    published_at: Mapped[datetime | None] = dt_col()
    archived_at: Mapped[datetime | None] = dt_col()
    sort_order: Mapped[int] = int_col(0)
    revision: Mapped[int] = int_col(1)

    @declared_attr
    def created_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return fk("users.id", index=False)

    @declared_attr
    def updated_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return fk("users.id", index=False)

    @declared_attr
    def reviewed_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return fk("users.id", index=False)

    @declared_attr
    def approved_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return fk("users.id", index=False)


# ============================================================================ Médiathèque
class MediaAsset(UUIDPk, Timestamps, SoftDeleteMixin, Base):
    """Média CMS : media_id, checksum, taille, MIME, dimensions, auteur, date, statut, historique (§5.1)."""

    __tablename__ = "media_assets"

    kind: Mapped[str] = str_col(20, nullable=False, index=True)  # image / video / document / external_video / svg
    title: Mapped[str] = str_col(250, nullable=False)
    alt_text: Mapped[str | None] = str_col(300)
    caption: Mapped[str | None] = text_col()
    credits: Mapped[str | None] = str_col(250)
    original_name: Mapped[str | None] = str_col(300)
    storage_key: Mapped[str | None] = str_col(500)  # volume public local
    mime_type: Mapped[str | None] = str_col(150)
    size_bytes: Mapped[int] = bigint_col(0)
    checksum_sha256: Mapped[str | None] = str_col(64, index=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    focal_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    focal_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    variants: Mapped[dict[str, Any]] = json_col(dict)  # {"thumb": {"key", "width", "height", "mime", "size"}}
    poster_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    external_provider: Mapped[str | None] = str_col(20)  # youtube / vimeo
    external_id: Mapped[str | None] = str_col(120)
    external_url: Mapped[str | None] = str_col(500)
    folder: Mapped[str] = str_col(120, nullable=False, default="general")
    tags: Mapped[list[Any]] = json_col(list)
    status: Mapped[str] = str_col(20, nullable=False, default="active", index=True)  # active / archived
    usage_count: Mapped[int] = int_col(0)
    last_usage_scan_at: Mapped[datetime | None] = dt_col()
    author_id: Mapped[uuid.UUID | None] = fk("users.id")


class MediaRevision(UUIDPk, Base):
    __tablename__ = "media_revisions"

    media_id: Mapped[uuid.UUID] = fk("media_assets.id", nullable=False, ondelete="CASCADE")
    action: Mapped[str] = str_col(20, nullable=False)  # upload / replace / update / archive / restore / delete
    changes: Mapped[dict[str, Any]] = json_col(dict)
    previous_checksum: Mapped[str | None] = str_col(64)
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


# ============================================================================ Pages
class CmsPage(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_pages"

    route_key: Mapped[str] = str_col(80, nullable=False, unique=True)  # home / about / offers / contact / legal-notice…
    path: Mapped[str] = str_col(250, nullable=False, unique=True)
    title: Mapped[str] = str_col(250, nullable=False)
    template: Mapped[str] = str_col(30, nullable=False, default="default")  # default / landing / legal / listing
    summary: Mapped[str | None] = text_col()
    body: Mapped[str | None] = mapped_column(Text, nullable=True)  # HTML assaini (pages légales)
    sections: Mapped[list[CmsSection]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="CmsSection.sort_order"
    )


class CmsSection(UUIDPk, Base):
    __tablename__ = "cms_sections"

    page_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cms_pages.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = str_col(80, nullable=False)
    title: Mapped[str | None] = str_col(250)
    sort_order: Mapped[int] = int_col(0)
    settings: Mapped[dict[str, Any]] = json_col(dict)  # fond, ancre, largeur, thème
    visible: Mapped[bool] = bool_col(True)

    blocks: Mapped[list[CmsBlock]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="CmsBlock.sort_order"
    )


class CmsBlock(UUIDPk, Base):
    __tablename__ = "cms_blocks"

    section_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("cms_sections.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = str_col(40, nullable=False)
    sort_order: Mapped[int] = int_col(0)
    data: Mapped[dict[str, Any]] = json_col(dict)
    visible: Mapped[bool] = bool_col(True)


class CmsRevision(UUIDPk, Base):
    """Historique versionné de tout contenu CMS (page ou élément de collection)."""

    __tablename__ = "cms_revisions"
    __table_args__ = (Index("ix_cms_revisions_entity", "entity_type", "entity_id", "number"),)

    entity_type: Mapped[str] = str_col(40, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    number: Mapped[int] = int_col(1)
    status: Mapped[str] = str_col(20, nullable=False)
    snapshot: Mapped[dict[str, Any]] = json_col(dict)
    note: Mapped[str | None] = text_col()
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class SeoMetadata(UUIDPk, Timestamps, Base):
    """Métadonnées SEO par page / route / élément de collection (§4.2)."""

    __tablename__ = "seo_metadata"
    __table_args__ = (UniqueConstraint("target_type", "target_key"),)

    target_type: Mapped[str] = str_col(
        40, nullable=False
    )  # page / universe / offer / service / expertise / project / blog_post / blog_category / help_article
    target_key: Mapped[str] = str_col(120, nullable=False)
    title: Mapped[str | None] = str_col(160)
    description: Mapped[str | None] = str_col(320)
    slug: Mapped[str | None] = str_col(160)
    canonical_url: Mapped[str | None] = str_col(500)
    robots_index: Mapped[bool] = bool_col(True)
    robots_follow: Mapped[bool] = bool_col(True)
    og_title: Mapped[str | None] = str_col(160)
    og_description: Mapped[str | None] = str_col(320)
    og_image_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    twitter_card: Mapped[str] = str_col(30, nullable=False, default="summary_large_image")
    twitter_image_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    h1: Mapped[str | None] = str_col(250)
    keywords: Mapped[list[Any]] = json_col(list)
    sitemap_priority: Mapped[Decimal] = mapped_column(Numeric(2, 1), nullable=False, default=Decimal("0.5"))
    sitemap_changefreq: Mapped[str] = str_col(10, nullable=False, default="weekly")


class SchemaMarkup(UUIDPk, Timestamps, Base):
    __tablename__ = "schema_markups"

    target_type: Mapped[str] = str_col(40, nullable=False)
    target_key: Mapped[str] = str_col(120, nullable=False, index=True)
    schema_type: Mapped[str] = str_col(
        60, nullable=False
    )  # Organization / LocalBusiness / WebSite / WebPage / BreadcrumbList / Service / Article / FAQPage
    data: Mapped[dict[str, Any]] = json_col(dict)
    enabled: Mapped[bool] = bool_col(True)


class NavigationMenu(UUIDPk, Timestamps, Base):
    __tablename__ = "navigation_menus"

    key: Mapped[str] = str_col(
        40, nullable=False, unique=True
    )  # header / footer_main / footer_services / footer_legal / mobile / cta
    title: Mapped[str] = str_col(150, nullable=False)

    items: Mapped[list[NavigationItem]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="NavigationItem.sort_order"
    )


class NavigationItem(UUIDPk, Base):
    __tablename__ = "navigation_items"

    menu_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("navigation_menus.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[uuid.UUID | None] = fk("navigation_items.id", ondelete="CASCADE")
    label: Mapped[str] = str_col(120, nullable=False)
    link_type: Mapped[str] = str_col(20, nullable=False, default="page")  # page / path / url / anchor
    page_route_key: Mapped[str | None] = str_col(80)
    url: Mapped[str | None] = str_col(500)
    description: Mapped[str | None] = str_col(250)
    icon: Mapped[str | None] = str_col(60)
    sort_order: Mapped[int] = int_col(0)
    open_new_tab: Mapped[bool] = bool_col(False)
    highlight: Mapped[bool] = bool_col(False)  # style CTA
    visible: Mapped[bool] = bool_col(True)


class Redirect(UUIDPk, Timestamps, Base):
    """Redirections 301/302/410 et historique."""

    __tablename__ = "redirects"

    source_path: Mapped[str] = str_col(500, nullable=False, unique=True)
    target_path: Mapped[str | None] = str_col(500)
    status_code: Mapped[int] = int_col(301)
    is_active: Mapped[bool] = bool_col(True)
    hits: Mapped[int] = bigint_col(0)
    last_hit_at: Mapped[datetime | None] = dt_col()
    note: Mapped[str | None] = str_col(300)
    auto_generated: Mapped[bool] = bool_col(False)  # créée automatiquement lors d'un changement de slug
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SocialLink(UUIDPk, Timestamps, Base):
    __tablename__ = "social_links"

    network: Mapped[str] = str_col(
        30, nullable=False
    )  # facebook / instagram / linkedin / tiktok / youtube / x / whatsapp
    url: Mapped[str] = str_col(500, nullable=False)
    label: Mapped[str | None] = str_col(120)
    sort_order: Mapped[int] = int_col(0)
    is_active: Mapped[bool] = bool_col(True)


class FormDefinition(UUIDPk, Timestamps, Base):
    __tablename__ = "form_definitions"

    key: Mapped[str] = str_col(
        60, nullable=False, unique=True
    )  # contact / describe_project / newsletter / estimator / callback
    title: Mapped[str] = str_col(200, nullable=False)
    description: Mapped[str | None] = text_col()
    fields: Mapped[list[Any]] = json_col(list)
    consents: Mapped[list[Any]] = json_col(list)  # [{"key": "contact", "label": "...", "required": true}]
    destination: Mapped[str] = str_col(20, nullable=False, default="crm_lead")  # crm_lead / newsletter / ticket / none
    auto_reply_code: Mapped[str | None] = str_col(100)
    success_message: Mapped[str | None] = text_col()
    notify_roles: Mapped[list[Any]] = json_col(lambda: ["COMMERCIAL"])
    min_fill_seconds: Mapped[int] = int_col(3)  # anti-bot
    is_active: Mapped[bool] = bool_col(True)


class FormSubmission(UUIDPk, Base):
    __tablename__ = "form_submissions"

    form_key: Mapped[str] = str_col(60, nullable=False, index=True)
    data: Mapped[dict[str, Any]] = json_col(dict)
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    status: Mapped[str] = str_col(20, nullable=False, default="accepted")  # accepted / spam / rejected
    consent_record_id: Mapped[uuid.UUID | None] = fk("consent_records.id")
    ip_hash: Mapped[str | None] = str_col(64)
    user_agent: Mapped[str | None] = str_col(400)
    utm: Mapped[dict[str, Any]] = json_col(dict)
    analytics_session_id: Mapped[str | None] = str_col(64)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), index=True)


class AutoReplyTemplate(UUIDPk, Timestamps, Base):
    __tablename__ = "auto_reply_templates"
    __table_args__ = (UniqueConstraint("code", "channel"),)

    code: Mapped[str] = str_col(100, nullable=False)
    channel: Mapped[str] = str_col(20, nullable=False, default="email")  # email / whatsapp
    subject: Mapped[str | None] = str_col(250)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    whatsapp_template: Mapped[str | None] = str_col(120)
    version: Mapped[int] = int_col(1)
    is_active: Mapped[bool] = bool_col(True)


class SiteSettings(UUIDPk, Timestamps, Base):
    """Identité et coordonnées de l'entreprise (une seule ligne), identifiants de suivi, consentement."""

    __tablename__ = "cms_site_settings"

    company_name: Mapped[str] = str_col(200, nullable=False, default="GLOBUS ENGINEERING")
    slogan: Mapped[str | None] = str_col(250)
    promise: Mapped[str | None] = text_col()
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    address: Mapped[str | None] = text_col()
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    opening_hours: Mapped[list[Any]] = json_col(list)
    legal_info: Mapped[dict[str, Any]] = json_col(dict)  # RCCM, NIU, capital, forme juridique
    logo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    logo_dark_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    favicon_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    default_og_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    seo_title_template: Mapped[str] = str_col(160, nullable=False, default="%s | GLOBUS ENGINEERING")
    default_meta_description: Mapped[str | None] = str_col(320)
    tracking: Mapped[dict[str, Any]] = json_col(
        dict
    )  # ga4_id, gads_id, gads_labels, meta_pixel, tiktok_pixel, linkedin_partner
    search_console_verification: Mapped[str | None] = str_col(200)
    google_business_url: Mapped[str | None] = str_col(500)
    consent_texts: Mapped[dict[str, Any]] = json_col(dict)
    consent_policy_version: Mapped[str] = str_col(20, nullable=False, default="1")
    robots_extra: Mapped[str | None] = text_col()
    maintenance_message: Mapped[str | None] = text_col()


class Banner(UUIDPk, Timestamps, Publishable, Base):
    """Bannières et popups."""

    __tablename__ = "cms_banners"

    key: Mapped[str] = str_col(60, nullable=False, unique=True)
    kind: Mapped[str] = str_col(10, nullable=False, default="banner")  # banner / popup
    title: Mapped[str] = str_col(200, nullable=False)
    content: Mapped[str | None] = text_col()
    cta_label: Mapped[str | None] = str_col(80)
    cta_href: Mapped[str | None] = str_col(500)
    media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    route_keys: Mapped[list[Any]] = json_col(list)  # vide = toutes les pages
    position: Mapped[str] = str_col(20, nullable=False, default="top")
    frequency: Mapped[str] = str_col(10, nullable=False, default="session")  # once / session / always
    delay_seconds: Mapped[int] = int_col(0)
    dismissible: Mapped[bool] = bool_col(True)


# ============================================================================ Collections
class Universe(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_universes"

    key: Mapped[str] = str_col(20, nullable=False, unique=True)  # HOME / BUSINESS / PREMIUM / DIASPORA / ENGINEERING
    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    tagline: Mapped[str | None] = str_col(250)
    promise: Mapped[str | None] = text_col()
    target: Mapped[str | None] = str_col(250)
    mechanism: Mapped[str | None] = str_col(150)  # ex. « Projection + Réassurance »
    prospect_wants: Mapped[str | None] = text_col()
    description: Mapped[str | None] = text_col()
    funnel: Mapped[list[Any]] = json_col(list)  # parcours visuel (Terrain → conception → 3D…)
    hero_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    icon: Mapped[str | None] = str_col(60)
    accent: Mapped[str | None] = str_col(20)
    body_blocks: Mapped[list[Any]] = json_col(list)


class Offer(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_offers"

    universe_id: Mapped[uuid.UUID] = fk("cms_universes.id", nullable=False, ondelete="CASCADE")
    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    summary: Mapped[str | None] = text_col()
    description: Mapped[str | None] = text_col()
    deliverables: Mapped[list[Any]] = json_col(list)
    steps: Mapped[list[Any]] = json_col(list)
    ideal_for: Mapped[str | None] = text_col()
    price_hint: Mapped[str | None] = str_col(150)
    duration_hint: Mapped[str | None] = str_col(150)
    media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    icon: Mapped[str | None] = str_col(60)
    cta_label: Mapped[str | None] = str_col(80)
    body_blocks: Mapped[list[Any]] = json_col(list)


class Expertise(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_expertises"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    summary: Mapped[str | None] = text_col()
    description: Mapped[str | None] = text_col()
    discipline: Mapped[str | None] = str_col(40)
    icon: Mapped[str | None] = str_col(60)
    media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    body_blocks: Mapped[list[Any]] = json_col(list)


class Service(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_services"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    category: Mapped[str | None] = str_col(
        60, index=True
    )  # architecture / etudes / ingenierie / construction / renovation / management
    summary: Mapped[str | None] = text_col()
    deliverables: Mapped[list[Any]] = json_col(list)
    icon: Mapped[str | None] = str_col(60)
    media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    related_offer_ids: Mapped[list[Any]] = json_col(list)
    faq_item_ids: Mapped[list[Any]] = json_col(list)
    body_blocks: Mapped[list[Any]] = json_col(list)


class PortfolioProject(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_portfolio_projects"

    slug: Mapped[str] = str_col(160, nullable=False, unique=True)
    title: Mapped[str] = str_col(250, nullable=False)
    universe: Mapped[str | None] = str_col(20, index=True)
    category: Mapped[str | None] = str_col(60, index=True)
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    surface_m2: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    duration_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget_range: Mapped[str | None] = str_col(120)
    client_type: Mapped[str | None] = str_col(80)
    delivery_status: Mapped[str] = str_col(20, nullable=False, default="delivered")  # delivered / in_progress
    summary: Mapped[str | None] = text_col()
    challenge: Mapped[str | None] = text_col()
    solution: Mapped[str | None] = text_col()
    results: Mapped[list[Any]] = json_col(list)  # [{"label", "value"}]
    cover_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    gallery_media_ids: Mapped[list[Any]] = json_col(list)
    before_after: Mapped[list[Any]] = json_col(list)  # [{"before_media_id", "after_media_id", "caption"}]
    video_media_ids: Mapped[list[Any]] = json_col(list)
    model_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)  # GLB pour visite 3D
    testimonial_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    featured: Mapped[bool] = bool_col(False)
    erp_project_id: Mapped[uuid.UUID | None] = fk("projects.id", index=False)
    body_blocks: Mapped[list[Any]] = json_col(list)


class BlogCategory(UUIDPk, Timestamps, Base):
    __tablename__ = "cms_blog_categories"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    description: Mapped[str | None] = text_col()
    sort_order: Mapped[int] = int_col(0)


class BlogAuthor(UUIDPk, Timestamps, Base):
    __tablename__ = "cms_blog_authors"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    title: Mapped[str | None] = str_col(150)
    bio: Mapped[str | None] = text_col()
    photo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    linkedin_url: Mapped[str | None] = str_col(300)
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class BlogPost(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_blog_posts"

    slug: Mapped[str] = str_col(180, nullable=False, unique=True)
    title: Mapped[str] = str_col(250, nullable=False)
    excerpt: Mapped[str | None] = text_col()
    body_blocks: Mapped[list[Any]] = json_col(list)
    cover_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    category_id: Mapped[uuid.UUID | None] = fk("cms_blog_categories.id")
    author_id: Mapped[uuid.UUID | None] = fk("cms_blog_authors.id")
    tags: Mapped[list[Any]] = json_col(list)
    content_family: Mapped[str | None] = str_col(20)  # PROJECTION / EXPERTISE / PREUVE / REASSURANCE / TRANSPARENCE
    universe: Mapped[str | None] = str_col(20)
    reading_minutes: Mapped[int] = int_col(3)
    featured: Mapped[bool] = bool_col(False)
    allow_comments: Mapped[bool] = bool_col(True)
    view_count: Mapped[int] = bigint_col(0)
    like_count: Mapped[int] = int_col(0)
    share_count: Mapped[int] = int_col(0)
    comment_count: Mapped[int] = int_col(0)


class BlogComment(UUIDPk, Base):
    __tablename__ = "cms_blog_comments"
    __table_args__ = (Index("ix_blog_comments_post_status", "post_id", "status"),)

    post_id: Mapped[uuid.UUID] = fk("cms_blog_posts.id", nullable=False, ondelete="CASCADE", index=False)
    parent_id: Mapped[uuid.UUID | None] = fk("cms_blog_comments.id", ondelete="CASCADE")
    author_name: Mapped[str] = str_col(120, nullable=False)
    author_email: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / approved / rejected / spam
    is_staff: Mapped[bool] = bool_col(False)
    staff_user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    like_count: Mapped[int] = int_col(0)
    ip_hash: Mapped[str | None] = str_col(64)
    moderated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    moderated_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class BlogReaction(UUIDPk, Base):
    __tablename__ = "cms_blog_reactions"
    __table_args__ = (UniqueConstraint("post_id", "comment_id", "visitor_hash", "kind"),)

    post_id: Mapped[uuid.UUID | None] = fk("cms_blog_posts.id", ondelete="CASCADE")
    comment_id: Mapped[uuid.UUID | None] = fk("cms_blog_comments.id", ondelete="CASCADE")
    visitor_hash: Mapped[str] = str_col(64, nullable=False)
    kind: Mapped[str] = str_col(10, nullable=False, default="like")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class BlogShare(Base):
    __tablename__ = "cms_blog_shares"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    post_id: Mapped[uuid.UUID] = fk("cms_blog_posts.id", nullable=False, ondelete="CASCADE")
    network: Mapped[str] = str_col(20, nullable=False)
    visitor_hash: Mapped[str | None] = str_col(64)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class FaqCategory(UUIDPk, Timestamps, Base):
    __tablename__ = "cms_faq_categories"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    sort_order: Mapped[int] = int_col(0)


class FaqItem(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_faq_items"

    category_id: Mapped[uuid.UUID | None] = fk("cms_faq_categories.id")
    question: Mapped[str] = str_col(400, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)  # HTML assaini
    universe: Mapped[str | None] = str_col(20)
    featured: Mapped[bool] = bool_col(False)


class HelpCategory(UUIDPk, Timestamps, Base):
    __tablename__ = "cms_help_categories"

    slug: Mapped[str] = str_col(120, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    description: Mapped[str | None] = text_col()
    icon: Mapped[str | None] = str_col(60)
    sort_order: Mapped[int] = int_col(0)


class HelpArticle(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_help_articles"

    category_id: Mapped[uuid.UUID | None] = fk("cms_help_categories.id")
    slug: Mapped[str] = str_col(160, nullable=False, unique=True)
    title: Mapped[str] = str_col(250, nullable=False)
    summary: Mapped[str | None] = text_col()
    body_blocks: Mapped[list[Any]] = json_col(list)
    audience: Mapped[str] = str_col(20, nullable=False, default="public")  # public / client / partner
    keywords: Mapped[list[Any]] = json_col(list)
    helpful_yes: Mapped[int] = int_col(0)
    helpful_no: Mapped[int] = int_col(0)


class Testimonial(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_testimonials"

    author_name: Mapped[str] = str_col(150, nullable=False)
    author_role: Mapped[str | None] = str_col(150)
    location: Mapped[str | None] = str_col(150)
    universe: Mapped[str | None] = str_col(20)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    video_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    portfolio_project_id: Mapped[uuid.UUID | None] = fk("cms_portfolio_projects.id", index=False)
    consent_reference: Mapped[str | None] = str_col(250)  # preuve d'accord de publication
    featured: Mapped[bool] = bool_col(False)
    # Avis vérifié (R6) : déposé par le client d'un chantier réel via une invitation nominative
    verified: Mapped[bool] = bool_col(False)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="SET NULL")
    submitted_at: Mapped[datetime | None] = dt_col()


class TeamMember(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_team_members"

    name: Mapped[str] = str_col(150, nullable=False)
    role: Mapped[str] = str_col(150, nullable=False)
    group: Mapped[str | None] = str_col(60)
    bio: Mapped[str | None] = text_col()
    photo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    linkedin_url: Mapped[str | None] = str_col(300)


class Partner(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_partners"

    name: Mapped[str] = str_col(150, nullable=False)
    category: Mapped[str] = str_col(30, nullable=False, default="partenaire")
    logo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    url: Mapped[str | None] = str_col(300)


class Certification(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_certifications"

    name: Mapped[str] = str_col(200, nullable=False)
    issuer: Mapped[str | None] = str_col(200)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = text_col()
    logo_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)
    document_media_id: Mapped[uuid.UUID | None] = fk("media_assets.id", index=False)


class KeyFigure(UUIDPk, Timestamps, Publishable, Base):
    __tablename__ = "cms_key_figures"

    label: Mapped[str] = str_col(150, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    prefix: Mapped[str | None] = str_col(10)
    suffix: Mapped[str | None] = str_col(20)
    description: Mapped[str | None] = str_col(300)
    source_note: Mapped[str | None] = str_col(250)  # justification (pas de chiffre arbitraire)


class Video(UUIDPk, Timestamps, Publishable, Base):
    """Vidéothèque marketing (familles Projection / Expertise / Preuve / Réassurance / Transparence)."""

    __tablename__ = "cms_videos"

    title: Mapped[str] = str_col(250, nullable=False)
    family: Mapped[str] = str_col(20, nullable=False, index=True)
    universe: Mapped[str | None] = str_col(20)
    media_id: Mapped[uuid.UUID] = fk("media_assets.id", nullable=False, index=False)
    description: Mapped[str | None] = text_col()
    transcript: Mapped[str | None] = text_col()
    featured: Mapped[bool] = bool_col(False)


__all__ = [
    "PUBLICATION_STATUSES",
    "AutoReplyTemplate",
    "Banner",
    "BlogAuthor",
    "BlogCategory",
    "BlogComment",
    "BlogPost",
    "BlogReaction",
    "BlogShare",
    "Certification",
    "CmsBlock",
    "CmsPage",
    "CmsRevision",
    "CmsSection",
    "Expertise",
    "FaqCategory",
    "FaqItem",
    "FormDefinition",
    "FormSubmission",
    "HelpArticle",
    "HelpCategory",
    "KeyFigure",
    "MediaAsset",
    "MediaRevision",
    "NavigationItem",
    "NavigationMenu",
    "Offer",
    "Partner",
    "PortfolioProject",
    "Publishable",
    "Redirect",
    "SchemaMarkup",
    "SeoMetadata",
    "Service",
    "SiteSettings",
    "SocialLink",
    "TeamMember",
    "Testimonial",
    "Universe",
    "Video",
]
