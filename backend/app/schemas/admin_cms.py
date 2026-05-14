"""Admin CMS input schemas for CRUD operations."""
from pydantic import BaseModel
from typing import Optional, List, Any


class FormResponse(BaseModel):
    success: bool
    message: str
    id: Optional[str] = None


# ── Blog ─────────────────────────────────────────────────────
class BlogPostIn(BaseModel):
    title: str
    slug: Optional[str] = ""
    category: str = ""
    date: str = ""
    read_time: str = ""
    author: str = ""
    excerpt: str = ""
    image: str = ""
    featured: bool = False
    html_content: Optional[str] = ""
    status: str = "draft"


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    read_time: Optional[str] = None
    author: Optional[str] = None
    excerpt: Optional[str] = None
    image: Optional[str] = None
    featured: Optional[bool] = None
    html_content: Optional[str] = None
    status: Optional[str] = None


# ── Projects ─────────────────────────────────────────────────
class ProjectIn(BaseModel):
    title: str
    slug: Optional[str] = ""
    category: str = ""
    status: str = ""
    location: str = ""
    client_name: str = ""
    area: str = ""
    duration: str = ""
    architect: str = ""
    description: str = ""
    images: List[str] = []
    challenge: str = ""
    solution: str = ""
    video_url: str = ""
    progression: List[Any] = []
    progress: int = 0
    featured: bool = False
    is_published: bool = True
    is_ongoing: bool = False
    ongoing_description: str = ""
    sort_order: int = 0


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    client_name: Optional[str] = None
    area: Optional[str] = None
    duration: Optional[str] = None
    architect: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    challenge: Optional[str] = None
    solution: Optional[str] = None
    video_url: Optional[str] = None
    progression: Optional[List[Any]] = None
    progress: Optional[int] = None
    featured: Optional[bool] = None
    is_published: Optional[bool] = None
    is_ongoing: Optional[bool] = None
    ongoing_description: Optional[str] = None
    sort_order: Optional[int] = None


# ── Services ─────────────────────────────────────────────────
class ServiceIn(BaseModel):
    title: str
    slug: Optional[str] = ""
    subtitle: str = ""
    desc: str = ""
    icon_key: str = ""
    image: str = ""
    images: List[str] = []
    details: str = ""
    benefits: List[str] = []
    related_category: str = ""
    process_steps: List[Any] = []
    faq: List[Any] = []
    is_published: bool = True
    sort_order: int = 0


class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    subtitle: Optional[str] = None
    desc: Optional[str] = None
    icon_key: Optional[str] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    details: Optional[str] = None
    benefits: Optional[List[str]] = None
    related_category: Optional[str] = None
    process_steps: Optional[List[Any]] = None
    faq: Optional[List[Any]] = None
    is_published: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Team ─────────────────────────────────────────────────────
class TeamMemberIn(BaseModel):
    name: str
    role: str = ""
    quote: str = ""
    image_class: str = ""
    photo: str = ""
    sort_order: int = 0


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    quote: Optional[str] = None
    image_class: Optional[str] = None
    photo: Optional[str] = None
    sort_order: Optional[int] = None


# ── Testimonials ─────────────────────────────────────────────
class TestimonialIn(BaseModel):
    name: str
    project: str = ""
    text: str = ""
    rating: int = 5
    photo: str = ""
    is_published: bool = True
    sort_order: int = 0


class TestimonialUpdate(BaseModel):
    name: Optional[str] = None
    project: Optional[str] = None
    text: Optional[str] = None
    rating: Optional[int] = None
    photo: Optional[str] = None
    is_published: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Partners ─────────────────────────────────────────────────
class PartnerIn(BaseModel):
    name: str
    logo: str = ""
    sort_order: int = 0


# ── FAQ ──────────────────────────────────────────────────────
class FaqCategoryIn(BaseModel):
    name: str
    sort_order: int = 0


class FaqItemIn(BaseModel):
    category_id: str
    question: str
    answer: str
    sort_order: int = 0


# ── Hero Slides ──────────────────────────────────────────────
class HeroSlideIn(BaseModel):
    tag: str = ""
    title: str
    subtitle: str = ""
    image: str = ""
    cta1_text: str = ""
    cta1_href: str = ""
    cta2_text: str = ""
    cta2_href: str = ""
    is_active: bool = True
    sort_order: int = 0


# ── Engagements ──────────────────────────────────────────────
class EngagementIn(BaseModel):
    icon_key: str = ""
    title: str
    desc: str = ""
    bg_color: str = ""
    text_color: str = ""
    sort_order: int = 0


# ── Methodology Steps ───────────────────────────────────────
class MethodologyStepIn(BaseModel):
    icon_key: str = ""
    title: str
    desc: str = ""
    image: str = ""
    sort_order: int = 0


# ── Stats ────────────────────────────────────────────────────
class StatIn(BaseModel):
    value: int
    suffix: str = ""
    label: str = ""
    sort_order: int = 0


# ── Guarantees ───────────────────────────────────────────────
class GuaranteeIn(BaseModel):
    icon_key: str = ""
    title: str
    desc: str = ""
    sort_order: int = 0


# ── Settings ─────────────────────────────────────────────────
class SiteSettingsIn(BaseModel):
    company_name: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    whatsapp_url: Optional[str] = None
    social_links: Optional[Any] = None
    footer_description: Optional[str] = None
    nav_links: Optional[List[Any]] = None
    footer_quick_links: Optional[List[Any]] = None
    footer_service_links: Optional[List[Any]] = None
    top_bar_text: Optional[str] = None
    hero_video_src: Optional[str] = None
    hero_video_poster: Optional[str] = None
    cta_title: Optional[str] = None
    cta_subtitle: Optional[str] = None
    cta_text: Optional[str] = None
    cta_href: Optional[str] = None
    video_section_title: Optional[str] = None
    video_section_subtitle: Optional[str] = None
    video_section_youtube_url: Optional[str] = None
    video_section_bg_video_src: Optional[str] = None
    video_section_bg_video_poster: Optional[str] = None
    contact_address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    contact_map_embed_url: Optional[str] = None
    contact_hours: Optional[str] = None
    # SEO & Tracking
    seo_pages: Optional[List[Any]] = None
    schema_org: Optional[Any] = None
    tracking: Optional[Any] = None
    sitemap_config: Optional[Any] = None


# ── About Content ────────────────────────────────────────────
class AboutContentIn(BaseModel):
    section_tag: Optional[str] = None
    title: Optional[str] = None
    paragraphs: Optional[List[str]] = None
    highlights: Optional[List[str]] = None
    cta_text: Optional[str] = None
    cta_href: Optional[str] = None
    images: Optional[List[str]] = None
    video_src: Optional[str] = None
    video_poster: Optional[str] = None
    badge_value: Optional[str] = None
    badge_label: Optional[str] = None
    hero_image: Optional[str] = None
    hero_title: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None
    values: Optional[List[Any]] = None
    timeline: Optional[List[Any]] = None
    certifications: Optional[List[str]] = None


# ── Legal Pages ──────────────────────────────────────────────
class LegalPageIn(BaseModel):
    title: Optional[str] = None
    last_updated: Optional[str] = None
    sections: Optional[List[Any]] = None

# ── Analytics ────────────────────────────────────────────────
class AnalyticsStatsOut(BaseModel):
    total_views_month: int
    devices: dict
    browsers: dict
    paths: dict
    countries: dict
    logs: List[Any]
