"""
Public CMS API routes — All GET endpoints consumed by the site vitrine.
Prefix: /cms (mounted at /api/v1 in main.py → final: /api/v1/cms/*)

These endpoints match EXACTLY the paths in frontend/src/services/api/cms.api.ts
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.database import get_db
from app.services import cms_service as svc
from app.schemas.cms import (
    HeroSlideOut, CtaButton, HeroVideoOut, EngagementOut, AboutContentOut,
    MethodologyStepOut, StatOut, ServiceItemOut, ServiceDetailOut,
    ServiceDetailFullOut, ProcessStep, FaqItemSimple, CtaBannerOut,
    ProjectOut, ProjectPageItem, ProjectDetailFullOut, ProgressionStep,
    OngoingProjectOut, GuaranteeOut, VideoSectionOut, TeamMemberOut,
    PartnerOut, TestimonialOut, FaqItemOut, FaqCategoryOut, BlogPostOut,
    BlogPostPageItem, ContactInfoOut, SiteSettingsOut, SocialLinksOut,
    NavLinkOut, LegalPageOut, LegalSectionOut, AboutPageOut, ValueItem,
    TimelineItem, ContactFormIn, NewsletterIn, SupportTicketIn, FormResponse,
    AnalyticsLogIn,
)

router = APIRouter(prefix="/cms", tags=["CMS Public"])


# ══════════════════════════════════════════════════════════════
# HOME SECTION APIs
# ══════════════════════════════════════════════════════════════

@router.get("/hero-slides", response_model=list[HeroSlideOut])
async def get_hero_slides(db: AsyncSession = Depends(get_db)):
    slides = await svc.get_hero_slides(db)
    return [
        HeroSlideOut(
            tag=s.tag, title=s.title, subtitle=s.subtitle, image=s.image,
            cta1=CtaButton(text=s.cta1_text, href=s.cta1_href),
            cta2=CtaButton(text=s.cta2_text, href=s.cta2_href),
        )
        for s in slides
    ]


@router.get("/hero-video", response_model=HeroVideoOut)
async def get_hero_video(db: AsyncSession = Depends(get_db)):
    settings = await svc.get_site_settings(db)
    if not settings:
        raise HTTPException(404, "Site settings not found")
    return HeroVideoOut(src=settings.hero_video_src, poster=settings.hero_video_poster)


@router.get("/engagements", response_model=list[EngagementOut])
async def get_engagements(db: AsyncSession = Depends(get_db)):
    items = await svc.get_engagements(db)
    return [
        EngagementOut(
            iconKey=e.icon_key, title=e.title, desc=e.desc,
            bgColor=e.bg_color, textColor=e.text_color,
        )
        for e in items
    ]


@router.get("/about", response_model=AboutContentOut)
async def get_about(db: AsyncSession = Depends(get_db)):
    about = await svc.get_about_content(db)
    if not about:
        raise HTTPException(404, "About content not found")
    return AboutContentOut(
        sectionTag=about.section_tag, title=about.title,
        paragraphs=about.paragraphs or [], highlights=about.highlights or [],
        ctaText=about.cta_text, ctaHref=about.cta_href,
        images=about.images or [], videoSrc=about.video_src,
        videoPoster=about.video_poster, badgeValue=about.badge_value,
        badgeLabel=about.badge_label,
    )


@router.get("/methodology", response_model=list[MethodologyStepOut])
async def get_methodology(db: AsyncSession = Depends(get_db)):
    steps = await svc.get_methodology_steps(db)
    return [
        MethodologyStepOut(iconKey=s.icon_key, title=s.title, desc=s.desc, image=s.image)
        for s in steps
    ]


@router.get("/stats", response_model=list[StatOut])
async def get_stats(db: AsyncSession = Depends(get_db)):
    stats = await svc.get_stats(db)
    return [StatOut(value=s.value, suffix=s.suffix, label=s.label) for s in stats]


@router.get("/services", response_model=list[ServiceItemOut])
async def get_services(db: AsyncSession = Depends(get_db)):
    services = await svc.get_services_home(db)
    return [
        ServiceItemOut(
            title=s.title, subtitle=s.subtitle, desc=s.desc,
            iconKey=s.icon_key, images=s.images or [],
            slug=s.slug,
        )
        for s in services
    ]


@router.get("/cta-banner", response_model=CtaBannerOut)
async def get_cta_banner(db: AsyncSession = Depends(get_db)):
    settings = await svc.get_site_settings(db)
    if not settings:
        raise HTTPException(404, "Site settings not found")
    return CtaBannerOut(
        title=settings.cta_title, subtitle=settings.cta_subtitle,
        ctaText=settings.cta_text, ctaHref=settings.cta_href,
    )


@router.get("/projects", response_model=list[ProjectOut])
async def get_projects(db: AsyncSession = Depends(get_db)):
    projects = await svc.get_projects_home(db)
    return [
        ProjectOut(
            id=idx + 1, title=p.title, category=p.category,
            images=p.images or [], featured=p.featured,
            slug=p.slug, videoSrc=p.video_url if p.featured else None,
        )
        for idx, p in enumerate(projects)
    ]


@router.get("/ongoing-project", response_model=OngoingProjectOut)
async def get_ongoing_project(db: AsyncSession = Depends(get_db)):
    project = await svc.get_ongoing_project(db)
    if not project:
        raise HTTPException(404, "No ongoing project")
    return OngoingProjectOut(
        title=project.title,
        description=project.ongoing_description or project.description,
        progress=project.progress, images=project.images or [],
        slug=project.slug,
    )


@router.get("/guarantees", response_model=list[GuaranteeOut])
async def get_guarantees(db: AsyncSession = Depends(get_db)):
    items = await svc.get_guarantees(db)
    return [GuaranteeOut(iconKey=g.icon_key, title=g.title, desc=g.desc) for g in items]


@router.get("/video-section", response_model=VideoSectionOut)
async def get_video_section(db: AsyncSession = Depends(get_db)):
    settings = await svc.get_site_settings(db)
    if not settings:
        raise HTTPException(404, "Site settings not found")
    return VideoSectionOut(
        title=settings.video_section_title,
        subtitle=settings.video_section_subtitle,
        youtubeUrl=settings.video_section_youtube_url,
        backgroundVideoSrc=settings.video_section_bg_video_src,
        backgroundVideoPoster=settings.video_section_bg_video_poster,
    )


@router.get("/team", response_model=list[TeamMemberOut])
async def get_team(db: AsyncSession = Depends(get_db)):
    members = await svc.get_team_members(db)
    return [
        TeamMemberOut(
            name=m.name, role=m.role, quote=m.quote,
            imageClass=m.image_class, photo=m.photo or None,
        )
        for m in members
    ]


@router.get("/partners", response_model=list[PartnerOut])
async def get_partners(db: AsyncSession = Depends(get_db)):
    partners = await svc.get_partners(db)
    return [PartnerOut(name=p.name, logo=p.logo or None) for p in partners]


@router.get("/testimonials", response_model=list[TestimonialOut])
async def get_testimonials(db: AsyncSession = Depends(get_db)):
    items = await svc.get_testimonials(db)
    return [
        TestimonialOut(
            id=idx + 1, name=t.name, project=t.project,
            text=t.text, rating=t.rating, photo=t.photo,
        )
        for idx, t in enumerate(items)
    ]


@router.get("/faq-home", response_model=list[FaqItemOut])
async def get_faq_home(db: AsyncSession = Depends(get_db)):
    items = await svc.get_faq_items_home(db)
    return [FaqItemOut(q=f.question, a=f.answer) for f in items]


@router.get("/blog/latest", response_model=list[BlogPostOut])
async def get_latest_blog(db: AsyncSession = Depends(get_db)):
    posts = await svc.get_latest_blog_posts(db)
    return [
        BlogPostOut(
            title=p.title, category=p.category, date=p.date,
            excerpt=p.excerpt, image=p.image, slug=p.slug,
        )
        for p in posts
    ]


# ══════════════════════════════════════════════════════════════
# PAGE-LEVEL APIs
# ══════════════════════════════════════════════════════════════

@router.get("/services-page", response_model=list[ServiceDetailOut])
async def get_services_page(db: AsyncSession = Depends(get_db)):
    services = await svc.get_services_page(db)
    return [
        ServiceDetailOut(
            id=s.slug, title=s.title, subtitle=s.subtitle,
            desc=s.desc, iconKey=s.icon_key, image=s.image,
        )
        for s in services
    ]


@router.get("/services/{slug}", response_model=ServiceDetailFullOut)
async def get_service_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    service = await svc.get_service_by_slug(db, slug)
    if not service:
        # Fallback to first service (like the frontend mock behavior)
        service = await svc.get_service_by_slug(db, "construction-batiments")
    if not service:
        raise HTTPException(404, "Service not found")
    return ServiceDetailFullOut(
        slug=service.slug, title=service.title, subtitle=service.subtitle,
        image=service.image, desc=service.desc, details=service.details,
        benefits=service.benefits or [],
        relatedCategory=service.related_category,
        processSteps=[ProcessStep(**s) for s in (service.process_steps or [])],
        faq=[FaqItemSimple(**f) for f in (service.faq or [])],
    )


@router.get("/projects-page", response_model=list[ProjectPageItem])
async def get_projects_page(db: AsyncSession = Depends(get_db)):
    projects = await svc.get_projects_page(db)
    return [
        ProjectPageItem(
            id=p.slug, title=p.title, category=p.category,
            location=p.location, description=p.description,
            image=(p.images[0] if p.images else ""), progress=p.progress,
        )
        for p in projects
    ]


@router.get("/projects/{slug}", response_model=ProjectDetailFullOut)
async def get_project_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    project = await svc.get_project_by_slug(db, slug)
    if not project:
        project = await svc.get_project_by_slug(db, "default")
    if not project:
        raise HTTPException(404, "Project not found")
    return ProjectDetailFullOut(
        slug=project.slug, title=project.title, category=project.category,
        status=project.status, location=project.location,
        client=project.client_name, area=project.area,
        duration=project.duration, architect=project.architect,
        images=project.images or [], challenge=project.challenge,
        solution=project.solution, videoUrl=project.video_url,
        progression=[ProgressionStep(**s) for s in (project.progression or [])],
    )


@router.get("/blog", response_model=list[BlogPostPageItem])
async def get_all_blog(db: AsyncSession = Depends(get_db)):
    posts = await svc.get_all_blog_posts(db)
    return [
        BlogPostPageItem(
            id=p.slug, title=p.title, category=p.category, date=p.date,
            readTime=p.read_time, author=p.author, excerpt=p.excerpt,
            image=p.image, featured=p.featured,
            htmlContent=p.html_content or None,
        )
        for p in posts
    ]


@router.get("/blog/{slug}", response_model=BlogPostPageItem)
async def get_blog_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    post = await svc.get_blog_post_by_slug(db, slug)
    if not post:
        raise HTTPException(404, "Blog post not found")
    return BlogPostPageItem(
        id=post.slug, title=post.title, category=post.category,
        date=post.date, readTime=post.read_time, author=post.author,
        excerpt=post.excerpt, image=post.image, featured=post.featured,
        htmlContent=post.html_content or None,
    )


@router.get("/faq", response_model=list[FaqCategoryOut])
async def get_faq_page(db: AsyncSession = Depends(get_db)):
    categories = await svc.get_faq_categories(db)
    return [
        FaqCategoryOut(
            name=c.name,
            items=[FaqItemOut(q=item.question, a=item.answer) for item in c.items],
        )
        for c in categories
    ]


@router.get("/contact", response_model=ContactInfoOut)
async def get_contact(db: AsyncSession = Depends(get_db)):
    settings = await svc.get_site_settings(db)
    if not settings:
        raise HTTPException(404, "Site settings not found")
    return ContactInfoOut(
        address=settings.contact_address, phone=settings.contact_phone,
        email=settings.contact_email, whatsapp=settings.contact_whatsapp,
        mapEmbedUrl=settings.contact_map_embed_url, hours=settings.contact_hours,
    )


@router.get("/settings", response_model=SiteSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)):
    settings = await svc.get_site_settings(db)
    if not settings:
        raise HTTPException(404, "Site settings not found")
    social = settings.social_links or {}
    return SiteSettingsOut(
        companyName=settings.company_name, logo=settings.logo,
        phone=settings.phone, email=settings.email, address=settings.address,
        whatsappUrl=settings.whatsapp_url,
        socialLinks=SocialLinksOut(
            facebook=social.get("facebook", ""),
            twitter=social.get("twitter", ""),
            linkedin=social.get("linkedin", ""),
            instagram=social.get("instagram", ""),
        ),
        footerDescription=settings.footer_description,
        navLinks=[NavLinkOut(**n) for n in (settings.nav_links or [])],
        footerQuickLinks=[NavLinkOut(**n) for n in (settings.footer_quick_links or [])],
        footerServiceLinks=[NavLinkOut(**n) for n in (settings.footer_service_links or [])],
        topBarText=settings.top_bar_text,
    )


@router.get("/legal/{slug}", response_model=LegalPageOut)
async def get_legal(slug: str, db: AsyncSession = Depends(get_db)):
    page = await svc.get_legal_page(db, slug)
    if not page:
        raise HTTPException(404, "Legal page not found")
    return LegalPageOut(
        slug=page.slug, title=page.title, lastUpdated=page.last_updated,
        sections=[LegalSectionOut(**s) for s in (page.sections or [])],
    )


@router.get("/about-page", response_model=AboutPageOut)
async def get_about_page(db: AsyncSession = Depends(get_db)):
    about = await svc.get_about_content(db)
    if not about:
        raise HTTPException(404, "About content not found")
    team_members = await svc.get_team_members(db)
    stats = await svc.get_stats(db)
    return AboutPageOut(
        heroImage=about.hero_image, heroTitle=about.hero_title,
        mission=about.mission, vision=about.vision,
        values=[ValueItem(**v) for v in (about.values or [])],
        timeline=[TimelineItem(**t) for t in (about.timeline or [])],
        team=[
            TeamMemberOut(
                name=m.name, role=m.role, quote=m.quote,
                imageClass=m.image_class, photo=m.photo or None,
            )
            for m in team_members
        ],
        stats=[StatOut(value=s.value, suffix=s.suffix, label=s.label) for s in stats],
        certifications=about.certifications or [],
    )


# ══════════════════════════════════════════════════════════════
# FORM SUBMISSION APIs
# ══════════════════════════════════════════════════════════════

@router.post("/contact/submit", response_model=FormResponse)
async def submit_contact(data: ContactFormIn, db: AsyncSession = Depends(get_db)):
    await svc.create_contact_submission(db, {
        "name": data.name, "email": data.email, "phone": data.phone,
        "subject": data.subject, "message": data.message,
        "project_type": data.projectType or "",
    })

    # Emails notification (Admin + Visiteur) via SMTP
    import smtplib, os
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    from_email = os.getenv("SMTP_FROM", smtp_user or "contact@globus-btp.com")
    admin_email = os.getenv("ADMIN_EMAIL", from_email)

    if smtp_host and smtp_user:
        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)

                # 1. Email to Admin
                if admin_email:
                    msg_admin = MIMEMultipart("alternative")
                    msg_admin["Subject"] = f"Nouveau message de contact: {data.subject or 'Demande'}"
                    msg_admin["From"] = f"Site Web Globus <{from_email}>"
                    msg_admin["To"] = admin_email
                    msg_admin["Reply-To"] = data.email

                    html_admin = f"""
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                      <div style="background:#1e3a5f;padding:20px;text-align:center;">
                        <h2 style="color:#fff;margin:0;">Nouveau Message de Contact</h2>
                      </div>
                      <div style="padding:24px;background:#fff;border:1px solid #eee;">
                        <p><strong>Nom:</strong> {data.name}</p>
                        <p><strong>Email:</strong> {data.email}</p>
                        <p><strong>Téléphone:</strong> {data.phone}</p>
                        <p><strong>Sujet:</strong> {data.subject}</p>
                        <div style="background:#f8f9fa;border-left:4px solid #e8750a;padding:16px;margin:16px 0;border-radius:4px;white-space:pre-wrap;">
                          {data.message}
                        </div>
                      </div>
                    </div>
                    """
                    msg_admin.attach(MIMEText(html_admin, "html"))
                    server.sendmail(from_email, admin_email, msg_admin.as_string())

                # 2. Confirmation Email to Visitor
                msg_visitor = MIMEMultipart("alternative")
                msg_visitor["Subject"] = "Confirmation de réception de votre message"
                msg_visitor["From"] = f"Globus Engineering <{from_email}>"
                msg_visitor["To"] = data.email

                html_visitor = f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:#1e3a5f;padding:20px;text-align:center;">
                    <h2 style="color:#fff;margin:0;">Globus Engineering</h2>
                  </div>
                  <div style="padding:24px;background:#fff;border:1px solid #eee;">
                    <p>Bonjour {data.name},</p>
                    <p>Nous avons bien reçu votre message concernant <strong>"{data.subject}"</strong>.</p>
                    <p>Notre équipe commerciale l'examinera dans les plus brefs délais et vous répondra très rapidement.</p>
                    <p>Merci pour votre confiance,</p>
                    <p><strong>L'équipe Globus Engineering</strong></p>
                  </div>
                  <div style="background:#f1f5f9;padding:12px;text-align:center;font-size:12px;color:#64748b;">
                    Ceci est un e-mail automatique, veuillez ne pas y répondre directement.
                  </div>
                </div>
                """
                msg_visitor.attach(MIMEText(html_visitor, "html"))
                server.sendmail(from_email, data.email, msg_visitor.as_string())

        except Exception as e:
            print(f"[WARN] Email send failed: {e}")

    return FormResponse(success=True, message="Message envoyé avec succès !")


