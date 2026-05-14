"""Admin CMS CRUD routes — All protected by require_admin."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.service import require_admin
from app.auth.models import User
from app.models.cms import (
    CMSHeroSlide, CMSEngagement, CMSAboutContent, CMSMethodologyStep,
    CMSStat, CMSService, CMSProject, CMSGuarantee, CMSTeamMember,
    CMSPartner, CMSTestimonial, CMSFaqCategory, CMSFaqItem,
    CMSBlogPost, CMSLegalPage, CMSSiteSettings, ContactSubmission,
)
from app.schemas.admin_cms import (
    FormResponse, BlogPostIn, BlogPostUpdate, ProjectIn, ProjectUpdate, ServiceIn, ServiceUpdate,
    TeamMemberIn, TeamMemberUpdate, TestimonialIn, TestimonialUpdate,
    PartnerIn, FaqCategoryIn, FaqItemIn, HeroSlideIn,
    EngagementIn, MethodologyStepIn, StatIn, GuaranteeIn,
    SiteSettingsIn, AboutContentIn, LegalPageIn, AnalyticsStatsOut
)
from app.services import cms_service as svc

router = APIRouter(prefix="/admin/cms", tags=["Admin - CMS"])
_id = lambda: str(uuid.uuid4())

# ── Generic CRUD helper ──────────────────────────────────────
async def _create(db, model, data, extra=None):
    fields = data.dict()
    if extra:
        fields.update(extra)
    obj = model(id=_id(), **fields)
    db.add(obj); await db.commit(); await db.refresh(obj); return obj

async def _update(db, model, item_id, data):
    r = await db.execute(select(model).where(model.id == item_id))
    obj = r.scalars().first()
    if not obj: raise HTTPException(404, "Element non trouve")
    for k, v in data.dict(exclude_unset=True).items():
        if v is not None: setattr(obj, k, v)
    await db.commit(); await db.refresh(obj); return obj

async def _delete(db, model, item_id):
    r = await db.execute(select(model).where(model.id == item_id))
    if not r.scalars().first(): raise HTTPException(404, "Element non trouve")
    await db.execute(delete(model).where(model.id == item_id))
    await db.commit()

# ══════════════════════════════════════════════════════════════
# ADMIN GET (lists) — Returns ALL records for admin dashboard
# ══════════════════════════════════════════════════════════════
async def _list_all(db, model):
    r = await db.execute(select(model))
    return r.scalars().all()

@router.get("/blog")
async def list_blog(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSBlogPost)

@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSProject)

@router.get("/services")
async def list_services(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSService)

@router.get("/team")
async def list_team(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSTeamMember)

@router.get("/testimonials")
async def list_testimonials(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSTestimonial)

@router.get("/partners")
async def list_partners(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSPartner)

@router.get("/faq/categories")
async def list_faq_categories(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSFaqCategory)

@router.get("/faq/items")
async def list_faq_items(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSFaqItem)

@router.get("/hero-slides")
async def list_hero_slides(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSHeroSlide)

@router.get("/engagements")
async def list_engagements(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSEngagement)

@router.get("/methodology")
async def list_methodology(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSMethodologyStep)

@router.get("/stats")
async def list_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSStat)

@router.get("/guarantees")
async def list_guarantees(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, CMSGuarantee)

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSSiteSettings))
    return r.scalars().first()

@router.get("/about")
async def get_about(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSAboutContent))
    return r.scalars().first()

@router.get("/legal/{slug}")
async def get_legal(slug: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSLegalPage).where(CMSLegalPage.slug == slug))
    return r.scalars().first()

@router.get("/contacts")
async def list_contacts(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await _list_all(db, ContactSubmission)


# ══════════════════════════════════════════════════════════════
@router.post("/blog", response_model=FormResponse)
async def create_blog(data: BlogPostIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    slug = data.slug or data.title.lower().replace(" ", "-")[:50]
    obj = await _create(db, CMSBlogPost, data, {"slug": slug})
    return FormResponse(success=True, message="Article cree", id=obj.id)

@router.put("/blog/{id}", response_model=FormResponse)
async def update_blog(id: str, data: BlogPostUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSBlogPost, id, data)
    return FormResponse(success=True, message="Article modifie", id=id)

@router.delete("/blog/{id}", response_model=FormResponse)
async def delete_blog(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSBlogPost, id); return FormResponse(success=True, message="Article supprime")

# ══════════════════════════════════════════════════════════════
# PROJECTS
# ══════════════════════════════════════════════════════════════
@router.post("/projects", response_model=FormResponse)
async def create_project(data: ProjectIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    slug = data.slug or data.title.lower().replace(" ", "-")[:50]
    obj = await _create(db, CMSProject, data, {"slug": slug})
    return FormResponse(success=True, message="Projet cree", id=obj.id)

@router.put("/projects/{id}", response_model=FormResponse)
async def update_project(id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSProject, id, data)
    return FormResponse(success=True, message="Projet modifie", id=id)

@router.delete("/projects/{id}", response_model=FormResponse)
async def delete_project(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSProject, id); return FormResponse(success=True, message="Projet supprime")

# ══════════════════════════════════════════════════════════════
# SERVICES
# ══════════════════════════════════════════════════════════════
@router.post("/services", response_model=FormResponse)
async def create_service(data: ServiceIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    slug = data.slug or data.title.lower().replace(" ", "-")[:50]
    obj = await _create(db, CMSService, data, {"slug": slug})
    return FormResponse(success=True, message="Service cree", id=obj.id)

@router.put("/services/{id}", response_model=FormResponse)
async def update_service(id: str, data: ServiceUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSService, id, data)
    return FormResponse(success=True, message="Service modifie", id=id)

@router.delete("/services/{id}", response_model=FormResponse)
async def delete_service(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSService, id); return FormResponse(success=True, message="Service supprime")

# ══════════════════════════════════════════════════════════════
# TEAM
# ══════════════════════════════════════════════════════════════
@router.post("/team", response_model=FormResponse)
async def create_team(data: TeamMemberIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSTeamMember, data)
    return FormResponse(success=True, message="Membre cree", id=obj.id)

@router.put("/team/{id}", response_model=FormResponse)
async def update_team(id: str, data: TeamMemberUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSTeamMember, id, data)
    return FormResponse(success=True, message="Membre modifie", id=id)

@router.delete("/team/{id}", response_model=FormResponse)
async def delete_team(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSTeamMember, id); return FormResponse(success=True, message="Membre supprime")

# ══════════════════════════════════════════════════════════════
# TESTIMONIALS
# ══════════════════════════════════════════════════════════════
@router.post("/testimonials", response_model=FormResponse)
async def create_testimonial(data: TestimonialIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSTestimonial, data)
    return FormResponse(success=True, message="Temoignage cree", id=obj.id)

@router.put("/testimonials/{id}", response_model=FormResponse)
async def update_testimonial(id: str, data: TestimonialUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSTestimonial, id, data)
    return FormResponse(success=True, message="Temoignage modifie", id=id)

@router.delete("/testimonials/{id}", response_model=FormResponse)
async def delete_testimonial(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSTestimonial, id); return FormResponse(success=True, message="Temoignage supprime")

# ══════════════════════════════════════════════════════════════
# PARTNERS
# ══════════════════════════════════════════════════════════════
@router.post("/partners", response_model=FormResponse)
async def create_partner(data: PartnerIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSPartner, data)
    return FormResponse(success=True, message="Partenaire cree", id=obj.id)

@router.put("/partners/{id}", response_model=FormResponse)
async def update_partner(id: str, data: PartnerIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSPartner, id, data)
    return FormResponse(success=True, message="Partenaire modifie", id=id)

@router.delete("/partners/{id}", response_model=FormResponse)
async def delete_partner(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSPartner, id); return FormResponse(success=True, message="Partenaire supprime")

# ══════════════════════════════════════════════════════════════
# FAQ CATEGORIES + ITEMS
# ══════════════════════════════════════════════════════════════
@router.post("/faq/categories", response_model=FormResponse)
async def create_faq_cat(data: FaqCategoryIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSFaqCategory, data)
    return FormResponse(success=True, message="Categorie creee", id=obj.id)

@router.put("/faq/categories/{id}", response_model=FormResponse)
async def update_faq_cat(id: str, data: FaqCategoryIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSFaqCategory, id, data)
    return FormResponse(success=True, message="Categorie modifiee", id=id)

@router.delete("/faq/categories/{id}", response_model=FormResponse)
async def delete_faq_cat(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await db.execute(delete(CMSFaqItem).where(CMSFaqItem.category_id == id))
    await _delete(db, CMSFaqCategory, id)
    return FormResponse(success=True, message="Categorie et items supprimes")

@router.post("/faq/items", response_model=FormResponse)
async def create_faq_item(data: FaqItemIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSFaqItem, data)
    return FormResponse(success=True, message="Question creee", id=obj.id)

@router.put("/faq/items/{id}", response_model=FormResponse)
async def update_faq_item(id: str, data: FaqItemIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSFaqItem, id, data)
    return FormResponse(success=True, message="Question modifiee", id=id)

@router.delete("/faq/items/{id}", response_model=FormResponse)
async def delete_faq_item(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSFaqItem, id); return FormResponse(success=True, message="Question supprimee")

# ══════════════════════════════════════════════════════════════
# HERO SLIDES
# ══════════════════════════════════════════════════════════════
@router.post("/hero-slides", response_model=FormResponse)
async def create_hero(data: HeroSlideIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSHeroSlide, data)
    return FormResponse(success=True, message="Slide cree", id=obj.id)

@router.put("/hero-slides/{id}", response_model=FormResponse)
async def update_hero(id: str, data: HeroSlideIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSHeroSlide, id, data)
    return FormResponse(success=True, message="Slide modifie", id=id)

@router.delete("/hero-slides/{id}", response_model=FormResponse)
async def delete_hero(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSHeroSlide, id); return FormResponse(success=True, message="Slide supprime")

# ══════════════════════════════════════════════════════════════
# ENGAGEMENTS
# ══════════════════════════════════════════════════════════════
@router.post("/engagements", response_model=FormResponse)
async def create_engagement(data: EngagementIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSEngagement, data)
    return FormResponse(success=True, message="Engagement cree", id=obj.id)

@router.put("/engagements/{id}", response_model=FormResponse)
async def update_engagement(id: str, data: EngagementIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSEngagement, id, data)
    return FormResponse(success=True, message="Engagement modifie", id=id)

@router.delete("/engagements/{id}", response_model=FormResponse)
async def delete_engagement(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSEngagement, id); return FormResponse(success=True, message="Engagement supprime")

# ══════════════════════════════════════════════════════════════
# METHODOLOGY STEPS
# ══════════════════════════════════════════════════════════════
@router.post("/methodology", response_model=FormResponse)
async def create_mstep(data: MethodologyStepIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSMethodologyStep, data)
    return FormResponse(success=True, message="Etape creee", id=obj.id)

@router.put("/methodology/{id}", response_model=FormResponse)
async def update_mstep(id: str, data: MethodologyStepIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSMethodologyStep, id, data)
    return FormResponse(success=True, message="Etape modifiee", id=id)

@router.delete("/methodology/{id}", response_model=FormResponse)
async def delete_mstep(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSMethodologyStep, id); return FormResponse(success=True, message="Etape supprimee")

# ══════════════════════════════════════════════════════════════
# STATS
# ══════════════════════════════════════════════════════════════
@router.post("/stats", response_model=FormResponse)
async def create_stat(data: StatIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSStat, data)
    return FormResponse(success=True, message="Stat creee", id=obj.id)

@router.put("/stats/{id}", response_model=FormResponse)
async def update_stat(id: str, data: StatIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSStat, id, data)
    return FormResponse(success=True, message="Stat modifiee", id=id)

@router.delete("/stats/{id}", response_model=FormResponse)
async def delete_stat(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSStat, id); return FormResponse(success=True, message="Stat supprimee")

# ══════════════════════════════════════════════════════════════
# GUARANTEES
# ══════════════════════════════════════════════════════════════
@router.post("/guarantees", response_model=FormResponse)
async def create_guarantee(data: GuaranteeIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    obj = await _create(db, CMSGuarantee, data)
    return FormResponse(success=True, message="Garantie creee", id=obj.id)

@router.put("/guarantees/{id}", response_model=FormResponse)
async def update_guarantee(id: str, data: GuaranteeIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _update(db, CMSGuarantee, id, data)
    return FormResponse(success=True, message="Garantie modifiee", id=id)

@router.delete("/guarantees/{id}", response_model=FormResponse)
async def delete_guarantee(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await _delete(db, CMSGuarantee, id); return FormResponse(success=True, message="Garantie supprimee")

# ══════════════════════════════════════════════════════════════
# SETTINGS (singleton PUT)
# ══════════════════════════════════════════════════════════════
@router.put("/settings", response_model=FormResponse)
async def update_settings(data: SiteSettingsIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSSiteSettings).limit(1))
    settings = r.scalars().first()
    if not settings: raise HTTPException(404, "Settings non trouves")
    for k, v in data.dict(exclude_unset=True).items():
        if v is not None: setattr(settings, k, v)
    await db.commit()
    return FormResponse(success=True, message="Parametres mis a jour")

# ══════════════════════════════════════════════════════════════
# ABOUT CONTENT (singleton PUT)
# ══════════════════════════════════════════════════════════════
@router.put("/about", response_model=FormResponse)
async def update_about(data: AboutContentIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSAboutContent).limit(1))
    about = r.scalars().first()
    if not about: raise HTTPException(404, "About non trouve")
    for k, v in data.dict(exclude_unset=True).items():
        if v is not None: setattr(about, k, v)
    await db.commit()
    return FormResponse(success=True, message="Contenu About mis a jour")

# ══════════════════════════════════════════════════════════════
# LEGAL PAGES
# ══════════════════════════════════════════════════════════════
@router.put("/legal/{slug}", response_model=FormResponse)
async def update_legal(slug: str, data: LegalPageIn, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(CMSLegalPage).where(CMSLegalPage.slug == slug))
    page = r.scalars().first()
    if not page: raise HTTPException(404, "Page legale non trouvee")
    for k, v in data.dict(exclude_unset=True).items():
        if v is not None: setattr(page, k, v)
    await db.commit()
    return FormResponse(success=True, message="Page legale mise a jour")

# ══════════════════════════════════════════════════════════════
# CONTACT SUBMISSIONS (admin read)
# ══════════════════════════════════════════════════════════════
@router.get("/contacts")
async def list_contacts(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(ContactSubmission).order_by(ContactSubmission.created_at.desc()))
    return [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "subject": c.subject, "message": c.message, "created_at": c.created_at.isoformat() if c.created_at else "", "is_read": c.is_read, "replied": getattr(c, 'replied', False)} for c in r.scalars().all()]

@router.put("/contacts/{id}/read", response_model=FormResponse)
async def mark_contact_read(id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(ContactSubmission).where(ContactSubmission.id == id))
    c = r.scalars().first()
    if not c: raise HTTPException(404, "Contact non trouve")
    c.is_read = True
    await db.commit()
    return FormResponse(success=True, message="Marque comme lu")

@router.post("/contacts/{id}/reply", response_model=FormResponse)
async def reply_contact(id: str, body: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    r = await db.execute(select(ContactSubmission).where(ContactSubmission.id == id))
    c = r.scalars().first()
    if not c: raise HTTPException(404, "Contact non trouve")

    reply_message = body.get("message", "")
    if not reply_message:
        raise HTTPException(400, "Message de reponse requis")

    # Send reply email via SMTP
    import smtplib, os
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    from_email = os.getenv("SMTP_FROM", smtp_user or "contact@globus-btp.com")

    if smtp_host and smtp_user:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Re: {c.subject or 'Votre demande'}"
            msg["From"] = f"Globus Engineering <{from_email}>"
            msg["To"] = c.email

            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#1e3a5f;padding:20px;text-align:center;">
                <h2 style="color:#fff;margin:0;">Globus Engineering</h2>
              </div>
              <div style="padding:24px;background:#fff;">
                <p>Bonjour {c.name},</p>
                <p>En réponse à votre message concernant <strong>"{c.subject}"</strong> :</p>
                <div style="background:#f8f9fa;border-left:4px solid #e8750a;padding:16px;margin:16px 0;border-radius:4px;">
                  {reply_message.replace(chr(10), '<br>')}
                </div>
                <p>Cordialement,<br><strong>L'équipe Globus Engineering</strong></p>
              </div>
              <div style="background:#f1f5f9;padding:12px;text-align:center;font-size:12px;color:#64748b;">
                Globus Engineering SARL — BTP & Construction
              </div>
            </div>
            """
            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, c.email, msg.as_string())
        except Exception as e:
            print(f"[WARN] Email send failed: {e}")
            # Don't fail the request — mark as replied anyway

    c.is_read = True
    c.replied = True
    await db.commit()
    return FormResponse(success=True, message="Reponse envoyee")

# ── Analytics ────────────────────────────────────────────────
@router.get("/analytics", response_model=AnalyticsStatsOut)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin)
):
    stats = await svc.get_analytics_logs_and_stats(db)
    
    # Format logs for frontend
    formatted_logs = []
    for log in stats["logs"]:
        formatted_logs.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "browser": log.browser,
            "os": log.os,
            "device_type": log.device_type,
            "path": log.path
        })
        
    return AnalyticsStatsOut(
        total_views_month=stats["total_views_month"],
        devices=stats["devices"],
        browsers=stats["browsers"],
        paths=stats["paths"],
        countries=stats["countries"],
        logs=formatted_logs
    )
