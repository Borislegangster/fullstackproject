"""API newsletter : inscription publique (double opt-in), confirmation, désabonnement en un clic,
suivi d'ouverture/clic, webhooks ESP, et gestion ERP (abonnés, segments, modèles, campagnes, automatisations)."""

from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.deps import Principal, require
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.middleware import client_ip
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.security import verify_signed_payload
from app.core.utils import jsonable
from app.modules.newsletter import service
from app.modules.newsletter.models import (
    Automation,
    Campaign,
    CampaignRecipient,
    EmailTemplate,
    EmailTemplateVersion,
    NewsletterSubscriber,
    Segment,
    SubscriberEvent,
)

public = APIRouter(prefix="/public/newsletter", tags=["Newsletter (public)"])
router = APIRouter(prefix="/newsletter", tags=["Newsletter"])
PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")


class SubscribeIn(BaseModel):
    email: EmailStr
    first_name: str | None = Field(default=None, max_length=120)
    interests: list[str] = Field(default_factory=list, max_length=10)
    consent: bool
    source: str = Field(default="website", max_length=40)


@public.post(
    "/subscribe", status_code=202, dependencies=[Depends(rate_limit("newsletter", settings.RATE_LIMIT_PUBLIC_FORMS))]
)
def subscribe(data: SubscribeIn, request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    from app.modules.analytics.service import record_server_event
    from app.modules.crm.service import record_consent

    if not data.consent:
        raise BusinessRuleError("Le consentement est requis pour l'inscription", code="CONSENT_REQUIRED")
    consent = record_consent(
        db,
        subject_type="subscriber",
        subject_ref=data.email.lower(),
        purposes={"newsletter": True},
        source=f"newsletter:{data.source}",
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    service.subscribe(
        db,
        email=data.email,
        first_name=data.first_name,
        source=data.source,
        interests=data.interests,
        consent_record_id=consent.id,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    record_server_event(db, "newsletter_subscribe", path="/", target=data.source)
    db.commit()
    return {"status": "pending_confirmation", "message": "Vérifiez votre boîte e-mail pour confirmer l'inscription."}


def _page(title: str, message: str) -> HTMLResponse:
    html = (
        f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><title>{title}</title>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'></head>"
        "<body style='font-family:Poppins,Arial,sans-serif;background:#F4F4F4;display:flex;align-items:center;"
        "justify-content:center;min-height:100vh;margin:0'><div style='background:#fff;padding:32px;border-radius:12px;"
        "max-width:480px;text-align:center'><h1 style='color:#385AA6;font-size:22px'>"
        + title
        + "</h1><p>"
        + message
        + f"</p><p><a style='color:#FB8C43' href='{settings.PUBLIC_BASE_URL}'>Retour au site</a></p>"
        + "</div></body></html>"
    )
    return HTMLResponse(html)


@public.get("/confirm", response_class=HTMLResponse)
def confirm(token: str = Query(..., max_length=100), db: Session = Depends(get_db)) -> HTMLResponse:
    service.confirm(db, token)
    db.commit()
    return _page("Inscription confirmée", "Merci ! Vous recevrez désormais nos conseils et actualités.")


@public.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe_page(token: str = Query(..., max_length=100), db: Session = Depends(get_db)) -> HTMLResponse:
    service.unsubscribe(db, token, "lien de désinscription")
    db.commit()
    return _page(
        "Désinscription effectuée", "Vous ne recevrez plus nos e-mails. Vous pouvez vous réinscrire à tout moment."
    )


@public.post("/unsubscribe")
def unsubscribe_one_click(token: str = Query(..., max_length=100), db: Session = Depends(get_db)) -> dict[str, str]:
    service.unsubscribe(db, token, "one-click")
    db.commit()
    return {"status": "unsubscribed"}


@public.get("/open")
def track_open(t: str = Query(..., max_length=100), db: Session = Depends(get_db)) -> Response:
    recipient = db.execute(select(CampaignRecipient).where(CampaignRecipient.tracking_token == t)).scalar_one_or_none()
    if recipient:
        service.track(db, recipient, "open")
        db.commit()
    return Response(PIXEL, media_type="image/gif", headers={"Cache-Control": "no-store"})


@public.get("/click")
def track_click(t: str = Query(..., max_length=2000), db: Session = Depends(get_db)) -> RedirectResponse:
    data = verify_signed_payload(unquote(t))
    if not data:
        return RedirectResponse(settings.PUBLIC_BASE_URL, status_code=302)
    url = str(data.get("u", settings.PUBLIC_BASE_URL))
    if not url.startswith(("https://", "http://")):
        url = settings.PUBLIC_BASE_URL
    recipient = db.execute(
        select(CampaignRecipient).where(CampaignRecipient.tracking_token == data.get("r"))
    ).scalar_one_or_none()
    if recipient:
        service.track(db, recipient, "click", url)
        db.commit()
    return RedirectResponse(url, status_code=302)


@public.post("/webhooks/{provider}")
async def esp_webhook(provider: str, request: Request, db: Session = Depends(get_db)) -> dict[str, int]:
    """Événements ESP (SendGrid signé ECDSA, Mailgun signé HMAC) : délivrance, rebonds, plaintes."""
    from app.providers.email import verify_mailgun_signature, verify_sendgrid_signature

    body = await request.body()
    handled = 0
    if provider == "sendgrid":
        if not verify_sendgrid_signature(
            body,
            request.headers.get("x-twilio-email-event-webhook-signature", ""),
            request.headers.get("x-twilio-email-event-webhook-timestamp", ""),
        ):
            raise AppError("Signature invalide", code="INVALID_SIGNATURE", status_code=401)
        for event in json.loads(body or b"[]"):
            kind = {
                "delivered": "delivered",
                "bounce": "bounce",
                "dropped": "bounce",
                "spamreport": "complaint",
                "unsubscribe": "unsubscribe",
                "group_unsubscribe": "unsubscribe",
            }.get(event.get("event"))
            if kind:
                service.handle_esp_event(
                    db,
                    kind=kind,
                    message_id=(event.get("sg_message_id") or "").split(".")[0],
                    email=event.get("email"),
                    recipient_id=event.get("recipient_id"),
                )
                handled += 1
    elif provider == "mailgun":
        payload = json.loads(body or b"{}")
        sig = payload.get("signature") or {}
        if not verify_mailgun_signature(
            str(sig.get("timestamp", "")), str(sig.get("token", "")), str(sig.get("signature", ""))
        ):
            raise AppError("Signature invalide", code="INVALID_SIGNATURE", status_code=401)
        event = payload.get("event-data") or {}
        kind = {
            "delivered": "delivered",
            "failed": "bounce",
            "complained": "complaint",
            "unsubscribed": "unsubscribe",
        }.get(event.get("event"))
        if kind:
            variables = event.get("user-variables") or {}
            service.handle_esp_event(
                db,
                kind=kind,
                message_id=((event.get("message") or {}).get("headers") or {}).get("message-id"),
                email=event.get("recipient"),
                recipient_id=variables.get("recipient_id"),
            )
            handled = 1
    else:
        raise NotFound("Fournisseur inconnu")
    db.commit()
    return {"handled": handled}


# ============================================================================ ERP
@router.get("/subscribers")
def list_subscribers(
    params: PageParams = Depends(),
    status: str | None = None,
    source: str | None = None,
    principal: Principal = Depends(require("newsletter:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(NewsletterSubscriber)
    if status:
        stmt = stmt.where(NewsletterSubscriber.status == status)
    if source:
        stmt = stmt.where(NewsletterSubscriber.source == source)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": NewsletterSubscriber.created_at, "email": NewsletterSubscriber.email},
        default_sort=NewsletterSubscriber.created_at.desc(),
        search_columns=[NewsletterSubscriber.email, NewsletterSubscriber.first_name],
        transform=lambda s: jsonable({k: v for k, v in serialize(s).items() if k != "token"}),
    )


@router.get("/subscribers/{subscriber_id}/history")
def subscriber_history(
    subscriber_id: uuid.UUID, principal: Principal = Depends(require("newsletter:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(SubscriberEvent)
            .where(SubscriberEvent.subscriber_id == subscriber_id)
            .order_by(SubscriberEvent.created_at.desc())
        )
        .scalars()
        .all()
    )
    return jsonable([{"kind": r.kind, "details": r.details, "actor_id": r.actor_id, "at": r.created_at} for r in rows])


class SubscriberPatch(BaseModel):
    tags: list[str] | None = None
    interests: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(unsubscribed)$")


@router.patch("/subscribers/{subscriber_id}")
def update_subscriber(
    subscriber_id: uuid.UUID,
    data: SubscriberPatch,
    principal: Principal = Depends(require("newsletter:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    sub = db.get(NewsletterSubscriber, subscriber_id)
    if sub is None:
        raise NotFound("Abonné introuvable")
    if data.tags is not None:
        added, removed = set(data.tags) - set(sub.tags or []), set(sub.tags or []) - set(data.tags)
        sub.tags = sorted(set(data.tags))
        for t in added:
            service._event(db, sub, "tag_added", {"tag": t}, principal.id)
        for t in removed:
            service._event(db, sub, "tag_removed", {"tag": t}, principal.id)
    if data.interests is not None:
        sub.interests = sorted(set(data.interests))
        service._event(db, sub, "preferences", {"interests": sub.interests}, principal.id)
    if data.status == "unsubscribed":
        service.unsubscribe(db, sub.token, "désinscription par l'équipe")
    db.commit()
    return jsonable({k: v for k, v in serialize(sub).items() if k != "token"})


router.include_router(
    make_crud_router(
        Segment,
        prefix="/segments",
        tags=["Newsletter"],
        module="newsletter",
        read_perm="newsletter:read",
        write_perm="newsletter:write",
        label="Segment",
        search=["name"],
        exclude_in={"estimated_count"},
        after_change=lambda db, obj, access, action: (
            setattr(obj, "estimated_count", service.segment_count(db, obj)) if action != "delete" else None
        ),
    )
)


@router.get("/templates")
def list_templates(
    principal: Principal = Depends(require("newsletter:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    rows = db.execute(select(EmailTemplate).order_by(EmailTemplate.name)).scalars().all()
    return jsonable(
        [
            {
                "id": t.id,
                "name": t.name,
                "kind": t.kind,
                "current_version": t.current_version,
                "versions": [
                    {"version": v.version, "subject": v.subject, "created_at": v.created_at} for v in t.versions
                ],
            }
            for t in rows
        ]
    )


class TemplateIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    kind: str = Field(default="campaign", pattern="^(campaign|automation|transactional)$")
    subject: str = Field(min_length=2, max_length=250)
    preheader: str | None = Field(default=None, max_length=250)
    html: str = Field(min_length=5, max_length=500_000)
    text: str | None = None


@router.post("/templates", status_code=201)
def create_template(
    data: TemplateIn, principal: Principal = Depends(require("newsletter:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    template = EmailTemplate(name=data.name, kind=data.kind, current_version=0)
    db.add(template)
    db.flush()
    service.new_template_version(
        db,
        template,
        subject=data.subject,
        html=data.html,
        text=data.text,
        preheader=data.preheader,
        user_id=principal.id,
    )
    audit.record(
        db,
        family="business",
        module="newsletter",
        action="CREATE",
        resource_type="email_template",
        resource_id=template.id,
    )
    db.commit()
    return {"id": template.id, "current_version": template.current_version}


@router.post("/templates/{template_id}/versions", status_code=201)
def add_version(
    template_id: uuid.UUID,
    data: TemplateIn,
    principal: Principal = Depends(require("newsletter:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise NotFound("Modèle introuvable")
    version = service.new_template_version(
        db,
        template,
        subject=data.subject,
        html=data.html,
        text=data.text,
        preheader=data.preheader,
        user_id=principal.id,
    )
    audit.record(
        db,
        family="business",
        module="newsletter",
        action="VERSION",
        resource_type="email_template",
        resource_id=template.id,
        diff={"version": version.version},
    )
    db.commit()
    return {"id": template.id, "version": version.version}


@router.get("/templates/{template_id}/versions/{version}")
def get_version(
    template_id: uuid.UUID,
    version: int,
    principal: Principal = Depends(require("newsletter:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    row = db.execute(
        select(EmailTemplateVersion).where(
            EmailTemplateVersion.template_id == template_id, EmailTemplateVersion.version == version
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Version introuvable")
    return jsonable(serialize(row))


class CampaignIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    subject: str = Field(min_length=2, max_length=250)
    template_id: uuid.UUID
    template_version: int | None = None
    segment_ids: list[uuid.UUID] = Field(default_factory=list)
    utm_campaign: str | None = Field(default=None, max_length=160)


@router.get("/campaigns")
def list_campaigns(
    params: PageParams = Depends(),
    principal: Principal = Depends(require("newsletter:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return paginate(
        db,
        select(Campaign),
        params,
        default_sort=Campaign.created_at.desc(),
        search_columns=[Campaign.name],
        transform=lambda c: jsonable({**serialize(c), "stats": service.campaign_stats(c)}),
    )


@router.post("/campaigns", status_code=201)
def create_campaign(
    data: CampaignIn, principal: Principal = Depends(require("newsletter:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    campaign = Campaign(
        name=data.name,
        subject=data.subject,
        template_id=data.template_id,
        template_version=data.template_version,
        segment_ids=[str(s) for s in data.segment_ids],
        utm_campaign=data.utm_campaign,
        status="draft",
        created_by_id=principal.id,
    )
    db.add(campaign)
    db.flush()
    audit.record(
        db, family="business", module="newsletter", action="CREATE", resource_type="campaign", resource_id=campaign.id
    )
    db.commit()
    return jsonable(serialize(campaign))


@router.get("/campaigns/{campaign_id}")
def get_campaign(
    campaign_id: uuid.UUID, principal: Principal = Depends(require("newsletter:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise NotFound("Campagne introuvable")
    segments = [db.get(Segment, uuid.UUID(str(s))) for s in campaign.segment_ids or []]
    audience = sum(service.segment_count(db, s) for s in segments if s) if segments else service.segment_count(db, None)
    return jsonable({**serialize(campaign), "stats": service.campaign_stats(campaign), "estimated_audience": audience})


@router.post("/campaigns/{campaign_id}/schedule")
def schedule_campaign(
    campaign_id: uuid.UUID,
    data: dict[str, str],
    principal: Principal = Depends(require("newsletter:send")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.status not in ("draft", "scheduled"):
        raise BusinessRuleError("Campagne non programmable")
    campaign.scheduled_at = datetime.fromisoformat(data["scheduled_at"])
    campaign.status = "scheduled"
    audit.record(
        db,
        family="business",
        module="newsletter",
        action="SCHEDULE",
        resource_type="campaign",
        resource_id=campaign.id,
        diff={"scheduled_at": data["scheduled_at"]},
    )
    db.commit()
    return jsonable(serialize(campaign))


@router.post("/campaigns/{campaign_id}/send")
def send_now(
    campaign_id: uuid.UUID, principal: Principal = Depends(require("newsletter:send")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise NotFound("Campagne introuvable")
    result = service.send_campaign(db, campaign, actor_id=principal.id)
    db.commit()
    return {**result, "stats": service.campaign_stats(campaign)}


@router.post("/campaigns/{campaign_id}/cancel")
def cancel_campaign(
    campaign_id: uuid.UUID, principal: Principal = Depends(require("newsletter:send")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.status not in ("draft", "scheduled"):
        raise BusinessRuleError("Campagne non annulable")
    campaign.status = "cancelled"
    audit.record(
        db, family="business", module="newsletter", action="CANCEL", resource_type="campaign", resource_id=campaign.id
    )
    db.commit()
    return jsonable(serialize(campaign))


router.include_router(
    make_crud_router(
        Automation,
        prefix="/automations",
        tags=["Newsletter"],
        module="newsletter",
        read_perm="newsletter:read",
        write_perm="newsletter:write",
        label="Automatisation",
        filters=["kind", "trigger", "is_active"],
        exclude_in={"enrolled_count"},
    )
)
