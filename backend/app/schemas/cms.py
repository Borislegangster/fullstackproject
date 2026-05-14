"""
Pydantic schemas for CMS API responses.
Mirror the TypeScript interfaces in cms.types.ts exactly.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional


# ── Hero ─────────────────────────────────────────────────────
class CtaButton(BaseModel):
    text: str
    href: str


class HeroSlideOut(BaseModel):
    tag: str
    title: str
    subtitle: str
    image: str
    cta1: CtaButton
    cta2: CtaButton


class HeroVideoOut(BaseModel):
    src: str
    poster: str


# ── Engagements ──────────────────────────────────────────────
class EngagementOut(BaseModel):
    iconKey: str
    title: str
    desc: str
    bgColor: str
    textColor: str


# ── About (Home Section) ────────────────────────────────────
class AboutContentOut(BaseModel):
    sectionTag: str
    title: str
    paragraphs: list[str]
    highlights: list[str]
    ctaText: str
    ctaHref: str
    images: list[str]
    videoSrc: str
    videoPoster: str
    badgeValue: str
    badgeLabel: str


# ── Methodology ──────────────────────────────────────────────
class MethodologyStepOut(BaseModel):
    iconKey: str
    title: str
    desc: str
    image: str


# ── Stats ────────────────────────────────────────────────────
class StatOut(BaseModel):
    value: int
    suffix: str
    label: str


# ── Services ─────────────────────────────────────────────────
class ServiceItemOut(BaseModel):
    title: str
    subtitle: str
    desc: str
    iconKey: str
    images: list[str]
    slug: str


class ServiceDetailOut(BaseModel):
    id: str
    title: str
    subtitle: str
    desc: str
    iconKey: str
    image: str


class ProcessStep(BaseModel):
    title: str
    desc: str
    iconKey: str


class FaqItemSimple(BaseModel):
    q: str
    a: str


class ServiceDetailFullOut(BaseModel):
    slug: str
    title: str
    subtitle: str
    image: str
    desc: str
    details: str
    benefits: list[str]
    relatedCategory: str
    processSteps: list[ProcessStep]
    faq: list[FaqItemSimple]


# ── CTA Banner ───────────────────────────────────────────────
class CtaBannerOut(BaseModel):
    title: str
    subtitle: str
    ctaText: str
    ctaHref: str


# ── Projects ─────────────────────────────────────────────────
class ProjectOut(BaseModel):
    id: int
    title: str
    category: str
    images: list[str]
    featured: bool
    slug: Optional[str] = None
    videoSrc: Optional[str] = None


class ProjectPageItem(BaseModel):
    id: str
    title: str
    category: str
    location: str
    description: str
    image: str
    progress: int


class ProgressionStep(BaseModel):
    step: str
    status: str
    date: Optional[str] = None


class ProjectDetailFullOut(BaseModel):
    slug: str
    title: str
    category: str
    status: str
    location: str
    client: str
    area: str
    duration: str
    architect: str
    images: list[str]
    challenge: str
    solution: str
    videoUrl: str
    progression: list[ProgressionStep]


class OngoingProjectOut(BaseModel):
    title: str
    description: str
    progress: int
    images: list[str]
    slug: str


# ── Guarantees ───────────────────────────────────────────────
class GuaranteeOut(BaseModel):
    iconKey: str
    title: str
    desc: str


# ── Video Section ────────────────────────────────────────────
class VideoSectionOut(BaseModel):
    title: str
    subtitle: str
    youtubeUrl: str
    backgroundVideoSrc: str
    backgroundVideoPoster: str


# ── Team ─────────────────────────────────────────────────────
class TeamMemberOut(BaseModel):
    name: str
    role: str
    quote: str
    imageClass: str
    photo: Optional[str] = None


# ── Partners ─────────────────────────────────────────────────
class PartnerOut(BaseModel):
    name: str
    logo: Optional[str] = None


# ── Testimonials ─────────────────────────────────────────────
class TestimonialOut(BaseModel):
    id: int
    name: str
    project: str
    text: str
    rating: int
    photo: str


# ── FAQ ──────────────────────────────────────────────────────
class FaqItemOut(BaseModel):
    q: str
    a: str


class FaqCategoryOut(BaseModel):
    name: str
    items: list[FaqItemOut]


# ── Blog ─────────────────────────────────────────────────────
class BlogPostOut(BaseModel):
    title: str
    category: str
    date: str
    excerpt: str
    image: str
    slug: Optional[str] = None
    htmlContent: Optional[str] = None


class BlogPostPageItem(BaseModel):
    id: str
    title: str
    category: str
    date: str
    readTime: Optional[str] = None
    author: Optional[str] = None
    excerpt: str
    image: str
    featured: Optional[bool] = None
    htmlContent: Optional[str] = None


# ── Contact ──────────────────────────────────────────────────
class ContactInfoOut(BaseModel):
    address: str
    phone: str
    email: str
    whatsapp: str
    mapEmbedUrl: str
    hours: str


class ContactFormIn(BaseModel):
    name: str
    email: str
    phone: str = ""
    subject: str = ""
    message: str = ""
    projectType: Optional[str] = None


# ── Site Settings ────────────────────────────────────────────
class NavLinkOut(BaseModel):
    label: str
    href: str
    children: Optional[list["NavLinkOut"]] = None


class SocialLinksOut(BaseModel):
    facebook: str
    twitter: str
    linkedin: str
    instagram: str


class SiteSettingsOut(BaseModel):
    companyName: str
    logo: str
    phone: str
    email: str
    address: str
    whatsappUrl: str
    socialLinks: SocialLinksOut
    footerDescription: str
    navLinks: list[NavLinkOut]
    footerQuickLinks: Optional[list[NavLinkOut]] = None
    footerServiceLinks: Optional[list[NavLinkOut]] = None
    topBarText: Optional[str] = None


# ── Legal ────────────────────────────────────────────────────
class LegalSectionOut(BaseModel):
    title: str
    content: str


class LegalPageOut(BaseModel):
    slug: str
    title: str
    lastUpdated: str
    sections: list[LegalSectionOut]


# ── About Page ───────────────────────────────────────────────
class ValueItem(BaseModel):
    title: str
    desc: str
    iconKey: str


class TimelineItem(BaseModel):
    year: str
    title: str
    desc: str


class AboutPageOut(BaseModel):
    heroImage: str
    heroTitle: str
    mission: str
    vision: str
    values: list[ValueItem]
    timeline: list[TimelineItem]
    team: list[TeamMemberOut]
    stats: list[StatOut]
    certifications: Optional[list[str]] = None


# ── Newsletter ───────────────────────────────────────────────
class NewsletterIn(BaseModel):
    email: str


# ── Support Ticket ───────────────────────────────────────────
class SupportTicketIn(BaseModel):
    name: str
    email: str
    subject: str
    message: str


# ── Generic Response ─────────────────────────────────────────
class FormResponse(BaseModel):
    success: bool
    message: str

# ── Analytics ───────────────────────────────────────────────
class AnalyticsLogIn(BaseModel):
    path: str
    userAgent: str
    deviceType: str
    browser: str
    os: str

class AnalyticsLogOut(BaseModel):
    id: str
    timestamp: str
    ip_address: str
    user_agent: str
    browser: str
    os: str
    device_type: str
    path: str
    country: str
