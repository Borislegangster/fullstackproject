import os
from dotenv import load_dotenv
load_dotenv()

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

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
from app.api.public_cms import router as public_cms_router  # noqa: E402
from app.api.auth import router as auth_router  # noqa: E402
from app.api.admin_cms import router as admin_cms_router  # noqa: E402
from app.api.admin_media import router as admin_media_router  # noqa: E402

app.include_router(public_cms_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_cms_router, prefix="/api/v1")
app.include_router(admin_media_router, prefix="/api/v1")


# -- Health check --
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
