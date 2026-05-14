"""
SQLAlchemy models for all CMS content tables.
Maps directly to the TypeScript types in cms.types.ts.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return str(uuid.uuid4())


# ── Site Settings (singleton) ────────────────────────────────
class CMSSiteSettings(Base):
    __tablename__ = "cms_site_settings"

    id = Column(String, primary_key=True, default=_uuid)
    company_name = Column(String, nullable=False, default="Globus Engineering SARL")
    logo = Column(String, default="/LogoGlobus.png")
    phone = Column(String, default="")
    email = Column(String, default="")
    address = Column(String, default="")
    whatsapp_url = Column(String, default="")
    social_links = Column(JSON, default=dict)       # {facebook, twitter, linkedin, instagram}
    footer_description = Column(Text, default="")
    nav_links = Column(JSON, default=list)           # [{label, href, children?}]
    footer_quick_links = Column(JSON, default=list)
    footer_service_links = Column(JSON, default=list)
    top_bar_text = Column(String, default="")

    # Hero video (single object)
    hero_video_src = Column(String, default="")
    hero_video_poster = Column(String, default="")

    # CTA Banner (single object)
    cta_title = Column(String, default="")
    cta_subtitle = Column(String, default="")
    cta_text = Column(String, default="")
    cta_href = Column(String, default="")

    # Video Section (single object)
    video_section_title = Column(String, default="")
    video_section_subtitle = Column(String, default="")
    video_section_youtube_url = Column(String, default="")
    video_section_bg_video_src = Column(String, default="")
    video_section_bg_video_poster = Column(String, default="")

    # Contact Info
    contact_address = Column(String, default="")
    contact_phone = Column(String, default="")
    contact_email = Column(String, default="")
    contact_whatsapp = Column(String, default="")
    contact_map_embed_url = Column(Text, default="")
    contact_hours = Column(String, default="")

    # SEO & Tracking
    seo_pages = Column(JSON, default=list)            # [{page, path, title, description, og_image, keywords}]
    schema_org = Column(JSON, default=dict)            # {name, description, phone, email, street, city, country, lat, lng, openingHours}
    tracking = Column(JSON, default=dict)              # {ga_enabled, ga_id, gtm_enabled, gtm_id, fb_enabled, fb_id, tiktok_enabled, tiktok_id}
    sitemap_config = Column(JSON, default=dict)        # {base_url, extra_urls}

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Hero Slides ──────────────────────────────────────────────
class CMSHeroSlide(Base):
    __tablename__ = "cms_hero_slides"

    id = Column(String, primary_key=True, default=_uuid)
    tag = Column(String, nullable=False)
    title = Column(String, nullable=False)
    subtitle = Column(Text, default="")
    image = Column(String, nullable=False)
    cta1_text = Column(String, default="")
    cta1_href = Column(String, default="")
    cta2_text = Column(String, default="")
    cta2_href = Column(String, default="")
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ── Engagements ──────────────────────────────────────────────
class CMSEngagement(Base):
    __tablename__ = "cms_engagements"

    id = Column(String, primary_key=True, default=_uuid)
    icon_key = Column(String, nullable=False)
    title = Column(String, nullable=False)
    desc = Column(Text, default="")
    bg_color = Column(String, default="bg-globus-blue")
    text_color = Column(String, default="text-white")
    sort_order = Column(Integer, default=0)


# ── Methodology Steps ───────────────────────────────────────
class CMSMethodologyStep(Base):
    __tablename__ = "cms_methodology_steps"

    id = Column(String, primary_key=True, default=_uuid)
    icon_key = Column(String, nullable=False)
    title = Column(String, nullable=False)
    desc = Column(Text, default="")
    image = Column(String, default="")
    sort_order = Column(Integer, default=0)


# ── Stats ────────────────────────────────────────────────────
class CMSStat(Base):
    __tablename__ = "cms_stats"

    id = Column(String, primary_key=True, default=_uuid)
    value = Column(Integer, nullable=False)
    suffix = Column(String, default="")
    label = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)


# ── Guarantees ───────────────────────────────────────────────
class CMSGuarantee(Base):
    __tablename__ = "cms_guarantees"

    id = Column(String, primary_key=True, default=_uuid)
    icon_key = Column(String, nullable=False)
    title = Column(String, nullable=False)
    desc = Column(Text, default="")
    sort_order = Column(Integer, default=0)


# ── Services ─────────────────────────────────────────────────
class CMSService(Base):
    __tablename__ = "cms_services"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    subtitle = Column(String, default="")
    desc = Column(Text, default="")
    icon_key = Column(String, default="")
    image = Column(String, default="")
    images = Column(JSON, default=list)              # For home service cards
    details = Column(Text, default="")               # Full detail page
    benefits = Column(JSON, default=list)             # list[str]
    related_category = Column(String, default="")
    process_steps = Column(JSON, default=list)        # [{title, desc, iconKey}]
    faq = Column(JSON, default=list)                  # [{q, a}]
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ── Projects (Portfolio) ─────────────────────────────────────
class CMSProject(Base):
    __tablename__ = "cms_projects"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, default="")
    status = Column(String, default="En Cours")
    location = Column(String, default="")
    client_name = Column(String, default="")
    area = Column(String, default="")
    duration = Column(String, default="")
    architect = Column(String, default="")
    description = Column(Text, default="")
    images = Column(JSON, default=list)               # list[str]
    challenge = Column(Text, default="")
    solution = Column(Text, default="")
    video_url = Column(String, default="")
    progression = Column(JSON, default=list)          # [{step, status, date?}]
    progress = Column(Integer, default=0)
    featured = Column(Boolean, default=False)
    is_ongoing = Column(Boolean, default=False)       # For "ongoing project" section
    ongoing_description = Column(Text, default="")
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ── Blog Posts ───────────────────────────────────────────────
class CMSBlogPost(Base):
    __tablename__ = "cms_blog_posts"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, default="")
    date = Column(String, default="")
    read_time = Column(String, default="")
    author = Column(String, default="")
    excerpt = Column(Text, default="")
    image = Column(String, default="")
    html_content = Column(Text, default="")
    tags = Column(JSON, default=list)
    featured = Column(Boolean, default=False)
    status = Column(String, default="published")      # draft, published, scheduled
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Team Members ─────────────────────────────────────────────
class CMSTeamMember(Base):
    __tablename__ = "cms_team_members"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    role = Column(String, default="")
    quote = Column(Text, default="")
    image_class = Column(String, default="")          # Gradient class for homepage
    photo = Column(String, default="")                # Photo URL for about page
    sort_order = Column(Integer, default=0)


# ── Partners ─────────────────────────────────────────────────
class CMSPartner(Base):
    __tablename__ = "cms_partners"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    logo = Column(String, default="")
    sort_order = Column(Integer, default=0)


# ── Testimonials ─────────────────────────────────────────────
class CMSTestimonial(Base):
    __tablename__ = "cms_testimonials"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    project = Column(String, default="")
    text = Column(Text, default="")
    rating = Column(Integer, default=5)
    photo = Column(String, default="")
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ── FAQ ──────────────────────────────────────────────────────
class CMSFaqCategory(Base):
    __tablename__ = "cms_faq_categories"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    items = relationship("CMSFaqItem", back_populates="category", order_by="CMSFaqItem.sort_order")


class CMSFaqItem(Base):
    __tablename__ = "cms_faq_items"

    id = Column(String, primary_key=True, default=_uuid)
    category_id = Column(String, ForeignKey("cms_faq_categories.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    category = relationship("CMSFaqCategory", back_populates="items")


# ── Legal Pages ──────────────────────────────────────────────
class CMSLegalPage(Base):
    __tablename__ = "cms_legal_pages"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    last_updated = Column(String, default="")
    sections = Column(JSON, default=list)             # [{title, content}]


# ── About Page Content (singleton) ───────────────────────────
class CMSAboutContent(Base):
    __tablename__ = "cms_about_content"

    id = Column(String, primary_key=True, default=_uuid)
    # About section on home
    section_tag = Column(String, default="")
    title = Column(String, default="")
    paragraphs = Column(JSON, default=list)
    highlights = Column(JSON, default=list)
    cta_text = Column(String, default="")
    cta_href = Column(String, default="")
    images = Column(JSON, default=list)
    video_src = Column(String, default="")
    video_poster = Column(String, default="")
    badge_value = Column(String, default="")
    badge_label = Column(String, default="")

    # About page specific
    hero_image = Column(String, default="")
    hero_title = Column(String, default="")
    mission = Column(Text, default="")
    vision = Column(Text, default="")
    values = Column(JSON, default=list)               # [{title, desc, iconKey}]
    timeline = Column(JSON, default=list)             # [{year, title, desc}]
    certifications = Column(JSON, default=list)       # list[str]


# ── Form Submissions ────────────────────────────────────────
class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, default="")
    subject = Column(String, default="")
    message = Column(Text, default="")
    project_type = Column(String, default="")
    is_read = Column(Boolean, default=False)
    replied = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    subscribed_at = Column(DateTime, default=datetime.utcnow)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    subject = Column(String, default="")
    message = Column(Text, default="")
    status = Column(String, default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

class CMSAnalyticsLog(Base):
    __tablename__ = "cms_analytics_logs"

    id = Column(String, primary_key=True, default=_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, default="")
    user_agent = Column(String, default="")
    browser = Column(String, default="")
    os = Column(String, default="")
    device_type = Column(String, default="")
    path = Column(String, default="")
    country = Column(String, default="")
