"""
CMS service layer — Database queries for all CMS content.
"""
from __future__ import annotations
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.cms import (
    CMSSiteSettings, CMSHeroSlide, CMSEngagement, CMSAboutContent,
    CMSMethodologyStep, CMSStat, CMSService, CMSProject, CMSGuarantee,
    CMSTeamMember, CMSPartner, CMSTestimonial, CMSFaqCategory, CMSFaqItem,
    CMSBlogPost, CMSLegalPage, ContactSubmission, NewsletterSubscriber,
    SupportTicket,
)


async def get_site_settings(db: AsyncSession):
    result = await db.execute(select(CMSSiteSettings).limit(1))
    return result.scalars().first()

async def get_about_content(db: AsyncSession):
    result = await db.execute(select(CMSAboutContent).limit(1))
    return result.scalars().first()

async def get_hero_slides(db: AsyncSession):
    result = await db.execute(select(CMSHeroSlide).where(CMSHeroSlide.is_active == True).order_by(CMSHeroSlide.sort_order))
    return list(result.scalars().all())

async def get_engagements(db: AsyncSession):
    result = await db.execute(select(CMSEngagement).order_by(CMSEngagement.sort_order))
    return list(result.scalars().all())

async def get_methodology_steps(db: AsyncSession):
    result = await db.execute(select(CMSMethodologyStep).order_by(CMSMethodologyStep.sort_order))
    return list(result.scalars().all())

async def get_stats(db: AsyncSession):
    result = await db.execute(select(CMSStat).order_by(CMSStat.sort_order))
    return list(result.scalars().all())

async def get_guarantees(db: AsyncSession):
    result = await db.execute(select(CMSGuarantee).order_by(CMSGuarantee.sort_order))
    return list(result.scalars().all())

async def get_services_home(db: AsyncSession):
    result = await db.execute(select(CMSService).where(CMSService.is_published == True).order_by(CMSService.sort_order))
    return list(result.scalars().all())

async def get_services_page(db: AsyncSession):
    return await get_services_home(db)

async def get_service_by_slug(db: AsyncSession, slug: str):
    result = await db.execute(select(CMSService).where(CMSService.slug == slug))
    return result.scalars().first()

async def get_projects_home(db: AsyncSession):
    result = await db.execute(select(CMSProject).where(CMSProject.is_published == True).order_by(CMSProject.sort_order))
    return list(result.scalars().all())

async def get_ongoing_project(db: AsyncSession):
    result = await db.execute(select(CMSProject).where(CMSProject.is_ongoing == True).limit(1))
    return result.scalars().first()

async def get_projects_page(db: AsyncSession):
    result = await db.execute(select(CMSProject).where(CMSProject.is_published == True).order_by(CMSProject.sort_order))
    return list(result.scalars().all())

async def get_project_by_slug(db: AsyncSession, slug: str):
    result = await db.execute(select(CMSProject).where(CMSProject.slug == slug))
    return result.scalars().first()

async def get_latest_blog_posts(db: AsyncSession, limit: int = 3):
    result = await db.execute(select(CMSBlogPost).where(CMSBlogPost.status == "published").order_by(CMSBlogPost.created_at.desc()).limit(limit))
    return list(result.scalars().all())

async def get_all_blog_posts(db: AsyncSession):
    result = await db.execute(select(CMSBlogPost).where(CMSBlogPost.status == "published").order_by(CMSBlogPost.created_at.desc()))
    return list(result.scalars().all())

async def get_blog_post_by_slug(db: AsyncSession, slug: str):
    result = await db.execute(select(CMSBlogPost).where(CMSBlogPost.slug == slug))
    return result.scalars().first()

async def get_team_members(db: AsyncSession):
    result = await db.execute(select(CMSTeamMember).order_by(CMSTeamMember.sort_order))
    return list(result.scalars().all())

async def get_partners(db: AsyncSession):
    result = await db.execute(select(CMSPartner).order_by(CMSPartner.sort_order))
    return list(result.scalars().all())

async def get_testimonials(db: AsyncSession):
    result = await db.execute(select(CMSTestimonial).where(CMSTestimonial.is_published == True).order_by(CMSTestimonial.sort_order))
    return list(result.scalars().all())

async def get_faq_items_home(db: AsyncSession, limit: int = 5):
    result = await db.execute(select(CMSFaqItem).order_by(CMSFaqItem.sort_order).limit(limit))
    return list(result.scalars().all())

async def get_faq_categories(db: AsyncSession):
    result = await db.execute(select(CMSFaqCategory).options(selectinload(CMSFaqCategory.items)).order_by(CMSFaqCategory.sort_order))
    return list(result.scalars().all())

async def get_legal_page(db: AsyncSession, slug: str):
    result = await db.execute(select(CMSLegalPage).where(CMSLegalPage.slug == slug))
    return result.scalars().first()

async def create_contact_submission(db: AsyncSession, data: dict):
    submission = ContactSubmission(**data)
    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    return submission

async def create_newsletter_subscriber(db: AsyncSession, email: str):
    result = await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == email))
    existing = result.scalars().first()
    if existing:
        existing.is_active = True
        await db.commit()
        return existing
    subscriber = NewsletterSubscriber(email=email)
    db.add(subscriber)
    await db.commit()
    await db.refresh(subscriber)
    return subscriber

async def create_support_ticket(db: AsyncSession, data: dict):
    ticket = SupportTicket(**data)
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket
