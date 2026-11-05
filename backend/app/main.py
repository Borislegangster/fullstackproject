import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Force UTF-8 on stdout/stderr so French accents + emoji in logs never crash
# the app on a Windows cp1252 console (UnicodeEncodeError at startup).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.logging_config import setup_logging, init_sentry

settings = get_settings()

# Initialise structured logging + Sentry as early as possible
setup_logging()
init_sentry()

# -- Rate Limiter (shared instance) --
from app.rate_limit import limiter as _shared_limiter
limiter = _shared_limiter


# -- Lifespan: create tables on startup --
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables (dev) or verify connection (prod)."""
    from app.database import engine, Base
    from sqlalchemy import text
    # Import ALL models so they register with Base.metadata
    import app.auth.models  # noqa: F401 — User
    import app.models.cms  # noqa: F401 — CMS models
    import app.models.media  # noqa: F401 — Media model
    import app.models.erp  # noqa: F401 — ERP models (30+ tables)
    import app.models.suppliers  # noqa: F401
    import app.models.bim_hub  # noqa: F401
    import app.models.communications  # noqa: F401
    import app.models.marketing  # noqa: F401
    import app.models.security_audit  # noqa: F401
    import app.models.extensions  # noqa: F401

    if settings.DEBUG:
        # Development: auto-create all tables (convenient, no migration needed)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        # Seed the default project templates + CMS singleton rows (idempotent).
        from app.database import AsyncSessionLocal
        from app.services.project_templates import ensure_default_templates
        from app.services.cms_defaults import ensure_cms_defaults
        async with AsyncSessionLocal() as db:
            await ensure_default_templates(db)
            await ensure_cms_defaults(db)
        print(f"[DEV] Tables OK + defaults seeded - {settings.APP_NAME}")
    else:
        # Production: only verify DB connection — use Alembic for migrations
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        # Self-heal the CMS singleton rows (idempotent, non-fatal).
        try:
            from app.database import AsyncSessionLocal
            from app.services.cms_defaults import ensure_cms_defaults
            async with AsyncSessionLocal() as db:
                await ensure_cms_defaults(db)
        except Exception as e:
            print(f"[PROD] ensure_cms_defaults skipped: {e}")
        print(f"[PROD] DB connection OK - {settings.APP_NAME}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach limiter to app state (required by slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# -- CORS --
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Static files (uploads) --
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# -- Routers --
# CMS (existing)
from app.api.public_cms import router as public_cms_router  # noqa: E402
from app.api.auth import router as auth_router  # noqa: E402
from app.api.admin_cms import router as admin_cms_router  # noqa: E402
from app.api.admin_media import router as admin_media_router  # noqa: E402

app.include_router(public_cms_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_cms_router, prefix="/api/v1")
app.include_router(admin_media_router, prefix="/api/v1")

# ERP modules
from app.api.crm import router as crm_router  # noqa: E402
from app.api.projects import router as projects_router  # noqa: E402
from app.api.invoicing import router as invoicing_router  # noqa: E402
from app.api.hr import router as hr_router  # noqa: E402
from app.api.procurement import router as procurement_router  # noqa: E402
from app.api.ged import router as ged_router  # noqa: E402
from app.api.messaging import router as messaging_router  # noqa: E402
from app.api.sav import router as sav_router  # noqa: E402
from app.api.erp_modules import (  # noqa: E402
    agenda_router, qhse_router, equipment_router,
    subcontractors_router, finances_router,
    notifications_router, activity_router, users_router,
)
from app.api.client_portal import router as client_router  # noqa: E402

# Phase 1 — New routers (registered FIRST so that their literal sub-paths
# like /equipment/assignments or /subcontractors/invoices match before
# the parameterised /{id} routes declared in the legacy routers below).
from app.api.charges import router as charges_router  # noqa: E402
from app.api.planning import router as planning_router  # noqa: E402
from app.api.epi import router as epi_router  # noqa: E402
from app.api.equipment_extra import router as equipment_extra_router  # noqa: E402
from app.api.sub_invoices import router as sub_invoices_router  # noqa: E402
from app.api.templates import router as templates_router  # noqa: E402
from app.api.reports import router as reports_router  # noqa: E402
from app.api.user_prefs import router as user_prefs_router  # noqa: E402

app.include_router(charges_router, prefix="/api/v1")
app.include_router(planning_router, prefix="/api/v1")
app.include_router(epi_router, prefix="/api/v1")
app.include_router(equipment_extra_router, prefix="/api/v1")
app.include_router(sub_invoices_router, prefix="/api/v1")
app.include_router(templates_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(user_prefs_router, prefix="/api/v1")

# Legacy ERP routers
app.include_router(crm_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(invoicing_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(procurement_router, prefix="/api/v1")
app.include_router(ged_router, prefix="/api/v1")
app.include_router(messaging_router, prefix="/api/v1")
app.include_router(sav_router, prefix="/api/v1")
app.include_router(agenda_router, prefix="/api/v1")
app.include_router(qhse_router, prefix="/api/v1")
app.include_router(equipment_router, prefix="/api/v1")
app.include_router(subcontractors_router, prefix="/api/v1")
app.include_router(finances_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(activity_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(client_router, prefix="/api/v1")

# Bureau d'Études — Collaboration temps réel (WebSocket + REST)
from app.api.collaboration import router as collaboration_router  # noqa: E402
app.include_router(collaboration_router, prefix="/api/v1")

# Phase 4 — Security routers
from app.api.two_factor import router as two_factor_router  # noqa: E402
from app.api.health import router as health_router  # noqa: E402
app.include_router(two_factor_router, prefix="/api/v1")
app.include_router(health_router)  # /health/* at root level

# Phase 6 — Real-time WebSocket channels (notifications + messaging)
from app.api.realtime import router as realtime_router  # noqa: E402
app.include_router(realtime_router, prefix="/api/v1")

# Phase 7 — Documents & exports
from app.api.exports import router as exports_router  # noqa: E402
app.include_router(exports_router, prefix="/api/v1")
from app.api.signing import router as signing_router  # noqa: E402
app.include_router(signing_router, prefix="/api/v1")

# Phase 14 — Quotes (devis)
from app.api.quotes import router as quotes_router  # noqa: E402
app.include_router(quotes_router, prefix="/api/v1")

# Payments — Flutterwave gateway
from app.api.payments import router as payments_router  # noqa: E402
app.include_router(payments_router, prefix="/api/v1")

# ── V4 Phase 2 — New domain routers ─────────────────────────
from app.api.suppliers import router as suppliers_router  # noqa: E402
from app.api.deliveries import router as deliveries_router  # noqa: E402
from app.api.bim_hub import router as bim_hub_router  # noqa: E402
from app.api.newsletter import router as newsletter_router  # noqa: E402
from app.api.disputes import tender_router, dispute_router  # noqa: E402
from app.api.project_extensions import router as project_ext_router  # noqa: E402
from app.api.calls import router as calls_router  # noqa: E402
from app.api.analytics_dashboard import router as analytics_router  # noqa: E402
from app.api.security_admin import router as security_router  # noqa: E402
from app.api.offers_cms import router as offers_cms_router  # noqa: E402
from app.api.project_brief import router as project_brief_router  # noqa: E402

app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(deliveries_router, prefix="/api/v1")
app.include_router(bim_hub_router, prefix="/api/v1")
app.include_router(newsletter_router, prefix="/api/v1")
app.include_router(tender_router, prefix="/api/v1")
app.include_router(dispute_router, prefix="/api/v1")
app.include_router(project_ext_router, prefix="/api/v1")
app.include_router(calls_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(security_router, prefix="/api/v1")
app.include_router(offers_cms_router, prefix="/api/v1")
app.include_router(project_brief_router, prefix="/api/v1")

