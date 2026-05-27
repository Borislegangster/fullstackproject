import os
from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import get_settings

settings = get_settings()

# -- Rate Limiter --
limiter = Limiter(key_func=get_remote_address)


# -- Lifespan: create tables on startup --
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all database tables on startup (dev mode)."""
    from app.database import engine, Base
    # Import ALL models so they register with Base.metadata
    import app.auth.models  # noqa: F401 — User
    import app.models.cms  # noqa: F401 — CMS models
    import app.models.media  # noqa: F401 — Media model
    import app.models.erp  # noqa: F401 — ERP models (30+ tables)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


# -- Health check --
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
