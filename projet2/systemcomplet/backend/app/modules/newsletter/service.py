"""Newsletter & automatisation marketing (§4.5) : double opt-in avec preuve de consentement, segments,
modèles versionnés, campagnes ponctuelles/programmées, suivi (envoi, délivré, rebond, ouverture, clic,
désabonnement, plainte), exclusion automatique des désabonnés (V4-MAIL-37), automatisations."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import timedelta
from typing import Any
from urllib.parse import quote

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.security import random_token, sign_payload
from app.core.utils import utcnow
from app.modules.newsletter.models import (
    Automation,
    AutomationEnrollment,
    Campaign,
    CampaignEvent,
    CampaignRecipient,
    EmailTemplate,
    EmailTemplateVersion,
    NewsletterSubscriber,
    Segment,
    SubscriberEvent,
)

log = logging.getLogger("globus.newsletter")
SENDABLE = ("subscribed",)


def _event(
    db: Session,
    sub: NewsletterSubscriber,
    kind: str,
    details: dict[str, Any] | None = None,
    actor_id: uuid.UUID | None = None,
) -> None:
    db.add(SubscriberEvent(subscriber_id=sub.id, kind=kind, details=details or {}, actor_id=actor_id))


def subscribe(
    db: Session,
    *,
    email: str,
    first_name: str | None,
    source: str,
    interests: list[str],
    consent_record_id: uuid.UUID | None,
    ip: str | None,
    user_agent: str | None,
    lead_id: uuid.UUID | None = None,
    send_confirmation: bool = True,
) -> NewsletterSubscriber:
    from app.modules.notifications.service import queue_external

    email = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise AppError("Adresse e-mail invalide", code="INVALID_EMAIL")
    sub = db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)).scalar_one_or_none()
    if sub is None:
        sub = NewsletterSubscriber(
            email=email,
            first_name=first_name,
            source=source,
            interests=interests,
            consent_record_id=consent_record_id,
            token=random_token(24),
            status="pending",
            lead_id=lead_id,
        )
        db.add(sub)
        db.flush()
        _event(db, sub, "subscribed", {"source": source})
    else:
        if sub.status in ("unsubscribed", "complained", "bounced"):
            sub.status = "pending"
            sub.unsubscribed_at = None
            _event(db, sub, "resubscribe_requested", {"source": source})
        sub.interests = sorted(set(sub.interests or []) | set(interests))
        if consent_record_id:
            sub.consent_record_id = consent_record_id
    if sub.status == "pending" and send_confirmation:
        link = f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/public/newsletter/confirm?token={sub.token}"
        queue_external(db, channel="email", recipient=email, template_code="newsletter.confirm", context={"link": link})
    return sub


def confirm(db: Session, token: str) -> NewsletterSubscriber:
    sub = db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.token == token)).scalar_one_or_none()
    if sub is None:
        raise NotFound("Lien invalide")
    if sub.status == "pending":
        sub.status = "subscribed"
        sub.confirmed_at = utcnow()
        _event(db, sub, "confirmed")
        _enroll(db, sub, "subscriber_confirmed")
    return sub


def unsubscribe(db: Session, token: str, reason: str | None = None) -> NewsletterSubscriber:
    sub = db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.token == token)).scalar_one_or_none()
    if sub is None:
        raise NotFound("Lien invalide")
    if sub.status != "unsubscribed":
        sub.status = "unsubscribed"
        sub.unsubscribed_at = utcnow()
        sub.unsubscribe_reason = (reason or "")[:250] or None
        _event(db, sub, "unsubscribed", {"reason": reason})
        for enrollment in db.execute(
            select(AutomationEnrollment).where(
                AutomationEnrollment.subscriber_id == sub.id, AutomationEnrollment.status == "active"
            )
        ).scalars():
            enrollment.status = "exited"
    return sub


# ---------------------------------------------------------------------------- segments
def segment_query(segment: Segment | None) -> Any:
    stmt = select(NewsletterSubscriber).where(NewsletterSubscriber.status.in_(SENDABLE))
    if segment is None:
        return stmt
    rules = segment.rules or {}
    if rules.get("tags_any"):
        stmt = stmt.where(or_(*[NewsletterSubscriber.tags.contains([t]) for t in rules["tags_any"]]))
    if rules.get("tags_all"):
        stmt = stmt.where(and_(*[NewsletterSubscriber.tags.contains([t]) for t in rules["tags_all"]]))
    if rules.get("interests_any"):
        stmt = stmt.where(or_(*[NewsletterSubscriber.interests.contains([t]) for t in rules["interests_any"]]))
    if rules.get("sources"):
        stmt = stmt.where(NewsletterSubscriber.source.in_(rules["sources"]))
    if rules.get("diaspora") is not None:
        stmt = stmt.where(NewsletterSubscriber.is_diaspora.is_(bool(rules["diaspora"])))
    if rules.get("countries"):
        stmt = stmt.where(NewsletterSubscriber.country.in_(rules["countries"]))
    if rules.get("engaged_days"):
        stmt = stmt.where(NewsletterSubscriber.last_engaged_at >= utcnow() - timedelta(days=int(rules["engaged_days"])))
    return stmt


def segment_count(db: Session, segment: Segment | None) -> int:
    return db.execute(select(func.count()).select_from(segment_query(segment).subquery())).scalar_one()


# ---------------------------------------------------------------------------- modèles
def new_template_version(
    db: Session,
    template: EmailTemplate,
    *,
    subject: str,
    html: str,
    text: str | None,
    preheader: str | None,
    user_id: uuid.UUID | None,
) -> EmailTemplateVersion:
    from app.modules.cms.schemas import sanitize_html

    if "<script" in html.lower():
        raise AppError("Les scripts sont interdits dans les e-mails")
    version = (
        db.execute(
            select(func.max(EmailTemplateVersion.version)).where(EmailTemplateVersion.template_id == template.id)
        ).scalar()
        or 0
    ) + 1
    row = EmailTemplateVersion(
        template_id=template.id,
        version=version,
        subject=subject,
        preheader=preheader,
        html=sanitize_html(html) if "<" in html else html,
        text=text,
        created_by_id=user_id,
    )
    db.add(row)
    template.current_version = version
    db.flush()
    return row


def _tracked_html(html: str, recipient: CampaignRecipient, campaign: Campaign) -> str:
    base = f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/public/newsletter"

    def replace(match: re.Match[str]) -> str:
        url = match.group(1)
        if url.startswith(("mailto:", "tel:", "#")) or "unsubscribe" in url:
            return match.group(0)
        if campaign.utm_campaign and "utm_" not in url and url.startswith(settings.PUBLIC_BASE_URL):
            sep = "&" if "?" in url else "?"
            url += f"{sep}utm_source=newsletter&utm_medium=email&utm_campaign={quote(campaign.utm_campaign)}"
        signed = sign_payload({"r": recipient.tracking_token, "u": url}, ttl_seconds=180 * 86400)
        return f'href="{base}/click?t={quote(signed)}"'

    tracked = re.sub(r'href="([^"]+)"', replace, html)
    pixel = f'<img src="{base}/open?t={recipient.tracking_token}" width="1" height="1" alt="" style="display:none">'
    return tracked + pixel


def send_campaign(db: Session, campaign: Campaign, *, actor_id: uuid.UUID | None) -> dict[str, int]:
    from app.modules.notifications.service import render, render_email_layout
    from app.providers.email import EmailMessage, get_email_provider

    if campaign.status not in ("draft", "scheduled"):
        raise BusinessRuleError("Campagne déjà envoyée ou annulée")
    template = db.get(EmailTemplate, campaign.template_id) if campaign.template_id else None
    if template is None:
        raise BusinessRuleError("Associez un modèle à la campagne")
    version_no = campaign.template_version or template.current_version
    version = db.execute(
        select(EmailTemplateVersion).where(
            EmailTemplateVersion.template_id == template.id, EmailTemplateVersion.version == version_no
        )
    ).scalar_one_or_none()
    if version is None:
        raise BusinessRuleError("Version du modèle introuvable")
    campaign.template_version = version.version
    campaign.status = "sending"
    segments = [db.get(Segment, uuid.UUID(str(s))) for s in campaign.segment_ids or []]
    subscriber_ids: set[uuid.UUID] = set()
    if not segments:
        subscriber_ids = set(
            db.execute(select(NewsletterSubscriber.id).where(NewsletterSubscriber.status.in_(SENDABLE))).scalars()
        )
    for segment in segments:
        if segment is not None:
            subscriber_ids |= set(
                db.execute(select(NewsletterSubscriber.id).select_from(segment_query(segment).subquery())).scalars()
            )
    provider = get_email_provider()
    sent = failed = 0
    for sid in subscriber_ids:
        sub = db.get(NewsletterSubscriber, sid)
        if sub is None or sub.status not in SENDABLE:
            continue  # exclusion automatique des désabonnés / rebonds / plaintes
        recipient = db.execute(
            select(CampaignRecipient).where(
                CampaignRecipient.campaign_id == campaign.id, CampaignRecipient.subscriber_id == sid
            )
        ).scalar_one_or_none()
        if recipient is None:
            recipient = CampaignRecipient(campaign_id=campaign.id, subscriber_id=sid, tracking_token=random_token(24))
            db.add(recipient)
            db.flush()
        elif recipient.status in ("sent", "delivered"):
            continue
        context = {"first_name": sub.first_name or "", "email": sub.email}
        unsubscribe_url = (
            f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/public/newsletter/unsubscribe"
            f"?token={sub.token}"
        )
        inner = _tracked_html(render(version.html, context, html=True), recipient, campaign)
        html = render_email_layout(
            render(version.subject, context),
            inner,
            marketing=True,
            unsubscribe_url=unsubscribe_url,
            preheader=version.preheader,
        )
        try:
            result = provider.send(
                EmailMessage(
                    to=[sub.email],
                    subject=render(version.subject, context),
                    html=html,
                    text=version.text,
                    headers={
                        "List-Unsubscribe": f"<{unsubscribe_url}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                    tags=["newsletter", str(campaign.id)[:8]],
                    metadata={"campaign_id": str(campaign.id), "recipient_id": str(recipient.id)},
                )
            )
            recipient.status = "sent"
            recipient.sent_at = utcnow()
            recipient.provider_message_id = result.message_id
            db.add(CampaignEvent(campaign_id=campaign.id, recipient_id=recipient.id, subscriber_id=sid, kind="sent"))
            sent += 1
        except Exception as exc:  # noqa: BLE001
            recipient.status = "failed"
            failed += 1
            log.warning("campaign_send_failed", extra={"error": str(exc)[:200]})
    campaign.recipients_count = len(subscriber_ids)
    campaign.sent_count += sent
    campaign.status = "sent"
    campaign.sent_at = utcnow()
    audit.record(
        db,
        family="business",
        module="newsletter",
        action="SEND",
        resource_type="campaign",
        resource_id=campaign.id,
        actor_id=actor_id,
        diff={"sent": sent, "failed": failed},
    )
    return {"sent": sent, "failed": failed, "recipients": len(subscriber_ids)}


def run_scheduled_campaigns(db: Session) -> dict[str, Any]:
    due = (
        db.execute(select(Campaign).where(Campaign.status == "scheduled", Campaign.scheduled_at <= utcnow()))
        .scalars()
        .all()
    )
    total = 0
    for campaign in due:
        total += send_campaign(db, campaign, actor_id=None)["sent"]
    return {"items": total, "campaigns": len(due)}


# ---------------------------------------------------------------------------- suivi
def track(db: Session, recipient: CampaignRecipient, kind: str, url: str | None = None) -> None:
    campaign = db.get(Campaign, recipient.campaign_id)
    sub = db.get(NewsletterSubscriber, recipient.subscriber_id)
    if campaign is None or sub is None:
        return
    db.add(CampaignEvent(campaign_id=campaign.id, recipient_id=recipient.id, subscriber_id=sub.id, kind=kind, url=url))
    if kind == "open":
        campaign.open_count += 1
        if recipient.opened_at is None:
            recipient.opened_at = utcnow()
            campaign.unique_open_count += 1
    elif kind == "click":
        campaign.click_count += 1
        if recipient.clicked_at is None:
            recipient.clicked_at = utcnow()
            campaign.unique_click_count += 1
        if recipient.opened_at is None:
            recipient.opened_at = utcnow()
            campaign.unique_open_count += 1
    sub.last_engaged_at = utcnow()


def handle_esp_event(
    db: Session, *, kind: str, message_id: str | None, email: str | None, recipient_id: str | None = None
) -> None:
    """Événements ESP : delivered / bounce / complaint / unsubscribe."""
    recipient = None
    if recipient_id:
        try:
            recipient = db.get(CampaignRecipient, uuid.UUID(recipient_id))
        except ValueError:
            recipient = None
    if recipient is None and message_id:
        recipient = (
            db.execute(select(CampaignRecipient).where(CampaignRecipient.provider_message_id == message_id))
            .scalars()
            .first()
        )
    sub = (
        db.get(NewsletterSubscriber, recipient.subscriber_id)
        if recipient
        else (
            db.execute(
                select(NewsletterSubscriber).where(NewsletterSubscriber.email == (email or "").lower())
            ).scalar_one_or_none()
            if email
            else None
        )
    )
    campaign = db.get(Campaign, recipient.campaign_id) if recipient else None
    if campaign:
        db.add(
            CampaignEvent(
                campaign_id=campaign.id,
                recipient_id=recipient.id if recipient else None,
                subscriber_id=sub.id if sub else None,
                kind=kind,
            )
        )
    if kind == "delivered" and campaign:
        campaign.delivered_count += 1
        if recipient:
            recipient.status = "delivered"
    elif kind == "bounce":
        if campaign:
            campaign.bounce_count += 1
        if recipient:
            recipient.status = "bounced"
        if sub:
            sub.bounce_count += 1
            if sub.bounce_count >= 2:
                sub.status = "bounced"
                _event(db, sub, "bounced")
    elif kind == "complaint":
        if campaign:
            campaign.complaint_count += 1
        if sub:
            sub.status = "complained"
            _event(db, sub, "complained")
    elif kind == "unsubscribe" and sub:
        if campaign:
            campaign.unsubscribe_count += 1
        unsubscribe(db, sub.token, "via ESP")


# ---------------------------------------------------------------------------- automatisations
def _enroll(db: Session, sub: NewsletterSubscriber, trigger: str) -> None:
    for automation in db.execute(
        select(Automation).where(Automation.trigger == trigger, Automation.is_active.is_(True))
    ).scalars():
        exists = db.execute(
            select(AutomationEnrollment.id).where(
                AutomationEnrollment.automation_id == automation.id, AutomationEnrollment.subscriber_id == sub.id
            )
        ).first()
        if exists or not automation.steps:
            continue
        delay = int(automation.steps[0].get("delay_hours", 0))
        db.add(
            AutomationEnrollment(
                automation_id=automation.id,
                subscriber_id=sub.id,
                current_step=0,
                next_run_at=utcnow() + timedelta(hours=delay),
            )
        )
        automation.enrolled_count += 1


def run_automations(db: Session) -> dict[str, Any]:
    from app.modules.notifications.service import render, render_email_layout
    from app.providers.email import EmailMessage, get_email_provider

    sent = 0
    # Réactivation : abonnés inactifs depuis N jours.
    for automation in db.execute(
        select(Automation).where(Automation.trigger == "inactive_days", Automation.is_active.is_(True))
    ).scalars():
        days = int((automation.trigger_config or {}).get("days", 90))
        inactive = (
            db.execute(
                select(NewsletterSubscriber).where(
                    NewsletterSubscriber.status == "subscribed",
                    or_(
                        NewsletterSubscriber.last_engaged_at.is_(None),
                        NewsletterSubscriber.last_engaged_at < utcnow() - timedelta(days=days),
                    ),
                    NewsletterSubscriber.confirmed_at < utcnow() - timedelta(days=days),
                )
            )
            .scalars()
            .all()
        )
        for sub in inactive[:500]:
            _enroll(db, sub, "inactive_days")
    provider = get_email_provider()
    due = (
        db.execute(
            select(AutomationEnrollment)
            .where(AutomationEnrollment.status == "active", AutomationEnrollment.next_run_at <= utcnow())
            .limit(500)
        )
        .scalars()
        .all()
    )
    for enrollment in due:
        automation = db.get(Automation, enrollment.automation_id)
        sub = db.get(NewsletterSubscriber, enrollment.subscriber_id)
        if automation is None or sub is None or sub.status not in SENDABLE or not automation.is_active:
            enrollment.status = "exited"
            continue
        steps = automation.steps or []
        if enrollment.current_step >= len(steps):
            enrollment.status = "completed"
            continue
        step = steps[enrollment.current_step]
        template = db.get(EmailTemplate, uuid.UUID(str(step["template_id"]))) if step.get("template_id") else None
        version = None
        if template:
            version = db.execute(
                select(EmailTemplateVersion).where(
                    EmailTemplateVersion.template_id == template.id,
                    EmailTemplateVersion.version == template.current_version,
                )
            ).scalar_one_or_none()
        if version:
            unsubscribe_url = (
                f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/public/newsletter/unsubscribe"
                f"?token={sub.token}"
            )
            context = {"first_name": sub.first_name or "", "email": sub.email}
            subject = render(step.get("subject") or version.subject, context)
            try:
                provider.send(
                    EmailMessage(
                        to=[sub.email],
                        subject=subject,
                        html=render_email_layout(
                            subject,
                            render(version.html, context, html=True),
                            marketing=True,
                            unsubscribe_url=unsubscribe_url,
                        ),
                        headers={"List-Unsubscribe": f"<{unsubscribe_url}>"},
                        tags=["automation", automation.kind],
                    )
                )
                db.add(CampaignEvent(subscriber_id=sub.id, automation_id=automation.id, kind="sent"))
                sent += 1
            except Exception:  # noqa: BLE001
                log.warning("automation_send_failed")
        enrollment.current_step += 1
        if enrollment.current_step >= len(steps):
            enrollment.status = "completed"
            enrollment.next_run_at = None
        else:
            enrollment.next_run_at = utcnow() + timedelta(
                hours=int(steps[enrollment.current_step].get("delay_hours", 24))
            )
    db.flush()
    return {"items": sent}


def campaign_stats(campaign: Campaign) -> dict[str, Any]:
    sent = campaign.sent_count or 0

    def rate(n: int) -> float:
        return round(n * 100 / sent, 2) if sent else 0.0

    return {
        "recipients": campaign.recipients_count,
        "sent": sent,
        "delivered": campaign.delivered_count,
        "bounces": campaign.bounce_count,
        "opens": campaign.open_count,
        "unique_opens": campaign.unique_open_count,
        "clicks": campaign.click_count,
        "unique_clicks": campaign.unique_click_count,
        "unsubscribes": campaign.unsubscribe_count,
        "complaints": campaign.complaint_count,
        "open_rate": rate(campaign.unique_open_count),
        "click_rate": rate(campaign.unique_click_count),
        "bounce_rate": rate(campaign.bounce_count),
        "unsubscribe_rate": rate(campaign.unsubscribe_count),
    }