@router.post("/newsletter/subscribe", response_model=FormResponse)
async def subscribe_newsletter(data: NewsletterIn, db: AsyncSession = Depends(get_db)):
    await svc.create_newsletter_subscriber(db, data.email)
    return FormResponse(success=True, message="Inscription à la newsletter réussie !")


@router.post("/support/ticket", response_model=FormResponse)
async def submit_support(data: SupportTicketIn, db: AsyncSession = Depends(get_db)):
    await svc.create_support_ticket(db, {
        "name": data.name, "email": data.email,
        "subject": data.subject, "message": data.message,
    })
    return FormResponse(success=True, message="Ticket envoyé avec succès !")

@router.post("/analytics/track", response_model=FormResponse)
async def track_analytics(data: AnalyticsLogIn, request: Request, db: AsyncSession = Depends(get_db)):
    ip_address = request.client.host if request.client else "unknown"
    # Support for proxies
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0]
        
    country = "Inconnu"
    if ip_address not in ("127.0.0.1", "::1", "unknown", "localhost"):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"http://ip-api.com/json/{ip_address}?fields=country", timeout=2.0)
                if response.status_code == 200:
                    resp_data = response.json()
                    if "country" in resp_data:
                        country = resp_data["country"]
        except Exception:
            pass
            
    await svc.create_analytics_log(db, {
        "ip_address": ip_address,
        "user_agent": data.userAgent,
        "device_type": data.deviceType,
        "browser": data.browser,
        "os": data.os,
        "path": data.path,
        "country": country
    })
    return FormResponse(success=True, message="Tracked")
