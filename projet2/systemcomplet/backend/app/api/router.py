"""Agrégation des routeurs de l'API v1 (§19.1)."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.downloads import router as downloads_router
from app.modules.admin.router import router as admin_router
from app.modules.agenda.router import router as agenda_router
from app.modules.ai.router import router as ai_router
from app.modules.analytics.router import public as analytics_public
from app.modules.analytics.router import router as analytics_router
from app.modules.assistant.router import public as assistant_public
from app.modules.assistant.router import router as assistant_router
from app.modules.billing.router import router as billing_router
from app.modules.billing.router_collections import public as paylink_public
from app.modules.billing.router_collections import router as collections_router
from app.modules.bim.router import router as bim_router
from app.modules.client_portal.router import router as client_portal_router
from app.modules.cms.router_admin import router as cms_admin_router
from app.modules.cms.router_public import router as cms_public_router
from app.modules.communications.router import router as communications_router
from app.modules.configurator.router import router as configurator_router
from app.modules.crm.router import public as crm_public
from app.modules.crm.router import router as crm_router
from app.modules.docs.router import router as docs_router
from app.modules.documents.router import public as documents_public
from app.modules.documents.router import router as documents_router
from app.modules.energy.router import public as energy_public
from app.modules.energy.router import router as energy_router
from app.modules.equipment.router import router as equipment_router
from app.modules.escrow.router import router as escrow_router
from app.modules.finance.router import router as finance_router
from app.modules.finance.router import webhooks as payment_webhooks
from app.modules.financing.router import public as financing_public
from app.modules.financing.router import router as financing_router
from app.modules.hr.router import router as hr_router
from app.modules.identity.router import admin as identity_admin_router
from app.modules.identity.router import router as auth_router
from app.modules.inventory.router import router as inventory_router
from app.modules.maintenance.router import router as maintenance_router
from app.modules.market.router import router as market_router
from app.modules.newsletter.router import public as newsletter_public
from app.modules.newsletter.router import router as newsletter_router
from app.modules.notifications.router import router as notifications_router
from app.modules.panels.router import public as panels_public
from app.modules.panels.router import router as panels_router
from app.modules.procurement.router import public as supplier_portal
from app.modules.procurement.router import router as procurement_router
from app.modules.procurement.router import whatsapp as whatsapp_webhooks
from app.modules.projects.router import router as projects_router
from app.modules.proofs.router import public as proofs_public
from app.modules.proofs.router import router as proofs_router
from app.modules.qhse.router import router as qhse_router
from app.modules.referrals.router import public as referrals_public
from app.modules.referrals.router import router as referrals_router
from app.modules.reports.router import router as reports_router
from app.modules.reviews.router import public as reviews_public
from app.modules.reviews.router import router as reviews_router
from app.modules.scheduling.router import router as scheduling_router
from app.modules.subcontracting.router import extranet as subcontractor_extranet
from app.modules.subcontracting.router import router as subcontracting_router
from app.modules.suppliers.router import extranet as supplier_extranet
from app.modules.suppliers.router import router as suppliers_router
from app.modules.support.router import router as support_router
from app.modules.sync.router import router as sync_router
from app.modules.timelapse.router import devices as camera_devices
from app.modules.timelapse.router import router as timelapse_router
from app.modules.twin.router import router as twin_router
from app.modules.visits.router import public as visits_public
from app.modules.visits.router import router as visits_router

api_router = APIRouter()
for _router in (
    auth_router,
    identity_admin_router,
    downloads_router,
    cms_public_router,
    cms_admin_router,
    analytics_public,
    analytics_router,
    crm_public,
    assistant_public,
    assistant_router,
    crm_router,
    newsletter_public,
    newsletter_router,
    projects_router,
    documents_public,
    documents_router,
    proofs_router,
    proofs_public,
    finance_router,
    billing_router,
    collections_router,
    paylink_public,
    payment_webhooks,
    procurement_router,
    supplier_portal,
    whatsapp_webhooks,
    suppliers_router,
    supplier_extranet,
    inventory_router,
    subcontracting_router,
    subcontractor_extranet,
    hr_router,
    qhse_router,
    equipment_router,
    communications_router,
    notifications_router,
    bim_router,
    configurator_router,
    support_router,
    agenda_router,
    ai_router,
    client_portal_router,
    admin_router,
    sync_router,
    reports_router,
    reviews_router,
    reviews_public,
    panels_router,
    panels_public,
    referrals_router,
    referrals_public,
    timelapse_router,
    camera_devices,
    market_router,
    scheduling_router,
    visits_router,
    visits_public,
    maintenance_router,
    energy_router,
    energy_public,
    financing_router,
    financing_public,
    escrow_router,
    twin_router,
    docs_router,
):
    api_router.include_router(_router)
