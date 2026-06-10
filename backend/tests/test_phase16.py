"""Phase 16 — Lead funnel mutualisation.

The public ContactPage submission (`/cms/contact/submit`) and the ERP CRM form
(`/crm/leads`) now share one lead-creation path (`app.services.lead_service`).
A website contact must therefore also surface as a CRM lead in the pipeline.
"""
import uuid

API = "/api/v1"


def test_contact_submission_creates_crm_lead(client, admin_headers):
    unique = uuid.uuid4().hex[:8]
    email = f"prospect-{unique}@example.com"

    resp = client.post(f"{API}/cms/contact/submit", json={
        "name": "Jean Talla Dupont",
        "email": email,
        "phone": "+237600000000",
        "subject": "Construction villa",
        "message": "Je souhaite un devis pour une villa.",
        "projectType": "Construction",
    })
    assert resp.status_code == 200, resp.text

    # The same inquiry must now exist as a CRM lead.
    leads = client.get(f"{API}/crm/leads", headers=admin_headers).json()
    match = [l for l in leads if l.get("email") == email]
    assert match, "contact submission did not create a CRM lead"

    lead = match[0]
    assert lead["first_name"] == "Jean"
    assert lead["last_name"] == "Talla Dupont"
    assert lead["source"] == "contact_form"
    assert lead["project_type"] == "Construction"
    assert lead["message"] == "Je souhaite un devis pour une villa."


def test_crm_lead_endpoint_still_works(client):
    """The admin/public /crm/leads endpoint still creates leads (default source)."""
    unique = uuid.uuid4().hex[:8]
    email = f"direct-{unique}@example.com"

    resp = client.post(f"{API}/crm/leads", json={
        "first_name": "Marie",
        "last_name": "Ngo",
        "email": email,
        "phone": "+237611111111",
        "project_type": "Rénovation",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == email
    assert body["first_name"] == "Marie"
    assert body["source"] == "website"  # schema default


def test_split_full_name_helper():
    from app.services.lead_service import split_full_name

    assert split_full_name("Jean Talla Dupont") == ("Jean", "Talla Dupont")
    assert split_full_name("Jean") == ("Jean", "")
    assert split_full_name("  ") == ("", "")
    assert split_full_name("") == ("", "")
