"""Self-healing CMS singletons.

The ERP CMS admin and the public vitrine both assume that the singleton rows
(site settings, about content) and the 4 legal pages exist. On a fresh /
unseeded database they don't, which used to surface as `null` payloads and
frontend crashes ("Cannot read properties of null").

`ensure_cms_defaults` idempotently creates skeleton rows with the model
defaults so every endpoint always has something valid to return. It runs at
startup and is also called from the admin GET endpoints (self-heal if the DB
is wiped while the app is running).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cms import CMSAboutContent, CMSLegalPage, CMSSiteSettings

LEGAL_SLUGS = [
    ("mentions-legales", "Mentions Légales"),
    ("politique-de-confidentialite", "Politique de Confidentialité"),
    ("termes-et-conditions", "Termes et Conditions"),
    ("cookies", "Politique de Cookies"),
]


async def ensure_cms_defaults(db: AsyncSession) -> bool:
    """Create any missing CMS singleton/legal rows. Returns True if it wrote."""
    wrote = False

    if not (await db.execute(select(CMSSiteSettings.id).limit(1))).scalars().first():
        db.add(CMSSiteSettings())  # column defaults = sensible skeleton
        wrote = True

    if not (await db.execute(select(CMSAboutContent.id).limit(1))).scalars().first():
        db.add(CMSAboutContent())
        wrote = True

    existing = set(
        (await db.execute(select(CMSLegalPage.slug))).scalars().all()
    )
    for slug, title in LEGAL_SLUGS:
        if slug not in existing:
            db.add(CMSLegalPage(slug=slug, title=title, sections=[]))
            wrote = True

    if wrote:
        await db.commit()
    return wrote
