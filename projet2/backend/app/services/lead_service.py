"""Shared CRM lead-creation logic.

Single source of truth used by BOTH the public ContactPage submission
(`/contact/submit`) and the ERP CRM admin form (`/crm/leads`), so every inbound
inquiry — wherever it originates — funnels into the same sales pipeline with a
consistent shape. Mutualised in Phase 16 to remove the duplicated lead-building
code that previously lived in two endpoints.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.erp import Lead


def split_full_name(full_name: str) -> tuple[str, str]:
    """Split a single display name into (first_name, last_name).

    'Jean Talla Dupont' -> ('Jean', 'Talla Dupont'); '' -> ('', '').
    """
    parts = (full_name or "").strip().split()
    if not parts:
        return ("", "")
    return (parts[0], " ".join(parts[1:]))


async def create_lead(
    db: AsyncSession,
    *,
    first_name: str,
    last_name: str = "",
    email: str = "",
    phone: str = "",
    company: str = "",
    project_type: str = "",
    message: str = "",
    location: str = "",
    source: str = "website",
    commit: bool = True,
) -> Lead:
    """Persist a CRM lead from normalised fields.

    Pass `commit=False` to enlist the lead in a larger transaction (e.g. when the
    caller also writes a contact submission in the same request) and commit once.
    """
    lead = Lead(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        company=company,
        project_type=project_type,
        message=message,
        location=location,
        source=source,
    )
    db.add(lead)
    if commit:
        await db.commit()
        await db.refresh(lead)
    return lead
